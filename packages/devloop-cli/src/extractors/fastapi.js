import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { BaseExtractor } from './base.js';

/**
 * FastAPIExtractor - Extracts API information from FastAPI/Python projects
 *
 * Handles:
 * - Route decorators (@app.get, @router.post, etc.)
 * - Pydantic models for request/response validation
 * - FastAPI dependency injection for auth (Depends(get_current_user))
 * - Header requirements
 */
export class FastAPIExtractor extends BaseExtractor {
  static get frameworkName() {
    return 'fastapi';
  }

  async discoverRoutes() {
    const endpoints = [];

    // Find Python files that likely contain routes
    const pythonFiles = await this.findFiles([
      'app/**/*.py',
      'api/**/*.py',
      'src/**/*.py',
      '**/endpoints/**/*.py',
      '**/routes/**/*.py',
      '**/routers/**/*.py',
    ]);

    for (const file of pythonFiles) {
      const fileEndpoints = await this.extractEndpointsFromFile(file);
      endpoints.push(...fileEndpoints);
    }

    // Deduplicate by method + path
    const seen = new Set();
    return endpoints.filter((ep) => {
      const key = `${ep.method}:${ep.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async extractEndpointsFromFile(filePath) {
    const endpoints = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const relPath = path.relative(this.projectPath, filePath);

      // Infer router prefix from file path and content
      const inferredPrefix = this.inferPrefixFromFilePath(relPath, content);

      // Match FastAPI route decorators
      // @router.get("/path") or @app.get("/path")
      const routeRegex =
        /@(?:router|app)\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/gi;

      let match;
      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];

        // Get context around this match for analysis
        const startIdx = match.index;
        const contextEnd = Math.min(startIdx + 2000, content.length);
        const context = content.substring(startIdx, contextEnd);

        // Extract function name
        const funcMatch = context.match(/async\s+def\s+(\w+)/);
        const funcName = funcMatch ? funcMatch[1] : 'unknown';

        // Extract auth, headers, dependencies
        const requiredHeaders = this.extractRequiredHeaders(context);
        const authType = this.extractAuthType(context);
        const dependencies = this.extractDependencies(context);
        const responseInfo = this.extractResponseInfo(context);
        const requestSchema = this.extractRequestSchema(context, method);

        // Build full path with inferred prefix
        let fullPath = routePath;
        if (
          inferredPrefix &&
          !routePath.startsWith('/api') &&
          !routePath.startsWith(inferredPrefix)
        ) {
          fullPath = inferredPrefix + routePath;
        }

        endpoints.push({
          method,
          path: fullPath,
          funcName,
          file: relPath,
          line: this.getLineNumber(content, match.index),
          requiredHeaders,
          authType,
          dependencies,
          responseInfo,
          requestSchema,
        });
      }
    } catch (e) {
      console.warn(
        chalk.yellow(`Warning: Could not parse ${filePath}: ${e.message}`)
      );
    }

    return endpoints;
  }

  async extractSchemas() {
    const schemas = {};

    // Find Pydantic schema files
    const schemaFiles = await this.findFiles([
      'app/**/schemas/**/*.py',
      'api/**/schemas/**/*.py',
      'src/**/schemas/**/*.py',
      'app/schemas.py',
      'api/schemas.py',
      '**/schemas.py',
    ]);

    for (const file of schemaFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const relPath = path.relative(this.projectPath, file);

        // Match Pydantic class definitions
        const classRegex =
          /class\s+(\w+)\s*\([^)]*(?:BaseModel|Schema)[^)]*\)\s*:\s*([\s\S]*?)(?=\nclass\s|\n(?:def|async)\s|$)/g;

        let classMatch;
        while ((classMatch = classRegex.exec(content)) !== null) {
          const className = classMatch[1];
          const classBody = classMatch[2];

          const fields = this.extractPydanticFields(classBody);

          if (fields.required.length > 0 || fields.optional.length > 0) {
            schemas[className] = {
              file: relPath,
              requiredFields: fields.required,
              optionalFields: fields.optional,
            };
          }
        }
      } catch (e) {
        console.warn(
          chalk.yellow(`Warning: Could not parse schema file ${file}: ${e.message}`)
        );
      }
    }

    return schemas;
  }

  async detectAuth(route) {
    const authInfo = {
      type: route.authType || 'none',
      required: route.authType !== null && route.authType !== 'none',
      scopes: [],
    };

    // Extract scopes from dependencies if present
    if (route.dependencies) {
      for (const dep of route.dependencies) {
        if (dep.includes('scope') || dep.includes('permission')) {
          authInfo.scopes.push(dep);
        }
      }
    }

    return authInfo;
  }

  async mapRelationships() {
    const relationships = [];
    const routes = await this.discoverRoutes();
    const schemas = await this.extractSchemas();

    for (const route of routes) {
      const rel = {
        route: route.path,
        method: route.method,
        requestSchema: null,
        responseSchema: null,
      };

      // Map request schema
      if (route.requestSchema?.modelName) {
        if (schemas[route.requestSchema.modelName]) {
          rel.requestSchema = route.requestSchema.modelName;
        }
      }

      // Map response schema from response_model
      if (route.responseInfo?.model) {
        if (schemas[route.responseInfo.model]) {
          rel.responseSchema = route.responseInfo.model;
        }
      }

      if (rel.requestSchema || rel.responseSchema) {
        relationships.push(rel);
      }
    }

    return relationships;
  }

  // ============================================
  // FastAPI-specific helper methods
  // ============================================

  inferPrefixFromFilePath(filePath, content) {
    const pathMappings = {
      scope_items: '/projects',
      milestones: '/projects',
      payments: '/projects',
      disputes: '/projects',
      scope: '/projects',
      deliverables: '/projects',
      contracts: '/projects',
      projects: '/projects',
      clients: '/clients',
      invoices: '/invoices',
      users: '/users',
      auth: '/auth',
      health: '',
      webhooks: '/webhooks',
      billing: '/billing',
      subscriptions: '/subscriptions',
      notifications: '/notifications',
      settings: '/settings',
      profile: '/profile',
      teams: '/teams',
      portal: '/portal',
      public: '',
      request: '/request',
    };

    const fileName = filePath
      .split('/')
      .pop()
      .replace('.py', '')
      .replace('.ts', '')
      .replace('.js', '');

    for (const [key, prefix] of Object.entries(pathMappings)) {
      if (fileName.includes(key) || fileName === key) {
        return prefix;
      }
    }

    // Try to infer from path structure
    const pathParts = filePath.split('/');
    const endpointsIdx = pathParts.findIndex(
      (p) => p === 'endpoints' || p === 'routes' || p === 'routers'
    );
    if (endpointsIdx !== -1 && endpointsIdx < pathParts.length - 1) {
      const resourceName = pathParts[endpointsIdx + 1]
        .replace('.py', '')
        .replace(/_/g, '-');
      if (
        resourceName &&
        resourceName !== 'index' &&
        resourceName !== 'main' &&
        resourceName !== '__init__'
      ) {
        return `/${resourceName}`;
      }
    }

    return '';
  }

  extractRequiredHeaders(code) {
    const headers = [];

    // FastAPI Header() dependency pattern
    const headerRegex =
      /(\w+)\s*:\s*(?:str|Optional\[str\])\s*=\s*Header\s*\([^)]*alias\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = headerRegex.exec(code)) !== null) {
      headers.push({
        name: match[2],
        paramName: match[1],
        required: !code.includes('Optional') || !match[0].includes('Optional'),
      });
    }

    // Check for common header access patterns
    if (code.includes('X-Portal-Token') || code.includes('x-portal-token')) {
      if (!headers.some((h) => h.name === 'X-Portal-Token')) {
        headers.push({ name: 'X-Portal-Token', required: true });
      }
    }

    if (code.includes('Authorization') || code.includes('authorization')) {
      if (!headers.some((h) => h.name === 'Authorization')) {
        headers.push({ name: 'Authorization', required: true });
      }
    }

    return headers;
  }

  extractAuthType(code) {
    if (code.includes('get_current_user') || code.includes('Depends(get_current')) {
      return 'bearer';
    }
    if (code.includes('X-Portal-Token') || code.includes('portal_token')) {
      return 'portal-token';
    }
    if (code.includes('X-API-Key') || code.includes('api_key')) {
      return 'api-key';
    }
    if (code.includes('HTTPBasicCredentials') || code.includes('HTTPBasic')) {
      return 'basic';
    }
    return null;
  }

  extractDependencies(code) {
    const deps = [];
    const dependsRegex = /Depends\s*\(\s*(\w+)/g;
    let match;
    while ((match = dependsRegex.exec(code)) !== null) {
      deps.push(match[1]);
    }
    return deps;
  }

  extractResponseInfo(code) {
    const info = {};

    const responseModelMatch = code.match(/response_model\s*=\s*(\w+)/);
    if (responseModelMatch) {
      info.model = responseModelMatch[1];
    }

    const statusCodeMatch = code.match(/status_code\s*=\s*(\d+)/);
    if (statusCodeMatch) {
      info.statusCode = parseInt(statusCodeMatch[1]);
    }

    return info;
  }

  extractRequestSchema(code, method) {
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return null;
    }

    const schema = {
      modelName: null,
      requiredFields: [],
      optionalFields: [],
    };

    // Look for request body parameter patterns
    const bodyParamRegex =
      /(?:data|body|request|payload|input)\s*:\s*(\w+)(?:\s*=\s*Body)?/i;
    const bodyMatch = code.match(bodyParamRegex);

    if (bodyMatch) {
      schema.modelName = bodyMatch[1];
    }

    return schema;
  }

  extractPydanticFields(classBody) {
    const required = [];
    const optional = [];

    const lines = classBody.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments, empty lines, methods
      if (
        !trimmed ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('def ') ||
        trimmed.startsWith('async ') ||
        trimmed.startsWith('@')
      ) {
        continue;
      }

      // Pattern: field_name: type = default or field_name: type
      const fieldMatch = trimmed.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);

      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2].trim();
        const defaultValue = fieldMatch[3]?.trim();

        // Skip private fields and class config
        if (
          fieldName.startsWith('_') ||
          fieldName === 'Config' ||
          fieldName === 'model_config'
        ) {
          continue;
        }

        const isOptionalType =
          fieldType.includes('Optional') ||
          fieldType.includes('| None') ||
          fieldType.includes('None |');

        const hasDefault =
          defaultValue !== undefined &&
          defaultValue !== '' &&
          !defaultValue.startsWith('Field(...)');

        const isFieldRequired =
          defaultValue?.includes('Field(...)') ||
          defaultValue?.includes('Field(default=...)');

        if (isFieldRequired || (!hasDefault && !isOptionalType)) {
          required.push({
            name: fieldName,
            type: fieldType,
          });
        } else {
          optional.push({
            name: fieldName,
            type: fieldType,
            default: defaultValue,
          });
        }
      }
    }

    return { required, optional };
  }
}

export default FastAPIExtractor;
