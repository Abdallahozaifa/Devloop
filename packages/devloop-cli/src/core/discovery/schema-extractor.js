import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getExtractor, detectFramework } from '../../extractors/index.js';

/**
 * Extracts API schema from various sources
 * Supports: OpenAPI, FastAPI, Express routes, Django URLs, etc.
 *
 * Delegates to framework-specific extractors when available,
 * falls back to built-in extraction for other frameworks.
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

  // Determine backend framework
  const backendFramework = framework?.backend || (await detectFramework(projectRoot));

  // Try to use the new extractor system
  const extractor = await getExtractor(projectRoot, backendFramework);

  if (extractor) {
    // Use the new extractor system
    const routes = await extractor.discoverRoutes();
    const schemas = await extractor.extractSchemas();

    result.endpoints = routes.map((route) => ({
      method: route.method,
      path: route.path,
      file: route.file,
      auth: route.authType !== null && route.authType !== 'none',
      operationId: route.funcName,
      parameters: extractPathParams(route.path),
      requestBody: route.requestSchema?.modelName
        ? { schema: { $ref: route.requestSchema.modelName } }
        : null,
      returns: route.responseInfo?.model || null,
    }));

    // Convert schemas to expected format
    for (const [name, schema] of Object.entries(schemas)) {
      result.schemas[name] = {
        type: 'object',
        properties: [
          ...schema.requiredFields.map((f) => ({
            name: f.name,
            type: f.type,
            required: true,
          })),
          ...schema.optionalFields.map((f) => ({
            name: f.name,
            type: f.type,
            required: false,
          })),
        ],
      };
    }

    return result;
  }

  // Fall back to built-in framework-specific extraction for unsupported frameworks
  if (backendFramework === 'express' || backendFramework === 'fastify') {
    return await extractFromExpress(projectRoot);
  } else if (backendFramework === 'django') {
    return await extractFromDjango(projectRoot);
  }

  // Generic Node extraction
  if (
    framework?.language?.backend === 'javascript' ||
    framework?.language?.backend === 'typescript'
  ) {
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

  return operation.parameters.map((param) => ({
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
      const routeRegex =
        /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
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
  return (
    routeLine.includes('authenticate') ||
    routeLine.includes('auth') ||
    routeLine.includes('protect') ||
    routeLine.includes('requireAuth') ||
    routeLine.includes('isAuthenticated')
  );
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

  const urlPaths = ['**/urls.py', '**/api/**/urls.py'];

  for (const pattern of urlPaths) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: ['**/test*', '**/venv/**', '**/.venv/**'],
    });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract Django URL patterns
      const urlRegex =
        /path\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)(?:\.as_view\(\))?\s*(?:,\s*name\s*=\s*['"](\w+)['"])?\)/g;
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
    const lines = content.split('\n').filter((line) => !line.trim().startsWith('#'));

    // This is a placeholder - in production use js-yaml
    return JSON.parse(JSON.stringify({}));
  } catch (e) {
    return {};
  }
}

export default { extractSchema };
