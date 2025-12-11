import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Extracts API schema from various sources
 * Supports: OpenAPI, FastAPI, Express routes, Django URLs, etc.
 */
export async function extractSchema(projectRoot, framework) {
  const result = {
    endpoints: [],
    schemas: {},
    basePath: '/api/v1',
  };

  // Try OpenAPI first (most accurate)
  const openApiResult = await extractFromOpenApi(projectRoot, framework);
  if (openApiResult && openApiResult.endpoints.length > 0) {
    return openApiResult;
  }

  // Fall back to framework-specific extraction
  const backendFramework = framework?.backend;

  if (backendFramework === 'fastapi') {
    return await extractFromFastAPI(projectRoot);
  } else if (backendFramework === 'express' || backendFramework === 'fastify') {
    return await extractFromExpress(projectRoot);
  } else if (backendFramework === 'django') {
    return await extractFromDjango(projectRoot);
  }

  // Generic Python extraction
  if (framework?.language?.backend === 'python') {
    return await extractFromFastAPI(projectRoot);
  }

  // Generic Node extraction
  if (framework?.language?.backend === 'javascript' || framework?.language?.backend === 'typescript') {
    return await extractFromExpress(projectRoot);
  }

  return result;
}

async function extractFromOpenApi(projectRoot, framework) {
  const openApiPaths = [
    'openapi.json',
    'openapi.yaml',
    'swagger.json',
    'swagger.yaml',
    'api/openapi.json',
    'docs/openapi.json',
    'static/openapi.json',
  ];

  for (const specPath of openApiPaths) {
    const fullPath = path.join(projectRoot, specPath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const isYaml = specPath.endsWith('.yaml') || specPath.endsWith('.yml');

        let spec;
        if (isYaml) {
          // Simple YAML parsing for common patterns
          spec = parseSimpleYaml(content);
        } else {
          spec = JSON.parse(content);
        }

        return parseOpenApiSpec(spec);
      } catch (e) {
        console.error(`Error parsing ${specPath}:`, e.message);
      }
    }
  }

  return null;
}

function parseOpenApiSpec(spec) {
  const result = {
    endpoints: [],
    schemas: {},
    basePath: spec.servers?.[0]?.url || '/api/v1',
  };

  // Extract schemas
  if (spec.components?.schemas) {
    result.schemas = spec.components.schemas;
  }

  // Extract endpoints
  if (spec.paths) {
    for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete'];

      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method];
          const endpoint = {
            method: method.toUpperCase(),
            path: pathStr,
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            auth: hasSecurityRequirement(operation, spec),
            parameters: extractParameters(operation),
            requestBody: extractRequestBody(operation),
            responses: extractResponses(operation),
          };

          result.endpoints.push(endpoint);
        }
      }
    }
  }

  return result;
}

function hasSecurityRequirement(operation, spec) {
  // Check operation-level security
  if (operation.security) {
    return operation.security.length > 0;
  }
  // Check global security
  if (spec.security) {
    return spec.security.length > 0;
  }
  return false;
}

function extractParameters(operation) {
  if (!operation.parameters) return [];

  return operation.parameters.map(param => ({
    name: param.name,
    in: param.in,
    required: param.required || false,
    type: param.schema?.type || 'string',
    description: param.description,
  }));
}

function extractRequestBody(operation) {
  if (!operation.requestBody) return null;

  const content = operation.requestBody.content;
  if (content?.['application/json']?.schema) {
    const schema = content['application/json'].schema;
    return {
      required: operation.requestBody.required || false,
      schema: resolveSchemaRef(schema),
    };
  }

  return null;
}

function extractResponses(operation) {
  if (!operation.responses) return {};

  const responses = {};
  for (const [code, response] of Object.entries(operation.responses)) {
    const content = response.content;
    if (content?.['application/json']?.schema) {
      responses[code] = {
        description: response.description,
        schema: resolveSchemaRef(content['application/json'].schema),
      };
    } else {
      responses[code] = {
        description: response.description,
      };
    }
  }

  return responses;
}

function resolveSchemaRef(schema) {
  if (schema.$ref) {
    // Return just the schema name for now
    return { $ref: schema.$ref.split('/').pop() };
  }
  return schema;
}

async function extractFromFastAPI(projectRoot) {
  const result = {
    endpoints: [],
    schemas: {},
    basePath: '/api/v1',
  };

  // Find Python API files
  const apiPaths = [
    'app/api/**/*.py',
    'api/app/api/**/*.py',
    'backend/app/api/**/*.py',
    'src/api/**/*.py',
    '**/routers/**/*.py',
    '**/endpoints/**/*.py',
  ];

  const processedFiles = new Set();

  for (const pattern of apiPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/test_*', '**/__pycache__/**', '**/*_test.py'],
    });

    for (const file of files) {
      if (processedFiles.has(file)) continue;
      processedFiles.add(file);

      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract router prefix
      const prefixMatch = content.match(/prefix\s*=\s*['"](\/[^'"]+)['"]/);
      const routerPrefix = prefixMatch ? prefixMatch[1] : '';

      // Extract endpoints
      const decoratorRegex = /@(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi;
      let match;

      while ((match = decoratorRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const endpointPath = match[2];
        const fullPath = routerPrefix + endpointPath;

        // Try to extract function info
        const funcInfo = extractPythonFunctionInfo(content, match.index);

        // Determine if auth is required
        const hasAuth = checkFastAPIAuth(content, match.index);

        // Extract path parameters
        const pathParams = extractPathParams(endpointPath);

        result.endpoints.push({
          method,
          path: fullPath,
          file,
          auth: hasAuth,
          operationId: funcInfo.name,
          summary: funcInfo.docstring,
          parameters: pathParams,
          requestBody: funcInfo.requestBody,
          returns: funcInfo.returns,
        });
      }

      // Extract Pydantic schemas
      const schemaMatches = content.matchAll(/class\s+(\w+)\s*\((?:BaseModel|Schema|SQLModel)[^)]*\):\s*([^]*?)(?=\nclass\s|\n@|\Z)/g);
      for (const schemaMatch of schemaMatches) {
        const schemaName = schemaMatch[1];
        const schemaBody = schemaMatch[2];

        result.schemas[schemaName] = extractPydanticFields(schemaBody);
      }
    }
  }

  return result;
}

function extractPythonFunctionInfo(content, decoratorIndex) {
  const result = {
    name: null,
    docstring: null,
    requestBody: null,
    returns: null,
  };

  // Find the function definition after the decorator
  const afterDecorator = content.slice(decoratorIndex);
  const funcMatch = afterDecorator.match(/(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/);

  if (funcMatch) {
    result.name = funcMatch[1];
    const params = funcMatch[2];

    // Look for request body schema
    const bodyMatch = params.match(/(\w+)\s*:\s*(\w+(?:Schema|Request|Create|Update|Input))/);
    if (bodyMatch) {
      result.requestBody = { schema: { $ref: bodyMatch[2] } };
    }

    // Look for return type
    const returnMatch = afterDecorator.match(/def\s+\w+[^)]+\)\s*->\s*(\w+)/);
    if (returnMatch) {
      result.returns = returnMatch[1];
    }

    // Extract docstring
    const docMatch = afterDecorator.match(/def\s+\w+[^:]+:\s*"""([^"]+)"""/);
    if (docMatch) {
      result.docstring = docMatch[1].trim();
    }
  }

  return result;
}

function checkFastAPIAuth(content, position) {
  // Look backwards for Depends with auth
  const before = content.slice(Math.max(0, position - 500), position);
  if (before.includes('get_current_user') || before.includes('Depends(') && before.includes('auth')) {
    return true;
  }

  // Look in function params
  const after = content.slice(position, position + 500);
  const funcMatch = after.match(/def\s+\w+\s*\([^)]+\)/);
  if (funcMatch && (funcMatch[0].includes('current_user') || funcMatch[0].includes('get_current_user'))) {
    return true;
  }

  return false;
}

function extractPathParams(pathStr) {
  const params = [];
  const paramRegex = /\{(\w+)\}/g;
  let match;

  while ((match = paramRegex.exec(pathStr)) !== null) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      type: match[1].includes('id') ? 'uuid' : 'string',
    });
  }

  return params;
}

function extractPydanticFields(schemaBody) {
  const fields = [];
  const fieldRegex = /(\w+)\s*:\s*(?:Optional\[)?(\w+)(?:\])?\s*(?:=\s*([^,\n]+))?/g;
  let match;

  while ((match = fieldRegex.exec(schemaBody)) !== null) {
    const fieldName = match[1];
    let fieldType = match[2];
    const defaultValue = match[3];

    // Convert Python types to JSON schema types
    const typeMap = {
      str: 'string',
      int: 'integer',
      float: 'number',
      bool: 'boolean',
      UUID: 'uuid',
      datetime: 'datetime',
      date: 'date',
      EmailStr: 'email',
      HttpUrl: 'url',
      List: 'array',
      Dict: 'object',
    };

    fields.push({
      name: fieldName,
      type: typeMap[fieldType] || fieldType.toLowerCase(),
      required: !defaultValue && !match[0].includes('Optional'),
    });
  }

  return { type: 'object', properties: fields };
}

async function extractFromExpress(projectRoot) {
  const result = {
    endpoints: [],
    schemas: {},
    basePath: '/api',
  };

  const routePaths = [
    'src/routes/**/*.{js,ts}',
    'routes/**/*.{js,ts}',
    'api/routes/**/*.{js,ts}',
    'server/routes/**/*.{js,ts}',
    'src/api/**/*.{js,ts}',
  ];

  for (const pattern of routePaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
    });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract base path from router
      const basePath = extractExpressBasePath(file, content);

      // Extract routes
      const routeRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let match;

      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        const fullPath = basePath + routePath;

        // Check for auth middleware
        const hasAuth = checkExpressAuth(content, match.index);

        // Extract path params
        const pathParams = extractExpressPathParams(routePath);

        result.endpoints.push({
          method,
          path: fullPath,
          file,
          auth: hasAuth,
          parameters: pathParams,
        });
      }
    }
  }

  return result;
}

function extractExpressBasePath(file, content) {
  // Try to infer from file name
  const fileName = path.basename(file, path.extname(file));
  if (fileName !== 'index') {
    return `/api/${fileName}`;
  }

  // Look for router.use or app.use with base path
  const useMatch = content.match(/(?:router|app)\.use\s*\(\s*['"`](\/[^'"`]+)['"`]/);
  if (useMatch) {
    return useMatch[1];
  }

  return '/api';
}

function checkExpressAuth(content, position) {
  // Look for auth middleware in the route handler
  const routeLine = content.slice(position, position + 300);
  return routeLine.includes('authenticate') ||
    routeLine.includes('auth') ||
    routeLine.includes('protect') ||
    routeLine.includes('requireAuth') ||
    routeLine.includes('isAuthenticated');
}

function extractExpressPathParams(routePath) {
  const params = [];
  const paramRegex = /:(\w+)/g;
  let match;

  while ((match = paramRegex.exec(routePath)) !== null) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      type: match[1].includes('id') ? 'uuid' : 'string',
    });
  }

  return params;
}

async function extractFromDjango(projectRoot) {
  const result = {
    endpoints: [],
    schemas: {},
    basePath: '/api',
  };

  const urlPaths = [
    '**/urls.py',
    '**/api/**/urls.py',
  ];

  for (const pattern of urlPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/test*', '**/venv/**', '**/.venv/**'],
    });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract Django URL patterns
      const urlRegex = /path\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)(?:\.as_view\(\))?\s*(?:,\s*name\s*=\s*['"](\w+)['"])?\)/g;
      let match;

      while ((match = urlRegex.exec(content)) !== null) {
        const urlPath = '/' + match[1];
        const viewName = match[2];
        const name = match[3];

        // Infer HTTP method from view name
        const method = inferDjangoMethod(viewName);

        result.endpoints.push({
          method,
          path: urlPath,
          file,
          operationId: name || viewName,
        });
      }
    }
  }

  return result;
}

function inferDjangoMethod(viewName) {
  const name = viewName.toLowerCase();
  if (name.includes('create') || name.includes('post')) return 'POST';
  if (name.includes('update') || name.includes('put')) return 'PUT';
  if (name.includes('patch')) return 'PATCH';
  if (name.includes('delete') || name.includes('destroy')) return 'DELETE';
  if (name.includes('list') || name.includes('retrieve') || name.includes('get')) return 'GET';
  return 'GET';
}

function parseSimpleYaml(content) {
  // Very basic YAML parsing - only handles simple structures
  // For production, use a proper YAML parser
  try {
    // Remove comments
    const lines = content.split('\n').filter(line => !line.trim().startsWith('#'));

    // This is a placeholder - in production use js-yaml
    return JSON.parse(JSON.stringify({}));
  } catch (e) {
    return {};
  }
}

export default { extractSchema };
