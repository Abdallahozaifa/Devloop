import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Parses database models from various ORMs
 * Supports: SQLAlchemy, Prisma, TypeORM, Django, Mongoose, Drizzle
 */
export async function parseModels(projectRoot, framework) {
  const result = {
    entities: [],
    relationships: [],
    enums: [],
  };

  const backendLang = framework?.language?.backend;

  if (backendLang === 'python') {
    const pythonModels = await parsePythonModels(projectRoot);
    mergeModels(result, pythonModels);
  }

  if (backendLang === 'javascript' || backendLang === 'typescript') {
    const nodeModels = await parseNodeModels(projectRoot);
    mergeModels(result, nodeModels);
  }

  // Always try Prisma as it's language-agnostic
  const prismaModels = await parsePrismaModels(projectRoot);
  mergeModels(result, prismaModels);

  return result;
}

function mergeModels(target, source) {
  if (source.entities) {
    for (const entity of source.entities) {
      const existing = target.entities.find(e => e.name === entity.name);
      if (!existing) {
        target.entities.push(entity);
      }
    }
  }
  if (source.relationships) {
    target.relationships.push(...source.relationships);
  }
  if (source.enums) {
    for (const enumDef of source.enums) {
      const existing = target.enums.find(e => e.name === enumDef.name);
      if (!existing) {
        target.enums.push(enumDef);
      }
    }
  }
}

async function parsePythonModels(projectRoot) {
  const result = {
    entities: [],
    relationships: [],
    enums: [],
  };

  // Find SQLAlchemy/SQLModel model files
  const modelPaths = [
    'app/models/**/*.py',
    'api/app/models/**/*.py',
    'backend/app/models/**/*.py',
    'src/models/**/*.py',
    '**/models/*.py',
    '**/db/models/**/*.py',
  ];

  const processedFiles = new Set();

  for (const pattern of modelPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/test_*', '**/__pycache__/**', '**/__init__.py'],
    });

    for (const file of files) {
      if (processedFiles.has(file)) continue;
      processedFiles.add(file);

      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Parse SQLAlchemy models
      const sqlalchemyModels = parseSQLAlchemyModels(content, file);
      mergeModels(result, sqlalchemyModels);

      // Parse SQLModel models (FastAPI)
      const sqlModelModels = parseSQLModelModels(content, file);
      mergeModels(result, sqlModelModels);

      // Parse Django models
      const djangoModels = parseDjangoModels(content, file);
      mergeModels(result, djangoModels);

      // Parse Python enums
      const enums = parsePythonEnums(content);
      result.enums.push(...enums);
    }
  }

  return result;
}

function parseSQLAlchemyModels(content, file) {
  const result = { entities: [], relationships: [] };

  // Match SQLAlchemy model classes
  const classRegex = /class\s+(\w+)\s*\(\s*(?:Base|DeclarativeBase|db\.Model)[^)]*\):\s*([\s\S]*?)(?=\nclass\s|\n@|\Z)/g;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const modelName = classMatch[1];
    const classBody = classMatch[2];

    const entity = {
      name: modelName,
      tableName: extractTableName(classBody) || modelName.toLowerCase() + 's',
      file,
      fields: [],
      primaryKey: null,
    };

    // Parse Column definitions
    const columnRegex = /(\w+)\s*[=:]\s*(?:Column|mapped_column)\s*\(\s*([^)]+)\)/g;
    let colMatch;

    while ((colMatch = columnRegex.exec(classBody)) !== null) {
      const fieldName = colMatch[1];
      const columnDef = colMatch[2];

      const field = parseSQLAlchemyColumn(fieldName, columnDef);
      entity.fields.push(field);

      if (field.primaryKey) {
        entity.primaryKey = fieldName;
      }
    }

    // Parse relationships
    const relRegex = /(\w+)\s*[=:]\s*relationship\s*\(\s*['\"](\w+)['\"]/g;
    let relMatch;

    while ((relMatch = relRegex.exec(classBody)) !== null) {
      result.relationships.push({
        from: modelName,
        to: relMatch[2],
        field: relMatch[1],
        type: classBody.includes('back_populates') ? 'bidirectional' : 'unidirectional',
      });
    }

    // Parse ForeignKey relationships
    const fkRegex = /(\w+)\s*[=:]\s*(?:Column|mapped_column)\s*\([^)]*ForeignKey\s*\(\s*['\"]([^'"]+)['\"]/g;
    let fkMatch;

    while ((fkMatch = fkRegex.exec(classBody)) !== null) {
      const [targetTable, targetField] = fkMatch[2].split('.');
      result.relationships.push({
        from: modelName,
        to: targetTable.replace('s', '').charAt(0).toUpperCase() + targetTable.replace('s', '').slice(1),
        field: fkMatch[1],
        foreignKey: fkMatch[2],
        type: 'many-to-one',
      });
    }

    result.entities.push(entity);
  }

  return result;
}

function parseSQLAlchemyColumn(name, definition) {
  const field = {
    name,
    type: 'string',
    required: !definition.includes('nullable=True'),
    primaryKey: definition.includes('primary_key=True'),
    unique: definition.includes('unique=True'),
    default: null,
  };

  // Extract type
  if (definition.includes('UUID')) field.type = 'uuid';
  else if (definition.includes('Integer')) field.type = 'integer';
  else if (definition.includes('Float') || definition.includes('Numeric') || definition.includes('Decimal')) field.type = 'number';
  else if (definition.includes('Boolean')) field.type = 'boolean';
  else if (definition.includes('DateTime') || definition.includes('TIMESTAMP')) field.type = 'datetime';
  else if (definition.includes('Date')) field.type = 'date';
  else if (definition.includes('Text') || definition.includes('String')) field.type = 'string';
  else if (definition.includes('JSON') || definition.includes('JSONB')) field.type = 'json';
  else if (definition.includes('Enum')) {
    field.type = 'enum';
    const enumMatch = definition.match(/Enum\s*\(\s*(\w+)/);
    if (enumMatch) field.enumType = enumMatch[1];
  }

  // Extract default
  const defaultMatch = definition.match(/default=([^,)]+)/);
  if (defaultMatch) {
    field.default = defaultMatch[1].trim();
  }

  return field;
}

function parseSQLModelModels(content, file) {
  const result = { entities: [], relationships: [] };

  // Match SQLModel classes
  const classRegex = /class\s+(\w+)\s*\(\s*(?:SQLModel)[^)]*,?\s*table\s*=\s*True[^)]*\):\s*([\s\S]*?)(?=\nclass\s|\n@|\Z)/g;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const modelName = classMatch[1];
    const classBody = classMatch[2];

    const entity = {
      name: modelName,
      tableName: modelName.toLowerCase() + 's',
      file,
      fields: [],
      primaryKey: 'id',
    };

    // Parse field annotations
    const fieldRegex = /(\w+)\s*:\s*(?:Optional\[)?(\w+)(?:\])?\s*(?:=\s*Field\(([^)]*)\))?/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const fieldDef = fieldMatch[3] || '';

      const field = {
        name: fieldName,
        type: mapPythonType(fieldType),
        required: !classBody.match(new RegExp(`${fieldName}\\s*:\\s*Optional`)),
        primaryKey: fieldDef.includes('primary_key=True'),
        default: null,
      };

      // Check for foreign key
      const fkMatch = fieldDef.match(/foreign_key=['\"]([^'"]+)['"]/);
      if (fkMatch) {
        field.foreignKey = fkMatch[1];
        result.relationships.push({
          from: modelName,
          to: fkMatch[1].split('.')[0],
          field: fieldName,
          type: 'many-to-one',
        });
      }

      entity.fields.push(field);

      if (field.primaryKey) {
        entity.primaryKey = fieldName;
      }
    }

    result.entities.push(entity);
  }

  return result;
}

function parseDjangoModels(content, file) {
  const result = { entities: [], relationships: [] };

  // Match Django model classes
  const classRegex = /class\s+(\w+)\s*\(\s*models\.Model\s*\):\s*([\s\S]*?)(?=\nclass\s|\Z)/g;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const modelName = classMatch[1];
    const classBody = classMatch[2];

    const entity = {
      name: modelName,
      tableName: modelName.toLowerCase() + 's',
      file,
      fields: [],
      primaryKey: 'id',
    };

    // Parse Django field definitions
    const fieldRegex = /(\w+)\s*=\s*models\.(\w+)\s*\(([^)]*)\)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const fieldDef = fieldMatch[3];

      const field = {
        name: fieldName,
        type: mapDjangoType(fieldType),
        required: !fieldDef.includes('null=True') && !fieldDef.includes('blank=True'),
        primaryKey: fieldType === 'AutoField' || fieldType === 'BigAutoField',
        unique: fieldDef.includes('unique=True'),
      };

      // Handle ForeignKey
      if (fieldType === 'ForeignKey') {
        const targetMatch = fieldDef.match(/['\"]?(\w+)['\"]?/);
        if (targetMatch) {
          result.relationships.push({
            from: modelName,
            to: targetMatch[1],
            field: fieldName,
            type: 'many-to-one',
          });
        }
      }

      // Handle ManyToManyField
      if (fieldType === 'ManyToManyField') {
        const targetMatch = fieldDef.match(/['\"]?(\w+)['\"]?/);
        if (targetMatch) {
          result.relationships.push({
            from: modelName,
            to: targetMatch[1],
            field: fieldName,
            type: 'many-to-many',
          });
        }
      }

      entity.fields.push(field);
    }

    result.entities.push(entity);
  }

  return result;
}

function mapDjangoType(djangoType) {
  const typeMap = {
    CharField: 'string',
    TextField: 'string',
    IntegerField: 'integer',
    BigIntegerField: 'integer',
    SmallIntegerField: 'integer',
    FloatField: 'number',
    DecimalField: 'number',
    BooleanField: 'boolean',
    DateField: 'date',
    DateTimeField: 'datetime',
    TimeField: 'time',
    UUIDField: 'uuid',
    EmailField: 'email',
    URLField: 'url',
    JSONField: 'json',
    FileField: 'file',
    ImageField: 'image',
    ForeignKey: 'uuid',
    AutoField: 'integer',
    BigAutoField: 'integer',
  };
  return typeMap[djangoType] || 'string';
}

function parsePythonEnums(content) {
  const enums = [];

  // Match Python Enum classes
  const enumRegex = /class\s+(\w+)\s*\(\s*(?:str,\s*)?Enum\s*\):\s*([\s\S]*?)(?=\nclass\s|\n@|\Z)/g;
  let enumMatch;

  while ((enumMatch = enumRegex.exec(content)) !== null) {
    const enumName = enumMatch[1];
    const enumBody = enumMatch[2];

    const values = [];
    const valueRegex = /(\w+)\s*=\s*['\"]?([^'"\n]+)['\"]?/g;
    let valueMatch;

    while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
      values.push({
        name: valueMatch[1],
        value: valueMatch[2].trim(),
      });
    }

    if (values.length > 0) {
      enums.push({ name: enumName, values });
    }
  }

  return enums;
}

async function parseNodeModels(projectRoot) {
  const result = {
    entities: [],
    relationships: [],
    enums: [],
  };

  // Try TypeORM
  const typeOrmModels = await parseTypeOrmModels(projectRoot);
  mergeModels(result, typeOrmModels);

  // Try Mongoose
  const mongooseModels = await parseMongooseModels(projectRoot);
  mergeModels(result, mongooseModels);

  // Try Drizzle
  const drizzleModels = await parseDrizzleModels(projectRoot);
  mergeModels(result, drizzleModels);

  return result;
}

async function parseTypeOrmModels(projectRoot) {
  const result = { entities: [], relationships: [] };

  const entityPaths = [
    'src/entities/**/*.{ts,js}',
    'src/models/**/*.{ts,js}',
    'src/entity/**/*.{ts,js}',
    '**/entities/**/*.{ts,js}',
  ];

  for (const pattern of entityPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
    });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for @Entity decorator
      if (!content.includes('@Entity')) continue;

      // Extract entity class
      const entityRegex = /@Entity\s*\(([^)]*)\)?\s*(?:export\s+)?class\s+(\w+)/g;
      let entityMatch;

      while ((entityMatch = entityRegex.exec(content)) !== null) {
        const entityOptions = entityMatch[1] || '';
        const className = entityMatch[2];

        // Extract table name
        const tableNameMatch = entityOptions.match(/name:\s*['\"](\w+)['"]/);
        const tableName = tableNameMatch ? tableNameMatch[1] : className.toLowerCase() + 's';

        const entity = {
          name: className,
          tableName,
          file,
          fields: [],
          primaryKey: null,
        };

        // Parse columns
        const columnRegex = /@(?:Column|PrimaryColumn|PrimaryGeneratedColumn)\s*\(([^)]*)\)?\s*(\w+)\s*[?!]?\s*:\s*(\w+)/g;
        let colMatch;

        while ((colMatch = columnRegex.exec(content)) !== null) {
          const colOptions = colMatch[1] || '';
          const fieldName = colMatch[2];
          const fieldType = colMatch[3];

          const field = {
            name: fieldName,
            type: mapTsType(fieldType),
            required: !colOptions.includes('nullable: true'),
            primaryKey: content.includes(`@Primary`) && content.includes(fieldName),
            unique: colOptions.includes('unique: true'),
          };

          entity.fields.push(field);

          if (field.primaryKey) {
            entity.primaryKey = fieldName;
          }
        }

        // Parse relationships
        const relTypes = ['ManyToOne', 'OneToMany', 'OneToOne', 'ManyToMany'];
        for (const relType of relTypes) {
          const relRegex = new RegExp(`@${relType}\\s*\\([^)]*\\)\\s*\\(?\\s*=>\\s*(\\w+)`, 'g');
          let relMatch;

          while ((relMatch = relRegex.exec(content)) !== null) {
            result.relationships.push({
              from: className,
              to: relMatch[1],
              type: relType.toLowerCase().replace('to', '-to-'),
            });
          }
        }

        result.entities.push(entity);
      }
    }
  }

  return result;
}

async function parseMongooseModels(projectRoot) {
  const result = { entities: [], relationships: [] };

  const modelPaths = [
    'src/models/**/*.{ts,js}',
    'models/**/*.{ts,js}',
    'src/schemas/**/*.{ts,js}',
  ];

  for (const pattern of modelPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
    });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for mongoose
      if (!content.includes('mongoose') && !content.includes('Schema')) continue;

      // Extract schema definitions
      const schemaRegex = /(?:const|let)\s+(\w+)Schema\s*=\s*new\s+(?:mongoose\.)?Schema\s*\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g;
      let schemaMatch;

      while ((schemaMatch = schemaRegex.exec(content)) !== null) {
        const modelName = schemaMatch[1];
        const schemaBody = schemaMatch[2];

        const entity = {
          name: modelName,
          tableName: modelName.toLowerCase() + 's',
          file,
          fields: [],
          primaryKey: '_id',
        };

        // Parse field definitions
        const fieldRegex = /(\w+)\s*:\s*(?:\{\s*type:\s*)?(\w+)/g;
        let fieldMatch;

        while ((fieldMatch = fieldRegex.exec(schemaBody)) !== null) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2];

          if (['type', 'required', 'default', 'unique', 'ref'].includes(fieldName)) continue;

          const field = {
            name: fieldName,
            type: mapMongooseType(fieldType),
            required: schemaBody.includes(`${fieldName}.*required.*true`),
          };

          // Check for references
          const refMatch = schemaBody.match(new RegExp(`${fieldName}[^}]*ref:\\s*['\"]?(\\w+)['\"]?`));
          if (refMatch) {
            result.relationships.push({
              from: modelName,
              to: refMatch[1],
              field: fieldName,
              type: 'reference',
            });
          }

          entity.fields.push(field);
        }

        result.entities.push(entity);
      }
    }
  }

  return result;
}

async function parseDrizzleModels(projectRoot) {
  const result = { entities: [], relationships: [] };

  const schemaPaths = [
    'src/db/schema/**/*.{ts,js}',
    'src/schema/**/*.{ts,js}',
    'drizzle/schema/**/*.{ts,js}',
    '**/schema.{ts,js}',
  ];

  for (const pattern of schemaPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
    });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for drizzle
      if (!content.includes('drizzle-orm') && !content.includes('pgTable') && !content.includes('mysqlTable')) continue;

      // Extract table definitions
      const tableRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['\"](\w+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
      let tableMatch;

      while ((tableMatch = tableRegex.exec(content)) !== null) {
        const varName = tableMatch[1];
        const tableName = tableMatch[2];
        const tableBody = tableMatch[3];

        const entity = {
          name: varName.charAt(0).toUpperCase() + varName.slice(1),
          tableName,
          file,
          fields: [],
          primaryKey: null,
        };

        // Parse column definitions
        const colRegex = /(\w+)\s*:\s*(uuid|text|varchar|integer|boolean|timestamp|serial|bigint|decimal|json)\s*\([^)]*\)/g;
        let colMatch;

        while ((colMatch = colRegex.exec(tableBody)) !== null) {
          const fieldName = colMatch[1];
          const colType = colMatch[2];

          const field = {
            name: fieldName,
            type: mapDrizzleType(colType),
            required: !tableBody.includes(`${fieldName}.*notNull`),
            primaryKey: tableBody.includes(`${fieldName}.*primaryKey`),
          };

          entity.fields.push(field);

          if (field.primaryKey) {
            entity.primaryKey = fieldName;
          }
        }

        // Check for references
        const refRegex = /(\w+).*references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)\)/g;
        let refMatch;

        while ((refMatch = refRegex.exec(tableBody)) !== null) {
          result.relationships.push({
            from: entity.name,
            to: refMatch[2].charAt(0).toUpperCase() + refMatch[2].slice(1),
            field: refMatch[1],
            foreignKey: `${refMatch[2]}.${refMatch[3]}`,
            type: 'many-to-one',
          });
        }

        result.entities.push(entity);
      }
    }
  }

  return result;
}

async function parsePrismaModels(projectRoot) {
  const result = {
    entities: [],
    relationships: [],
    enums: [],
  };

  const prismaPath = path.join(projectRoot, 'prisma/schema.prisma');
  if (!fs.existsSync(prismaPath)) return result;

  const content = fs.readFileSync(prismaPath, 'utf8');

  // Parse models
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let modelMatch;

  while ((modelMatch = modelRegex.exec(content)) !== null) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];

    const entity = {
      name: modelName,
      tableName: modelName.toLowerCase() + 's',
      file: 'prisma/schema.prisma',
      fields: [],
      primaryKey: null,
    };

    // Parse fields
    const lines = modelBody.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('@@'));

    for (const line of lines) {
      const fieldMatch = line.match(/^\s*(\w+)\s+(\w+)(\?)?(\[\])?\s*(@[^\n]*)?/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const isOptional = fieldMatch[3] === '?';
      const isArray = fieldMatch[4] === '[]';
      const attributes = fieldMatch[5] || '';

      const field = {
        name: fieldName,
        type: mapPrismaType(fieldType),
        required: !isOptional,
        isArray,
        primaryKey: attributes.includes('@id'),
        unique: attributes.includes('@unique'),
        default: null,
      };

      // Extract default
      const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
      if (defaultMatch) {
        field.default = defaultMatch[1];
      }

      // Check for relations
      if (attributes.includes('@relation')) {
        const relMatch = attributes.match(/@relation\(([^)]*)\)/);
        if (relMatch) {
          const relDef = relMatch[1];
          const fieldsMatch = relDef.match(/fields:\s*\[([^\]]+)\]/);
          const refsMatch = relDef.match(/references:\s*\[([^\]]+)\]/);

          result.relationships.push({
            from: modelName,
            to: fieldType,
            field: fieldName,
            foreignKey: fieldsMatch ? fieldsMatch[1].trim() : null,
            references: refsMatch ? refsMatch[1].trim() : null,
            type: isArray ? 'one-to-many' : 'many-to-one',
          });
        }
      }

      entity.fields.push(field);

      if (field.primaryKey) {
        entity.primaryKey = fieldName;
      }
    }

    result.entities.push(entity);
  }

  // Parse enums
  const enumRegex = /enum\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let enumMatch;

  while ((enumMatch = enumRegex.exec(content)) !== null) {
    const enumName = enumMatch[1];
    const enumBody = enumMatch[2];

    const values = enumBody.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//'))
      .map(v => ({ name: v, value: v }));

    result.enums.push({ name: enumName, values });
  }

  return result;
}

function mapPrismaType(prismaType) {
  const typeMap = {
    String: 'string',
    Int: 'integer',
    BigInt: 'integer',
    Float: 'number',
    Decimal: 'number',
    Boolean: 'boolean',
    DateTime: 'datetime',
    Json: 'json',
    Bytes: 'binary',
  };
  return typeMap[prismaType] || 'string';
}

function mapTsType(tsType) {
  const typeMap = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    Date: 'datetime',
    Buffer: 'binary',
  };
  return typeMap[tsType] || 'string';
}

function mapMongooseType(mongooseType) {
  const typeMap = {
    String: 'string',
    Number: 'number',
    Boolean: 'boolean',
    Date: 'datetime',
    Buffer: 'binary',
    ObjectId: 'uuid',
    Array: 'array',
    Map: 'object',
    Mixed: 'json',
  };
  return typeMap[mongooseType] || 'string';
}

function mapDrizzleType(drizzleType) {
  const typeMap = {
    uuid: 'uuid',
    text: 'string',
    varchar: 'string',
    integer: 'integer',
    serial: 'integer',
    bigint: 'integer',
    boolean: 'boolean',
    timestamp: 'datetime',
    decimal: 'number',
    json: 'json',
  };
  return typeMap[drizzleType] || 'string';
}

function mapPythonType(pyType) {
  const typeMap = {
    str: 'string',
    int: 'integer',
    float: 'number',
    bool: 'boolean',
    UUID: 'uuid',
    datetime: 'datetime',
    date: 'date',
    list: 'array',
    dict: 'object',
    List: 'array',
    Dict: 'object',
  };
  return typeMap[pyType] || 'string';
}

function extractTableName(classBody) {
  const tableMatch = classBody.match(/__tablename__\s*=\s*['\"](\w+)['"]/);
  return tableMatch ? tableMatch[1] : null;
}

export default { parseModels };
