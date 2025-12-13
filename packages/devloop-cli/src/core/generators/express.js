import fs from 'fs';
import path from 'path';
import { registerFramework } from './framework-registry.js';

/**
 * Express Framework Generator
 *
 * Generates JavaScript/TypeScript code for Express applications:
 * - Prisma models
 * - Express routes
 * - Middleware
 */

const EXPRESS_CONFIG = {
  detect: (projectDir) => {
    const packageJson = path.join(projectDir, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const content = fs.readFileSync(packageJson, 'utf-8');
        const pkg = JSON.parse(content);
        return !!(pkg.dependencies?.express || pkg.devDependencies?.express);
      } catch (e) {
        return false;
      }
    }

    // Also check for server/package.json (monorepo)
    const serverPackageJson = path.join(projectDir, 'server', 'package.json');
    if (fs.existsSync(serverPackageJson)) {
      try {
        const content = fs.readFileSync(serverPackageJson, 'utf-8');
        const pkg = JSON.parse(content);
        return !!(pkg.dependencies?.express || pkg.devDependencies?.express);
      } catch (e) {
        return false;
      }
    }

    return false;
  },

  generator: {
    /**
     * Generate Prisma model from spec
     */
    generateModel: (modelName, modelSpec) => {
      const fields = [];

      for (const [fieldName, fieldSpec] of Object.entries(modelSpec.fields)) {
        const prismaType = mapToPrisma(fieldSpec.type);
        const modifiers = [];

        // Handle generated fields
        if (fieldSpec.generated) {
          if (fieldSpec.type === 'uuid') {
            modifiers.push('@id @default(uuid())');
          } else if (fieldSpec.type === 'datetime' && fieldName === 'created_at') {
            modifiers.push('@default(now())');
          } else if (fieldSpec.type === 'datetime' && fieldName === 'updated_at') {
            modifiers.push('@updatedAt');
          }
        }

        // Handle foreign keys
        if (fieldSpec.references) {
          const [table, col] = fieldSpec.references.split('.');
          const relationName = capitalize(table.replace(/s$/, ''));
          fields.push(`  ${fieldName} String`);
          fields.push(`  ${fieldName.replace('_id', '')} ${relationName} @relation(fields: [${fieldName}], references: [${col}])`);
          continue;
        }

        // Handle optionals
        let typeStr = prismaType;
        if (!fieldSpec.required && !fieldSpec.generated) {
          typeStr += '?';
        }

        // Handle unique
        if (fieldSpec.unique) {
          modifiers.push('@unique');
        }

        // Handle default
        if (fieldSpec.default !== undefined) {
          if (typeof fieldSpec.default === 'string') {
            modifiers.push(`@default("${fieldSpec.default}")`);
          } else {
            modifiers.push(`@default(${fieldSpec.default})`);
          }
        }

        const modStr = modifiers.length ? ` ${modifiers.join(' ')}` : '';
        fields.push(`  ${fieldName} ${typeStr}${modStr}`);
      }

      const tableName = modelName.toLowerCase() + 's';

      return `model ${modelName} {
${fields.join('\n')}

  @@map("${tableName}")
}
`;
    },

    /**
     * Generate Express route from spec
     */
    generateEndpoint: (endpointSpec) => {
      const [method, urlPath] = endpointSpec.endpoint.split(' ');
      const expressPath = urlPath.replace(/{(\w+)}/g, ':$1');
      const handlerName = generateHandlerName(urlPath);

      const middleware = [];
      if (endpointSpec.auth === 'required') {
        middleware.push('authMiddleware');
      }

      // Generate validation if request body exists
      let validation = '';
      if (endpointSpec.request?.body) {
        validation = generateValidation(endpointSpec.request.body);
      }

      const middlewareStr = middleware.length ? `${middleware.join(', ')}, ` : '';

      // Generate response handling based on spec
      const responses = generateErrorHandlers(endpointSpec.response);

      return `
/**
 * ${endpointSpec.description || 'TODO: Add description'}
 */
router.${method.toLowerCase()}('${expressPath}', ${middlewareStr}async (req, res, next) => {
  try {
    ${validation}
    // TODO: Implement based on spec
    // Response codes: ${Object.keys(endpointSpec.response || {}).join(', ')}

    res.status(${method === 'POST' ? '201' : '200'}).json({ success: true });
  } catch (error) {
    ${responses}
    next(error);
  }
});
`;
    },

    /**
     * Generate TypeScript types from spec model
     */
    generateTypes: (modelName, modelSpec) => {
      const fields = [];
      const createFields = [];
      const updateFields = [];

      for (const [fieldName, fieldSpec] of Object.entries(modelSpec.fields)) {
        const tsType = mapToTypeScript(fieldSpec.type, fieldSpec);
        const optional = !fieldSpec.required && !fieldSpec.generated ? '?' : '';

        fields.push(`  ${fieldName}${optional}: ${tsType};`);

        if (!fieldSpec.generated) {
          createFields.push(`  ${fieldName}${optional}: ${tsType};`);
          updateFields.push(`  ${fieldName}?: ${tsType};`);
        }
      }

      return `export interface ${modelName} {
${fields.join('\n')}
}

export interface Create${modelName}Input {
${createFields.join('\n')}
}

export interface Update${modelName}Input {
${updateFields.join('\n')}
}
`;
    },

    /**
     * Generate validation middleware
     */
    generateValidation: (modelName, modelSpec) => {
      const validations = [];

      for (const [fieldName, fieldSpec] of Object.entries(modelSpec.fields)) {
        if (fieldSpec.generated) continue;

        const checks = [];

        if (fieldSpec.required) {
          checks.push(`body('${fieldName}').notEmpty().withMessage('${fieldName} is required')`);
        }

        if (fieldSpec.type === 'email') {
          checks.push(`body('${fieldName}').isEmail().withMessage('${fieldName} must be a valid email')`);
        }

        if (fieldSpec.type === 'uuid') {
          checks.push(`body('${fieldName}').isUUID().withMessage('${fieldName} must be a valid UUID')`);
        }

        if (fieldSpec.maxLength) {
          checks.push(`body('${fieldName}').isLength({ max: ${fieldSpec.maxLength} })`);
        }

        if (fieldSpec.min !== undefined) {
          checks.push(`body('${fieldName}').isNumeric().custom(val => val >= ${fieldSpec.min})`);
        }

        if (checks.length > 0) {
          validations.push(checks.join('.\n    '));
        }
      }

      return `export const validate${modelName} = [
  ${validations.join(',\n  ')},
  handleValidationErrors
];
`;
    }
  },

  contractPatterns: {
    // Patterns to detect API routes in Express
    routeDefinition: /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/gi,
    authMiddleware: /authMiddleware|authenticate|requireAuth/g,
    prismaQuery: /prisma\.(\w+)\.(find|create|update|delete)/g,
    apiVersion: /\/api\/v\d+/g
  },

  filePaths: {
    models: 'prisma/schema.prisma',
    routes: 'src/routes/',
    controllers: 'src/controllers/',
    middleware: 'src/middleware/',
    types: 'src/types/',
    validators: 'src/validators/'
  }
};

/**
 * Map universal types to Prisma types
 */
function mapToPrisma(type) {
  const mapping = {
    uuid: 'String',
    string: 'String',
    int: 'Int',
    decimal: 'Decimal',
    boolean: 'Boolean',
    datetime: 'DateTime',
    date: 'DateTime',
    json: 'Json',
    email: 'String',
    url: 'String',
    text: 'String'
  };
  return mapping[type] || 'String';
}

/**
 * Map universal types to TypeScript types
 */
function mapToTypeScript(type, fieldSpec = {}) {
  const mapping = {
    uuid: 'string',
    string: 'string',
    int: 'number',
    decimal: 'number',
    boolean: 'boolean',
    datetime: 'Date | string',
    date: 'Date | string',
    email: 'string',
    url: 'string',
    json: 'Record<string, unknown>',
    object: 'Record<string, unknown>',
    array: 'unknown[]'
  };

  // Handle enum
  if (type === 'enum' && fieldSpec.values) {
    return fieldSpec.values.map(v => `'${v}'`).join(' | ');
  }

  // Handle array with 'of' type
  if (type === 'array' && fieldSpec.of) {
    return `${fieldSpec.of}[]`;
  }

  return mapping[type] || 'unknown';
}

/**
 * Generate handler name from URL path
 */
function generateHandlerName(urlPath) {
  return urlPath
    .split('/')
    .filter(p => p && !p.startsWith('{') && !p.startsWith(':') && p !== 'api')
    .map((p, i) => i === 0 ? p : capitalize(p))
    .join('');
}

/**
 * Generate validation code for request body
 */
function generateValidation(bodySpec) {
  const required = Object.entries(bodySpec)
    .filter(([_, spec]) => spec.required)
    .map(([name]) => name);

  if (required.length === 0) return '';

  return `const { ${required.join(', ')} } = req.body;
    if (!${required.join(' || !')}) {
      return res.status(400).json({ detail: 'Missing required fields: ${required.join(', ')}' });
    }`;
}

/**
 * Generate error handlers based on response spec
 */
function generateErrorHandlers(responses) {
  if (!responses) return '';

  const handlers = [];

  if (responses['400']) {
    handlers.push(`if (error.name === 'ValidationError') {
      return res.status(400).json({ detail: error.message });
    }`);
  }

  if (responses['404']) {
    handlers.push(`if (error.name === 'NotFoundError') {
      return res.status(404).json({ detail: 'Resource not found' });
    }`);
  }

  if (responses['403']) {
    handlers.push(`if (error.name === 'ForbiddenError') {
      return res.status(403).json({ detail: 'Access denied' });
    }`);
  }

  return handlers.join('\n    ');
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Register Express
registerFramework('express', EXPRESS_CONFIG);

export default EXPRESS_CONFIG;
