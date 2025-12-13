import fs from 'fs';
import path from 'path';
import { registerFramework } from './framework-registry.js';

/**
 * FastAPI Framework Generator
 *
 * Generates Python code for FastAPI applications:
 * - SQLAlchemy models
 * - Pydantic schemas
 * - FastAPI endpoints
 */

const FASTAPI_CONFIG = {
  detect: (projectDir) => {
    // Check for FastAPI markers
    const markers = [
      'app/main.py',
      'app/api',
      'requirements.txt',
      'api/app/main.py'
    ];

    for (const marker of markers) {
      const fullPath = path.join(projectDir, marker);
      if (fs.existsSync(fullPath)) {
        // Check if FastAPI is in requirements
        if (marker === 'requirements.txt') {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes('fastapi')) return true;
        } else {
          // Check if the file imports FastAPI
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('fastapi') || content.includes('FastAPI')) return true;
          } catch (e) {
            // If it's a directory, it's a marker anyway
            if (marker.includes('api') && fs.statSync(fullPath).isDirectory()) {
              return true;
            }
          }
        }
      }
    }

    // Check pyproject.toml
    const pyproject = path.join(projectDir, 'pyproject.toml');
    if (fs.existsSync(pyproject)) {
      const content = fs.readFileSync(pyproject, 'utf-8');
      if (content.toLowerCase().includes('fastapi')) return true;
    }

    return false;
  },

  generator: {
    /**
     * Generate SQLAlchemy model from spec
     */
    generateModel: (modelName, modelSpec) => {
      const fields = [];
      const imports = new Set(['from sqlalchemy import Column']);

      for (const [fieldName, fieldSpec] of Object.entries(modelSpec.fields)) {
        const sqlType = mapToSQLAlchemy(fieldSpec.type);
        const extras = [];

        // Add imports based on type
        if (fieldSpec.type === 'uuid') {
          imports.add('from sqlalchemy.dialects.postgresql import UUID');
          imports.add('import uuid');
        }
        if (fieldSpec.type === 'datetime') {
          imports.add('from datetime import datetime');
        }
        if (fieldSpec.type === 'json') {
          imports.add('from sqlalchemy.dialects.postgresql import JSON');
        }

        // Handle generated fields
        if (fieldSpec.generated) {
          if (fieldSpec.type === 'uuid') {
            extras.push('primary_key=True');
            extras.push('default=uuid.uuid4');
          } else if (fieldSpec.type === 'datetime') {
            extras.push('default=datetime.utcnow');
          }
        }

        // Handle foreign keys
        if (fieldSpec.references) {
          const [table, col] = fieldSpec.references.split('.');
          imports.add('from sqlalchemy import ForeignKey');
          extras.push(`ForeignKey('${table}.${col}')`);
        }

        // Handle nullable
        if (!fieldSpec.required && !fieldSpec.generated) {
          extras.push('nullable=True');
        }

        // Handle unique
        if (fieldSpec.unique) {
          extras.push('unique=True');
        }

        // Handle index
        if (fieldSpec.index) {
          extras.push('index=True');
        }

        const extraStr = extras.length ? `, ${extras.join(', ')}` : '';
        fields.push(`    ${fieldName} = Column(${sqlType}${extraStr})`);
      }

      // Add type imports
      const typeImports = getTypeImports(modelSpec.fields);
      if (typeImports) {
        imports.add(`from sqlalchemy import ${typeImports}`);
      }

      return `${Array.from(imports).join('\n')}
from app.models.base import Base

class ${modelName}(Base):
    __tablename__ = '${modelName.toLowerCase()}s'

${fields.join('\n')}
`;
    },

    /**
     * Generate FastAPI endpoint from spec
     */
    generateEndpoint: (endpointSpec) => {
      const [method, urlPath] = endpointSpec.endpoint.split(' ');
      const funcName = urlPath
        .replace(/[\/{}]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();

      const params = [];
      const decoratorPath = urlPath.replace(/{(\w+)}/g, '{$1}');

      // Add auth dependency if required
      if (endpointSpec.auth === 'required') {
        params.push('current_user: User = Depends(get_current_user)');
      }

      // Add body parameter for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method) && endpointSpec.request?.body) {
        params.push('data: RequestSchema');
      }

      // Extract path params
      const pathParams = urlPath.match(/{(\w+)}/g) || [];
      for (const param of pathParams) {
        const paramName = param.slice(1, -1);
        params.push(`${paramName}: UUID`);
      }

      // Add query params
      if (endpointSpec.request?.query) {
        for (const [name, spec] of Object.entries(endpointSpec.request.query)) {
          const pyType = mapToPython(spec.type);
          const defaultVal = spec.default !== undefined ? ` = ${JSON.stringify(spec.default)}` : ' = None';
          params.push(`${name}: Optional[${pyType}]${defaultVal}`);
        }
      }

      // Add db session
      params.push('db: AsyncSession = Depends(get_db)');

      // Generate response handling
      const responses = generateResponses(endpointSpec.response);

      return `
@router.${method.toLowerCase()}('${decoratorPath}', response_model=ResponseSchema)
async def ${funcName}(
    ${params.join(',\n    ')}
):
    """
    ${endpointSpec.description || 'TODO: Add description'}
    """
    # TODO: Implement based on spec
    # Response codes: ${Object.keys(endpointSpec.response || {}).join(', ')}
    pass
`;
    },

    /**
     * Generate Pydantic schema from spec
     */
    generateSchema: (modelName, modelSpec) => {
      const createFields = [];
      const responseFields = [];

      for (const [fieldName, fieldSpec] of Object.entries(modelSpec.fields)) {
        const pyType = mapToPython(fieldSpec.type);

        // Create schema (excludes auto-generated fields)
        if (!fieldSpec.generated) {
          if (fieldSpec.required) {
            createFields.push(`    ${fieldName}: ${pyType}`);
          } else {
            createFields.push(`    ${fieldName}: Optional[${pyType}] = None`);
          }
        }

        // Response schema (includes all fields)
        responseFields.push(`    ${fieldName}: ${pyType}`);
      }

      return `from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class ${modelName}Create(BaseModel):
${createFields.join('\n') || '    pass'}

class ${modelName}Update(BaseModel):
${createFields.map(f => f.replace(': ', ': Optional[')).map(f => f.includes('Optional[Optional') ? f.replace('Optional[Optional', 'Optional') : f + ' = None').join('\n') || '    pass'}

class ${modelName}Response(BaseModel):
${responseFields.join('\n')}

    class Config:
        from_attributes = True
`;
    }
  },

  contractPatterns: {
    // Patterns to detect API calls in Python
    routeDefinition: /@router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/gi,
    dependsAuth: /Depends\(get_current_user\)/g,
    httpException: /HTTPException\(status_code=(\d+)/g,
    apiVersion: /\/api\/v\d+/g
  },

  filePaths: {
    models: 'app/models/',
    schemas: 'app/schemas/',
    endpoints: 'app/api/v1/endpoints/',
    main: 'app/main.py',
    dependencies: 'app/api/deps.py'
  }
};

/**
 * Map universal types to SQLAlchemy types
 */
function mapToSQLAlchemy(type) {
  const mapping = {
    uuid: 'UUID(as_uuid=True)',
    string: 'String',
    int: 'Integer',
    decimal: 'Numeric(10, 2)',
    boolean: 'Boolean',
    datetime: 'DateTime(timezone=True)',
    date: 'Date',
    json: 'JSON',
    email: 'String(255)',
    url: 'String(500)',
    array: 'ARRAY',
    text: 'Text'
  };
  return mapping[type] || 'String';
}

/**
 * Map universal types to Python types
 */
function mapToPython(type) {
  const mapping = {
    uuid: 'UUID',
    string: 'str',
    int: 'int',
    decimal: 'float',
    boolean: 'bool',
    datetime: 'datetime',
    date: 'date',
    email: 'str',
    url: 'str',
    array: 'list',
    object: 'dict',
    json: 'dict',
    enum: 'str'
  };
  return mapping[type] || 'str';
}

/**
 * Get SQLAlchemy type imports needed
 */
function getTypeImports(fields) {
  const types = new Set();
  for (const field of Object.values(fields)) {
    const sqlType = mapToSQLAlchemy(field.type);
    // Extract base type name
    const baseType = sqlType.split('(')[0];
    if (!['UUID', 'JSON', 'ARRAY'].includes(baseType)) {
      types.add(baseType);
    }
  }
  return Array.from(types).join(', ');
}

/**
 * Generate response documentation
 */
function generateResponses(responses) {
  if (!responses) return {};
  return Object.entries(responses).reduce((acc, [code, spec]) => {
    acc[code] = spec.description || spec.when || 'Response';
    return acc;
  }, {});
}

// Register FastAPI
registerFramework('fastapi', FASTAPI_CONFIG);

export default FASTAPI_CONFIG;
