import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import chalk from 'chalk';
import { glob } from 'glob';
import { analyzeBackend, extractPydanticSchemas, findFrontendPaths } from '../backend-analyzer.js';

const UNIVERSAL_SPEC_PROMPT = `You are generating a UNIVERSAL SPECIFICATION for a software application.

Analyze the codebase and generate a SINGLE comprehensive YAML spec with ALL of these sections:

## OUTPUT FORMAT

YAML EXAMPLE:
name: [Application Name]
version: '1.0'
description: [What this application does]

# Data models extracted from backend
models:
  [ModelName]:
    description: [What this model represents]
    fields:
      id: { type: uuid, generated: true }
      [field]: { type: [type], required: [bool], default: [value] }
      [foreign_key]: { type: uuid, references: [table.column] }

# API endpoints with ALL response codes - MUST LINK TO MODELS
api:
  - endpoint: [METHOD] [PATH]
    auth: [required|optional|none]
    description: [What this endpoint does]
    request:
      body: [ModelName]  # REQUIRED: Link to model for POST/PUT/PATCH
      query:
        [param]: { type: [type], default: [value] }
    response:
      200:
        when: success
        body: [ModelName]  # REQUIRED: Link to response model
      201:
        when: created
        body: [ModelName]
      400:
        when: invalid request format
        body: { error: string }
      401:
        when: not authenticated
        body: { detail: string }
      403:
        when: not authorized to access this resource
        body: { detail: string }
      404:
        when: resource not found
        body: { detail: string }
      422:
        when: validation error
        body: { detail: array }

# Business rules in plain English
rules:
  - '[Rule 1]'
  - '[Rule 2]'

# Frontend components - MUST INCLUDE DETAILED BEHAVIORS
ui:
  components:
    [ComponentName]:
      location: [file path]
      description: [What it does]
      props:
        [prop]: [type]
      behavior:
        - 'Calls [METHOD] [PATH] when [action]'
        - 'Shows loading state while fetching'
        - 'Displays error message on failure'
        - 'Validates [field] before submission'
      states:
        - loading: 'Shows spinner'
        - error: 'Shows error banner'
        - empty: 'Shows empty state message'
        - success: 'Shows [data]'
  routes:
    [/path]: [ComponentName]

# Frontend-backend contracts
contracts:
  - name: [Contract name]
    file: '[glob pattern]'
    must_contain:
      - '[required pattern]'
    must_not_contain:
      - '[forbidden pattern]'

# COMPREHENSIVE TESTS - Generate ALL test types for each endpoint
tests:
  api:
    # AUTH TEST - Unauthenticated request returns 401
    - name: '[METHOD] [PATH] requires authentication'
      as: guest
      request:
        method: [METHOD]
        path: [PATH]
      expect:
        status: 401
        bodyShape:
          detail: string

    # VALIDATION TEST - Missing required field returns 422
    - name: '[METHOD] [PATH] validates required fields'
      as: user
      request:
        method: [METHOD]
        path: [PATH]
        body: {}  # Empty or missing required fields
      expect:
        status: 422
        bodyShape:
          detail: array

    # HAPPY PATH TEST - Valid request succeeds with bodyShape
    - name: '[METHOD] [PATH] succeeds with valid data'
      as: user
      request:
        method: [METHOD]
        path: [PATH]
        body:
          [field]: [valid_value]
      expect:
        status: [200|201]
        bodyHas:
          - id
          - [other_expected_fields]
        bodyShape:
          id: uuid
          [field]: [type]
          created_at: datetime

    # NOT FOUND TEST - Invalid ID returns 404
    - name: '[METHOD] [PATH]/:id returns 404 for invalid ID'
      as: user
      request:
        method: [METHOD]
        path: [PATH]/00000000-0000-0000-0000-000000000000
      expect:
        status: 404
        bodyShape:
          detail: string

    # AUTHORIZATION TEST - Other user's resource returns 403
    - name: '[METHOD] [PATH] returns 403 for other users resource'
      as: other_user
      request:
        method: [METHOD]
        path: [PATH]
      expect:
        status: 403
        bodyShape:
          detail: string

  ui:
    - name: [Test name]
      steps:
        - goto: [path]
        - click: '[selector]'
        - wait: [ms]
      expect:
        - visible: '[text]'
        - not_visible: '[text]'

## BODYSHAPE TYPE REFERENCE

Use these types in bodyShape validations:
- uuid: UUID string format
- string: Any string
- number: Integer or float
- boolean: true/false
- array: JSON array
- object: JSON object
- enum: One of specific values
- datetime: ISO 8601 timestamp
- email: Email format
- url: URL format

## REQUIREMENTS

1. MODEL → ROUTE LINKING (CRITICAL)
   - Every POST/PUT/PATCH endpoint MUST specify request body model
   - Every endpoint MUST specify response model for each status code
   - Use model names from the models section

2. COMPREHENSIVE TESTS (CRITICAL)
   For EACH API endpoint that has auth, generate ALL of these tests:
   - Auth test: guest → 401
   - Validation test: empty/invalid body → 422 (for POST/PUT/PATCH)
   - Happy path test: valid data → 200/201 with bodyHas AND bodyShape
   - Not found test: invalid ID → 404 (for /:id routes)
   - Authorization test: other_user → 403 (for user-owned resources)

3. BODYSHAPE VALIDATION (CRITICAL)
   - Every successful response test MUST include bodyShape
   - Use the types from the BODYSHAPE TYPE REFERENCE
   - Include ALL expected response fields

4. COMPONENT BEHAVIORS (CRITICAL)
   For each UI component, include:
   - What API calls it makes (format: "Calls [METHOD] [PATH] when [action]")
   - User interactions (clicks, form submissions, navigation)
   - States it displays (loading, error, empty, success)
   - Any field validations it performs

## CRITICAL

- Output ONE complete YAML file
- Include EVERY section (models, api, rules, ui, contracts, tests)
- Be thorough - this spec should fully describe the application
- For each API endpoint, include ALL possible response codes
- Generate 3-5 tests per endpoint (not just auth tests!)
- Every test must have bodyShape validation
- Component behaviors must be specific (API calls, states, interactions)

## WARNINGS AND CONSIDERATIONS

- Placeholder for ANTHROPIC_API_KEY if not set.
- Limited parsing for UI components (React/Next.js specific).

Return ONLY raw YAML. Do not wrap in markdown. Do not include \`\`\` in output.
`;

/**
 * Generate a universal spec for the entire application
 * @param {string} projectDir - Project directory
 * @param {Object} options - Generation options
 */
export async function generateUniversalSpec(projectDir, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new Anthropic({ apiKey });

  console.log(chalk.cyan('🔍 Analyzing codebase for universal spec...\n'));

  // Analyze backend
  const backendInfo = await analyzeBackend(projectDir);
  const schemas = await extractPydanticSchemas(projectDir);

  // Analyze frontend
  const frontendInfo = await analyzeFrontend(projectDir);

  console.log(chalk.gray(`   Backend: ${backendInfo.endpoints?.length || 0} endpoints`));
  console.log(chalk.gray(`   Schemas: ${Object.keys(schemas).length} models`));
  console.log(chalk.gray(`   Frontend: ${frontendInfo.components?.length || 0} components`));
  console.log('');

  // Get project name
  const projectName = inferProjectName(projectDir);

  // Generate spec via AI
  console.log(chalk.cyan('🤖 Generating universal spec...\n'));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: `${UNIVERSAL_SPEC_PROMPT}` +
`
## CODEBASE ANALYSIS

### Project: ${projectName}

### Backend Endpoints (${backendInfo.endpoints?.length || 0} total)
${JSON.stringify(backendInfo.endpoints?.slice(0, 60), null, 2)}

### Pydantic Schemas (${Object.keys(schemas).length} total)
${JSON.stringify(schemas, null, 2)}

### Frontend Components (${frontendInfo.components?.length || 0} total)
${JSON.stringify(frontendInfo.components?.slice(0, 40), null, 2)}

### Frontend Routes
${JSON.stringify(frontendInfo.routes, null, 2)}

Generate the complete universal spec now. Make sure to include ALL sections: models, api, rules, ui, contracts, tests.
`
    }]
  });

  // Parse response
  const content = response.content[0].text;
  const yamlMatch = content.match(/```yaml([\s\S]*?)```/);

  let spec;
  try {
    if (yamlMatch) {
      spec = yaml.parse(yamlMatch[1]);
    } else {
      spec = yaml.parse(content);
    }
  } catch (parseError) {
    console.log(chalk.yellow(`⚠️  YAML parse warning: ${parseError.message}`));
    // Try to extract the spec from the content
    spec = extractSpecFromContent(content);
  }

  // Ensure all sections exist
  spec = ensureAllSections(spec, projectName, backendInfo, schemas, frontendInfo);

  // Post-process to fix common issues
  console.log(chalk.cyan('🔧 Post-processing spec...'));
  spec = fixVariableReferences(spec);
  spec = populateRequestBodies(spec);
  spec = fixActionEndpointStatusCodes(spec);
  spec = generateModelSpecificShapes(spec);
  spec = linkModelsToRoutes(spec);
  console.log(chalk.green('   ✓ Variable references fixed'));
  console.log(chalk.green('   ✓ Request bodies populated'));
  console.log(chalk.green('   ✓ Model-specific bodyShapes generated'));
  console.log(chalk.green('   ✓ Models linked to routes'));
  console.log('');

  // Validate spec has all sections
  const sections = ['name', 'models', 'api', 'rules', 'ui', 'contracts', 'tests'];
  const missing = sections.filter(s => !spec[s]);

  if (missing.length > 0) {
    console.log(chalk.yellow(`⚠️  Missing sections (will be auto-generated): ${missing.join(', ')}`));
  }

  return spec;
}

/**
 * Analyze frontend code to extract components and routes
 */
async function analyzeFrontend(projectDir) {
  const info = { components: [], routes: {} };

  const frontendPaths = await findFrontendPaths(projectDir);

  for (const filePath of frontendPaths.slice(0, 100)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(projectDir, filePath);

      // Extract React components
      const componentMatch = content.match(/(?:export\s+(?:default\s+)?)?(?:function|const)\s+(\w+)\s*(?::\s*React\.FC)?[^{]*\{/);
      if (componentMatch) {
        const componentName = componentMatch[1];

        // Skip non-component files
        if (['index', 'utils', 'helpers', 'types', 'constants'].includes(componentName.toLowerCase())) {
          continue;
        }

        // Extract API calls
        const apiCalls = [];
        const fetchMatches = content.matchAll(/(?:fetch|axios\.(?:get|post|put|delete|patch)|useMutation|useQuery)[^(]*\(\s*[`"']([^`"']+)[`"']/g);
        for (const match of fetchMatches) {
          apiCalls.push(match[1]);
        }

        // Extract props interface
        const propsMatch = content.match(/interface\s+\w*Props\s*{([^}]*)}/);
        const props = propsMatch ? extractPropsFromInterface(propsMatch[1]) : {};

        info.components.push({
          name: componentName,
          file: relPath,
          apiCalls,
          props
        });
      }

      // Extract routes
      const routeMatches = content.matchAll(/(?:path|to):\s*[`"']([^`"']+)[`"']/g);
      for (const match of routeMatches) {
        const routePath = match[1];
        if (routePath.startsWith('/')) {
          const componentName = path.basename(filePath, path.extname(filePath));
          info.routes[routePath] = componentName;
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }

  return info;
}

/**
 * Extract props from TypeScript interface
 */
function extractPropsFromInterface(interfaceBody) {
  const props = {};
  const lines = interfaceBody.split('\n');

  for (const line of lines) {
    const match = line.trim().match(/(\w+)\??:\s*([^;]+)/);
    if (match) {
      props[match[1]] = match[2].trim();
    }
  }

  return props;
}

/**
 * Infer project name from directory
 */
function inferProjectName(projectDir) {
  // Check for package.json
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name) {
        return pkg.name.replace(/^@\w+\//, ''); // Remove scope
      }
    } catch (e) {
      // Ignore
    }
  }

  // Fall back to directory name
  return path.basename(projectDir);
}

/**
 * Extract spec from content when YAML parsing fails
 */
function extractSpecFromContent(content) {
  // Try to find and parse individual sections
  const spec = {
    name: 'Application',
    version: '1.0',
    description: 'Generated application specification',
    models: {},
    api: [],
    rules: [],
    ui: { components: {}, routes: {} },
    contracts: [],
    tests: { api: [], ui: [] }
  };

  // Extract name
  const nameMatch = content.match(/name:\s*["']?([^"'\n]+)/);
  if (nameMatch) spec.name = nameMatch[1].trim();

  return spec;
}

/**
 * Ensure all required sections exist in the spec
 */
function ensureAllSections(spec, projectName, backendInfo, schemas, frontendInfo) {
  if (!spec) spec = {};

  // Name and description
  if (!spec.name) spec.name = projectName;
  if (!spec.version) spec.version = '1.0';
  if (!spec.description) spec.description = `Universal specification for ${projectName}`;

  // Models
  if (!spec.models || Object.keys(spec.models).length === 0) {
    spec.models = {};
    for (const [schemaName, schemaInfo] of Object.entries(schemas)) {
      spec.models[schemaName] = {
        description: `Model from ${schemaInfo.file}`,
        fields: {}
      };
      for (const field of schemaInfo.requiredFields || []) {
        spec.models[schemaName].fields[field.name] = {
          type: field.type || 'string',
          required: true
        };
      }
      for (const field of schemaInfo.optionalFields || []) {
        spec.models[schemaName].fields[field.name] = {
          type: field.type || 'string',
          required: false,
          default: field.default
        };
      }
    }
  }

  // API
  if (!spec.api || spec.api.length === 0) {
    spec.api = [];
    for (const endpoint of backendInfo.endpoints || []) {
      const apiEntry = {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        auth: endpoint.authType ? 'required' : 'none',
        description: `${endpoint.method} ${endpoint.path}`,
        response: {
          200: { when: 'success' }
        }
      };

      // Add auth responses
      if (endpoint.authType) {
        apiEntry.response[401] = { when: 'not authenticated' };
        apiEntry.response[403] = { when: 'not authorized' };
      }

      // Add validation response for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        apiEntry.response[422] = { when: 'validation fails' };
      }

      spec.api.push(apiEntry);
    }
  }

  // Rules
  if (!spec.rules || spec.rules.length === 0) {
    spec.rules = [
      'Users can only access their own resources',
      'Authentication is required for protected endpoints',
      'All input data must be validated'
    ];
  }

  // UI
  if (!spec.ui) {
    spec.ui = { components: {}, routes: {} };
  }
  if (!spec.ui.components || Object.keys(spec.ui.components).length === 0) {
    spec.ui.components = {};
    for (const component of frontendInfo.components || []) {
      spec.ui.components[component.name] = {
        location: component.file,
        description: `${component.name} component`,
        props: component.props || {},
        behavior: component.apiCalls?.map(call => `Calls ${call}`) || []
      };
    }
  }
  if (!spec.ui.routes || Object.keys(spec.ui.routes).length === 0) {
    spec.ui.routes = frontendInfo.routes || {};
  }

  // Contracts
  if (!spec.contracts || spec.contracts.length === 0) {
    spec.contracts = [
      {
        name: 'API response handling',
        file: 'src/**/*.tsx',
        must_contain: ['catch', 'error'],
        must_not_contain: ['console.log(response)']
      }
    ];
  }

  // Tests
  if (!spec.tests) {
    spec.tests = { api: [], ui: [] };
  }
  if (!spec.tests.api || spec.tests.api.length === 0) {
    spec.tests.api = generateApiTests(backendInfo.endpoints || []);
  }
  if (!spec.tests.ui || spec.tests.ui.length === 0) {
    spec.tests.ui = [];
  }

  return spec;
}

/**
 * Generate comprehensive API tests from endpoints
 * Generates 3-5 tests per endpoint: auth, validation, happy path, not found, authorization
 */
function generateApiTests(endpoints) {
  const tests = [];

  for (const endpoint of endpoints.slice(0, 50)) {
    const hasPathParam = endpoint.path.includes('{') || endpoint.path.includes(':');
    const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

    // 1. AUTH TEST - Unauthenticated request returns 401
    if (endpoint.authType) {
      tests.push({
        name: `${endpoint.method} ${endpoint.path} requires authentication`,
        as: 'guest',
        request: {
          method: endpoint.method,
          path: endpoint.path
        },
        expect: {
          status: 401,
          bodyShape: {
            detail: 'string'
          }
        }
      });
    }

    // 2. VALIDATION TEST - Missing required field returns 422 (for write methods)
    if (isWriteMethod && endpoint.authType) {
      tests.push({
        name: `${endpoint.method} ${endpoint.path} validates required fields`,
        as: 'user',
        request: {
          method: endpoint.method,
          path: endpoint.path,
          body: {}
        },
        expect: {
          status: 422,
          bodyShape: {
            detail: 'array'
          }
        }
      });
    }

    // 3. HAPPY PATH TEST - Valid request succeeds with bodyShape
    if (endpoint.method === 'GET') {
      tests.push({
        name: `${endpoint.method} ${endpoint.path} returns data successfully`,
        as: endpoint.authType ? 'user' : 'guest',
        request: {
          method: endpoint.method,
          path: endpoint.path
        },
        expect: {
          status: 200,
          bodyShape: hasPathParam ? {
            id: 'uuid',
            created_at: 'datetime'
          } : {
            // List endpoint usually returns array
          }
        }
      });
    } else if (endpoint.method === 'POST') {
      tests.push({
        name: `POST ${endpoint.path} creates resource successfully`,
        as: endpoint.authType ? 'user' : 'guest',
        request: {
          method: 'POST',
          path: endpoint.path,
          body: {
            // Will be filled by AI with valid data
          }
        },
        expect: {
          status: 201,
          bodyHas: ['id'],
          bodyShape: {
            id: 'uuid',
            created_at: 'datetime'
          }
        }
      });
    }

    // 4. NOT FOUND TEST - Invalid ID returns 404 (for routes with path params)
    if (hasPathParam && endpoint.authType) {
      // Replace path params with invalid UUID
      const notFoundPath = endpoint.path
        .replace(/\{[^}]+\}/g, '00000000-0000-0000-0000-000000000000')
        .replace(/:[^/]+/g, '00000000-0000-0000-0000-000000000000');

      tests.push({
        name: `${endpoint.method} ${endpoint.path} returns 404 for invalid ID`,
        as: 'user',
        request: {
          method: endpoint.method,
          path: notFoundPath
        },
        expect: {
          status: 404,
          bodyShape: {
            detail: 'string'
          }
        }
      });
    }

    // 5. AUTHORIZATION TEST - Other user's resource returns 403 (for user-owned resources)
    if (hasPathParam && endpoint.authType && !endpoint.path.includes('/public/')) {
      tests.push({
        name: `${endpoint.method} ${endpoint.path} returns 403 for other users resource`,
        as: 'other_user',
        request: {
          method: endpoint.method,
          path: endpoint.path
        },
        expect: {
          status: 403,
          bodyShape: {
            detail: 'string'
          }
        }
      });
    }
  }

  return tests;
}

// ============================================================ 
// POST-PROCESSING FUNCTIONS
// ============================================================ 

/**
 * Fix variable references in test paths
 * Convert {param} to ${PARAM} format
 */
function fixVariableReferences(spec) {
  if (!spec.tests?.api) return spec;

  for (const test of spec.tests.api) {
    if (test.request?.path) {
      // Convert {project_id} -> ${PROJECT_ID}
      test.request.path = test.request.path.replace(
        /\{([^}]+)\}/g,
        (match, param) => `\${${param.toUpperCase()}}`
      );
    }
  }

  return spec;
}

/**
 * Generate a sample value for a field based on its type
 */
function generateSampleValue(fieldName, fieldInfo) {
  const typeAnnotation = fieldInfo?.type || '';
  const lowerName = fieldName.toLowerCase();

  // Check for references/foreign keys
  if (fieldInfo?.references) {
    return '${' + fieldName.toUpperCase() + '}';
  }

  // STEP 1: Parse type annotation first (most reliable)
  const parsedType = parseTypeAnnotation(typeAnnotation);
  if (parsedType) {
    const t = parsedType.toLowerCase();
    if (t === 'uuid' || t === 'uuid4') return '${' + fieldName.toUpperCase() + '}';
    if (t === 'int' || t === 'integer') return 100;
    if (t === 'decimal' || t === 'float' || t === 'number' || t === 'numeric' || t === 'double') return 99.99;
    if (t === 'bool' || t === 'boolean') return true;
    if (t === 'datetime' || t === 'timestamp') return '2025-01-15T10:00:00Z';
    if (t === 'date') return '2025-01-15';
    if (t === 'time') return '10:00:00';
    if (t === 'emailstr' || t === 'email') return 'test@example.com';
    if (t === 'httpurl' || t === 'anyurl' || t === 'url') return 'https://example.com';
    if (t === 'list' || t === 'array' || t === 'set') return [];
    if (t === 'dict' || t === 'object' || t === 'json' || t === 'jsonb') return {};
  }

  // STEP 2: Numeric field patterns FIRST (before URL check to avoid "hourly" matching "url")
  if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('total') ||
      lowerName.includes('cost') || lowerName.includes('fee') || lowerName.includes('budget')) return 100.00;
  if (lowerName.includes('rate') || lowerName.includes('hourly')) return 75.00;
  if (lowerName.includes('hours') || lowerName.includes('quantity') || lowerName.includes('count')) return 10;
  if (lowerName.includes('percent') || lowerName.includes('percentage')) return 25;

  // STEP 3: Other field name patterns
  if (lowerName === 'email' || lowerName.includes('email')) return 'test@example.com';
  if (lowerName === 'password') return 'SecurePassword123!';
  if (lowerName === 'name' || lowerName === 'title' || lowerName === 'full_name') return 'Test Name';
  if (lowerName === 'description' || lowerName.includes('content') || lowerName.includes('notes')) return 'Test description content';
  if (lowerName === 'phone' || lowerName.includes('phone')) return '+1234567890';
  if (lowerName === 'status') return fieldInfo?.values?.[0] || 'active';
  if (lowerName === 'priority') return fieldInfo?.values?.[0] || 'medium';
  if (lowerName.includes('date') || lowerName.includes('due') || lowerName.endsWith('_at')) return '2025-01-15T10:00:00Z';

  // URL patterns - AFTER numeric patterns to avoid "hourly" matching "url"
  if (lowerName.includes('url') || lowerName.includes('link') || lowerName.includes('website') ||
      lowerName.includes('homepage') || lowerName.includes('avatar')) return 'https://example.com';

  // STEP 4: Fallback by raw type string
  const type = typeAnnotation.toLowerCase();
  if (type.includes('uuid')) return '${' + fieldName.toUpperCase() + '}';
  if (type.includes('str') || type === 'string' || type === 'text') return `Test ${fieldName.replace(/_/g, ' ')}`;
  if (type.includes('int') || type === 'integer') return 100;
  if (type.includes('decimal') || type.includes('float') || type === 'number') return 99.99;
  if (type.includes('bool')) return true;
  if (type.includes('datetime') || type.includes('date')) return '2025-01-15T10:00:00Z';
  if (type.includes('email')) return 'test@example.com';
  if (type.includes('url')) return 'https://example.com';
  if (type === 'array' || type.includes('list')) return [];
  if (type === 'object' || type.includes('dict') || type.includes('json')) return {};
  if (type.includes('enum')) return cleanEnumValue(fieldInfo?.values?.[0] || fieldInfo?.default || 'active');

  // Fallback to default or string
  if (fieldInfo?.default !== undefined) return cleanEnumValue(fieldInfo.default);
  return `test_${fieldName}`;
}

/**
 * Generate model-specific bodyShapes for tests
 */
function generateModelSpecificShapes(spec) {
  if (!spec.tests?.api || !spec.models) return spec;

  // Build model lookup for fast access
  const modelLookup = buildModelLookup(spec.models);

  for (const test of spec.tests.api) {
    // Only process successful response tests (200, 201)
    if (![200, 201].includes(test.expect?.status)) continue;

    // Skip if bodyShape already has rich fields (not just id/created_at/detail/error)
    const existingShape = test.expect?.bodyShape || {};
    const existingKeys = Object.keys(existingShape);
    const genericKeys = ['id', 'created_at', 'updated_at', 'detail', 'error'];
    const hasRichFields = existingKeys.some(k => !genericKeys.includes(k));
    if (hasRichFields && existingKeys.length > 3) continue;

    // Infer resource from path
    const pathInfo = inferResourceFromPath(test.request?.path);
    if (!pathInfo) continue;

    const { resource, action, parentResource } = pathInfo;
    const method = test.request?.method || 'GET';

    // Try to find matching model - use multiple strategies
    let modelName = null;

    // Strategy 1: If there's an action, look for action-specific response models
    if (action) {
      const capAction = capitalize(action);
      const capResource = parentResource || resource;
      modelName = findModelForResource(spec.models, `${capResource}${capAction}Response`, '') ||
                  findModelForResource(spec.models, `${capResource}Item${capAction}Response`, '') ||
                  findModelForResource(spec.models, `${capResource}${capAction}`, '') ||
                  findModelForResource(spec.models, `${capResource}Item${capAction}`, '');
    }

    // Strategy 2: Standard resource model lookup based on method
    if (!modelName) {
      if (method === 'GET') {
        modelName = findModelForResource(spec.models, resource, 'Response') ||
                    findModelForResource(spec.models, resource, '') ||
                    findMatchingModel(spec.models, resource);
      } else {
        modelName = findModelForResource(spec.models, resource, 'Response') ||
                    findMatchingModel(spec.models, resource);
      }
    }

    // Strategy 3: Try parent resource if we have one
    if (!modelName && parentResource) {
      modelName = findModelForResource(spec.models, parentResource, 'Response') ||
                  findMatchingModel(spec.models, parentResource);
    }

    if (modelName) {
      const fields = modelLookup[modelName] || spec.models[modelName]?.fields;
      if (fields) {
        test.expect.bodyShape = generateRichBodyShape(fields);
      }
    }
  }

  return spec;
}

/**
 * Generate rich bodyShape from model fields with proper type mapping
 */
function generateRichBodyShape(fields) {
  if (!fields || typeof fields !== 'object') return { id: 'uuid' };

  const shape = {};
  for (const [fieldName, fieldInfo] of Object.entries(fields)) {
    shape[fieldName] = mapFieldToShapeType(fieldName, fieldInfo);
  }

  // Always ensure id is present
  if (!shape.id) {
    shape.id = 'uuid';
  }

  return shape;
}

/**
 * Parse Python type annotation to extract core type
 * Handles: Optional[Decimal], list[str], Union[int, None], etc.
 */
function parseTypeAnnotation(typeStr) {
  if (!typeStr) return null;

  const normalized = typeStr.trim();

  // Handle Optional[X] -> extract X
  const optionalMatch = normalized.match(/^Optional\[(.+)\]$/i);
  if (optionalMatch) {
    return parseTypeAnnotation(optionalMatch[1]);
  }

  // Handle Union[X, None] or Union[None, X] -> extract X
  const unionMatch = normalized.match(/^Union\[(.+)\]$/i);
  if (unionMatch) {
    const parts = unionMatch[1].split(',').map(p => p.trim()).filter(p => p.toLowerCase() !== 'none');
    if (parts.length === 1) {
      return parseTypeAnnotation(parts[0]);
    }
  }

  // Handle Python 3.10+ union syntax: 'Decimal | None', 'str | None', etc.
  if (normalized.includes(' | ')) {
    const parts = normalized.split(' | ').map(p => p.trim()).filter(p => p.toLowerCase() !== 'none');
    if (parts.length >= 1) {
      return parseTypeAnnotation(parts[0]); // Take first non-None type
    }
  }

  // Handle list[X], List[X] -> 'list'
  if (/^list\[/i.test(normalized)) return 'list';

  // Handle dict[X, Y], Dict[X, Y] -> 'dict'
  if (/^dict\[/i.test(normalized)) return 'dict';

  // Handle set[X], Set[X] -> 'set'
  if (/^set\[/i.test(normalized)) return 'set';

  // Return the core type (lowercased for comparison)
  return normalized.toLowerCase();
}

/**
 * Map parsed type to bodyShape type
 */
function mapParsedTypeToShape(parsedType) {
  if (!parsedType) return null;

  const t = parsedType.toLowerCase();

  // UUID types
  if (t === 'uuid' || t === 'uuid4') return 'uuid';

  // Numeric types (including Decimal)
  if (t === 'int' || t === 'integer' || t === 'float' || t === 'decimal' ||
      t === 'number' || t === 'numeric' || t === 'double') return 'number';

  // Boolean
  if (t === 'bool' || t === 'boolean') return 'boolean';

  // DateTime types
  if (t === 'datetime' || t === 'timestamp' || t === 'date' || t === 'time') return 'datetime';

  // Collection types
  if (t === 'list' || t === 'array' || t === 'set') return 'array';
  if (t === 'dict' || t === 'object' || t === 'json' || t === 'jsonb') return 'object';

  // String types that indicate specific formats
  if (t === 'emailstr' || t === 'email') return 'email';
  if (t === 'httpurl' || t === 'anyurl' || t === 'url') return 'url';

  // Enum type
  if (t.includes('enum')) return 'enum';

  // Plain string
  if (t === 'str' || t === 'string' || t === 'text' || t === 'varchar') return 'string';

  return null; // Unknown type, let fallback handle it
}

/**
 * Map field info to bodyShape type with better inference
 * Priority: 1. Parse type annotation first, 2. Name-based inference as fallback
 */
function mapFieldToShapeType(fieldName, fieldInfo) {
  const typeAnnotation = fieldInfo?.type || '';
  const lowerName = fieldName.toLowerCase();

  // STEP 1: Parse type annotation first (handles Optional[Decimal], list[str], etc.)
  const parsedType = parseTypeAnnotation(typeAnnotation);
  const typeBasedResult = mapParsedTypeToShape(parsedType);

  if (typeBasedResult) {
    return typeBasedResult;
  }

  // STEP 2: Name-based inference as fallback for untyped or 'string' types

  // ID fields
  if (lowerName === 'id' || lowerName.endsWith('_id')) return 'uuid';

  // Email fields
  if (lowerName === 'email' || lowerName.includes('email')) return 'email';

  // DateTime fields (check before other patterns)
  if (lowerName.includes('created') || lowerName.includes('updated') || lowerName.includes('_at') ||
      lowerName.includes('date') || lowerName.includes('time') || lowerName.endsWith('_date')) {
    return 'datetime';
  }

  // Numeric fields (rate, amount, price, etc.) - NEVER infer 'url' from these
  const numericPatterns = ['rate', 'amount', 'price', 'cost', 'hours', 'count', 'total', 'budget', 'quantity', 'percent', 'fee'];
  if (numericPatterns.some(p => lowerName.includes(p))) return 'number';

  // URL fields - only explicit URL-related names (never 'rate')
  if (lowerName.includes('url') || lowerName.includes('link') || lowerName.includes('website') ||
      lowerName.includes('homepage') || lowerName.includes('avatar')) {
    return 'url';
  }

  // Boolean patterns
  if (lowerName.startsWith('is_') || lowerName.startsWith('has_') || lowerName.startsWith('can_') ||
      lowerName.startsWith('enable') || lowerName.includes('_enabled') || lowerName.includes('_active')) {
    return 'boolean';
  }

  return 'string';
}

/**
 * Singularize a word (basic implementation)
 */
function singularize(word) {
  if (!word) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Capitalize first letter
 */
function capitalize(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * FIX 2: Clean Python enum values like RequestSource.EMAIL → 'email'
 * Converts Python enum notation to simple lowercase string values
 */
function cleanEnumValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  // Pattern: ClassName.VALUE → value (lowercase)
  // Examples: RequestSource.EMAIL → email, Priority.HIGH → high
  if (value.includes('.')) {
    const parts = value.split('.');
    if (parts.length === 2 && /^[A-Z]/.test(parts[0])) {
      return parts[1].toLowerCase();
    }
  }

  return value;
}

/**
 * FIX 3 & 4: Action endpoint detection
 * Action endpoints like enable-*, disable-*, send, accept should have empty bodies and return 200
 */
const ACTION_ENDPOINT_PATTERNS = [
  /\/(enable|disable|activate|deactivate)-/,
  /\/(send|accept|reject|approve|deny|cancel|complete|archive|unarchive)/,
  /\/(mark-|set-|toggle-|revoke|reset|resend|verify)/,
  /\/(start|stop|pause|resume|finish)/
];

function isActionEndpoint(path) {
  if (!path) return false;
  const lowerPath = path.toLowerCase();
  return ACTION_ENDPOINT_PATTERNS.some(pattern => pattern.test(lowerPath));
}

/**
 * FIX 4: Get the expected status code for an endpoint
 * Action endpoints return 200, POST create endpoints return 201
 */
function getExpectedStatusCode(method, path) {
  if (method === 'POST' && isActionEndpoint(path)) {
    return 200;  // Action endpoints return 200, not 201
  }
  if (method === 'POST') {
    return 201;  // Create endpoints return 201
  }
  if (method === 'DELETE') {
    return 204;  // Delete typically returns 204 No Content
  }
  return 200;  // GET, PUT, PATCH return 200
}

/**
 * FIX 4: Post-processing function to fix action endpoint status codes
 * Iterates through all API tests and updates status codes for action endpoints
 */
function fixActionEndpointStatusCodes(spec) {
  if (!spec.tests?.api) return spec;

  let fixedCount = 0;
  for (const test of spec.tests.api) {
    const method = test.request?.method;
    const path = test.request?.path;

    if (!method || !path) continue;

    const expectedStatus = getExpectedStatusCode(method, path);
    const currentStatus = test.expect?.status;

    // Fix status code if it's wrong
    if (currentStatus && currentStatus !== expectedStatus) {
      // Only fix POST action endpoints that incorrectly have 201
      if (method === 'POST' && isActionEndpoint(path) && currentStatus === 201) {
        test.expect.status = 200;
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    console.log(chalk.green(`   ✓ Fixed ${fixedCount} action endpoint status codes (201 → 200)`));
  }

  return spec;
}

/**
 * Find a matching model name for a resource
 */
function findMatchingModel(models, resourceName) {
  if (!models || !resourceName) return null;

  // Try exact match first
  if (models[resourceName]) return resourceName;

  // Try capitalized
  const capitalized = capitalize(resourceName);
  if (models[capitalized]) return capitalized;

  // Try singular form
  const singular = singularize(resourceName);
  if (models[singular]) return singular;

  // Try capitalized singular
  const capitalizedSingular = capitalize(singular);
  if (models[capitalizedSingular]) return capitalizedSingular;

  // Try case-insensitive search
  for (const modelName of Object.keys(models)) {
    if (modelName.toLowerCase() === resourceName.toLowerCase() ||
        modelName.toLowerCase() === singular.toLowerCase()) {
      return modelName;
    }
  }

  return null;
}

/**
 * Link models to API routes (ensure request_model and response_model are set)
 */
function linkModelsToRoutes(spec) {
  if (!spec.api || !spec.models) return spec;

  for (const route of spec.api) {
    // Parse endpoint to get method and path
    const [method, ...pathParts] = route.endpoint.split(' ');
    const path = pathParts.join(' ');

    // Extract resource name from path
    const cleanPathParts = path.split('/').filter(p => p && !p.startsWith('{') && !p.startsWith(':'));
    const resourceName = cleanPathParts[cleanPathParts.length - 1];

    if (resourceName) {
      const modelName = findMatchingModel(spec.models, resourceName);

      if (modelName) {
        // Link request model for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          if (!route.request) route.request = {};
          if (!route.request.body || route.request.body === '{}') {
            route.request.body = modelName;
          }
        }

        // Link response model
        if (route.response) {
          for (const [status, responseInfo] of Object.entries(route.response)) {
            if (['200', '201'].includes(status)) {
              if (!responseInfo.body || responseInfo.body === '{}') {
                responseInfo.body = modelName;
              }
            }
          }
        }
      }
    }
  }

  return spec;
}

// ============================================================ 
// FILE I/O FUNCTIONS
// ============================================================ 

/**
 * Save universal spec to file
 */
export function saveUniversalSpec(spec, projectDir, name) {
  const specsDir = path.join(projectDir, '.devloop', 'specs');
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  const filename = name; // Use the provided name directly
  const filepath = path.join(specsDir, filename);

  fs.writeFileSync(filepath, yaml.stringify(spec, { indent: 2, lineWidth: 120 }));

  return filepath;
}

/**
 * Get summary of spec sections
 */
export function getUniversalSpecSummary(spec) {
  return {
    models: Object.keys(spec.models || {}).length,
    endpoints: (spec.api || []).length,
    rules: (spec.rules || []).length,
    components: Object.keys(spec.ui?.components || {}).length,
    routes: Object.keys(spec.ui?.routes || {}).length,
    contracts: (spec.contracts || []).length,
    apiTests: (spec.tests?.api || []).length,
    uiTests: (spec.tests?.ui || []).length
  };
}

export default { generateUniversalSpec, saveUniversalSpec, getUniversalSpecSummary };
