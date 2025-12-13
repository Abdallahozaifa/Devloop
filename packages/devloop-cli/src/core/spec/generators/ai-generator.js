import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { glob } from 'glob';
import { analyzeBackend, findFrontendPaths, extractBackendRequirements, printBackendRequirements, extractPydanticSchemas } from '../backend-analyzer.js';
import { generateProgrammaticSpecs, specsToYaml } from './programmatic-generator.js';
import { analyzeProject as analyzeShapeContracts } from './shape-contract-generator.js';

// ========================================
// FEATURE FILE READING
// ========================================

/**
 * Read feature description files from .devloop/features/
 * These files describe what needs to be implemented/tested
 */
async function readFeatureFiles(projectDir) {
  const featuresDir = path.join(projectDir, '.devloop', 'features');
  const features = [];

  if (!fs.existsSync(featuresDir)) {
    return features;
  }

  try {
    const files = await glob('*.md', { cwd: featuresDir });

    for (const file of files) {
      const filePath = path.join(featuresDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      features.push({
        name: file.replace('.md', ''),
        content,
        file: filePath
      });
    }
  } catch (e) {
    // Features directory might not exist or be empty
  }

  return features;
}

/**
 * Format feature files for AI prompt
 */
function formatFeaturesForAI(features) {
  if (features.length === 0) {
    return '';
  }

  const lines = [];
  lines.push('\n## FEATURE REQUIREMENTS (from .devloop/features/)\n');
  lines.push('These feature descriptions define EXACTLY what MUST be tested.\n');
  lines.push('CRITICAL: Generate tests for ALL endpoints and fields mentioned below!\n');

  for (const feature of features) {
    lines.push(`### Feature: ${feature.name}`);
    lines.push(feature.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('IMPORTANT: The feature files above are the source of truth for what to test.');
  lines.push('Generate tests for EVERY endpoint and EVERY required field mentioned!');

  return lines.join('\n');
}

// ========================================
// BASIC SPEC GENERATION PROMPT (for --basic mode)
// ========================================
const BASIC_SPEC_GENERATION_PROMPT = `You are an expert QA engineer. Given an API schema, generate basic test specifications.

For each endpoint, consider:
1. Happy path (expected successful usage)
2. Auth requirements (what happens without auth?)
3. Validation (what happens with bad input?)
4. Edge cases (empty data, not found, etc.)

Output YAML format specs that follow this structure:

\`\`\`yaml
name: [Feature Name]
description: [What this tests]

roles:
  guest: {}  # No auth
  user:      # Authenticated user
    credentials:
      email: test@example.com
      password: password123

tests:
  - name: [Descriptive test name]
    as: guest|user
    request:
      method: GET|POST|PUT|DELETE
      path: /api/v1/...
      body: {}  # For POST/PUT
    expect:
      status: 200|201|400|401|403|404
      statusNot: [401, 403]  # Status codes that should NOT be returned
      bodyHas: [field1, field2]  # Optional
      bodyIs: array|object       # Optional
\`\`\`

Generate specs that would catch common bugs like:
- Endpoints returning 403 when they should return 401
- Public endpoints accidentally requiring auth (use statusNot: [401, 403])
- Missing validation on required fields
- Incorrect response shapes

IMPORTANT: Generate 2-4 spec files organized by feature area (e.g., Authentication, Core API, Public Endpoints).
Each spec file should have 3-8 focused tests.

Here is the API schema to generate specs for:
`;

// ========================================
// COMPREHENSIVE SANDWICH PROMPT (DEFAULT)
// Generates THREE spec types: API, Contract, UI
// ========================================
const COMPREHENSIVE_SANDWICH_PROMPT = `You are an expert QA engineer generating production-grade test specifications.

Your job is to generate COMPREHENSIVE "sandwich specs" that catch real bugs through THREE layers of testing.

## CRITICAL RULE: FULL CRUD COVERAGE FOR EVERY RESOURCE

For EVERY resource/endpoint group (invoices, users, projects, clients, etc.), you MUST generate ALL of:

### 1. Authentication Tests (401)
- Test that unauthenticated requests get 401 (not 403!)
- Test EVERY endpoint in the resource group

### 2. Validation Tests (422) - THIS IS THE MOST IMPORTANT
For EVERY POST/PUT/PATCH endpoint with required fields:
- Generate a SEPARATE test for EACH required field
- Test that sending WITHOUT each required field returns 422
- Test that sending WITH all required fields returns 200/201

### 3. CRUD Operation Tests
For resources that support CRUD operations:
- **CREATE**: Test successful creation returns 201 with all expected fields
- **READ (single)**: Test GET /resource/{id} returns 200 with full object
- **READ (list)**: Test GET /resource returns 200 with array + pagination
- **UPDATE**: Test PUT/PATCH returns 200 with updated fields
- **DELETE**: Test DELETE returns 204 or 200

### 4. Authorization Tests (403)
- Test that users can't access OTHER users' resources
- Use a different user/ID than the authenticated user

### 5. Not Found Tests (404)
- Test that non-existent resources return 404
- Use obviously fake UUIDs: 99999999-9999-9999-9999-999999999999

### 6. Response Shape Validation
- Use bodyShape to validate EVERY field type in responses
- Use bodyHas to ensure required fields are present
- Use bodyNot to ensure sensitive data is NOT in error responses

## THE THREE SPEC TYPES TO GENERATE

### 1. API Specs (api.spec.yaml) - Test backend endpoints work correctly

For EACH endpoint, generate tests for:
- **Happy path**: Authenticated user gets correct response with full bodyShape validation
- **Validation errors (CRITICAL)**: For each required field, test that missing it returns 422
- **Auth requirement**: Guests get 401 (not 403!)
- **Authorization**: Users can't access other users' data (403)
- **Not found**: Valid auth but non-existent resource returns 404
- **Error responses**: Verify error response shapes

Example API spec:
\`\`\`yaml
name: Invoice API Tests
description: Comprehensive invoice API tests - security, validation, response shape
baseUrl: https://api.example.com

roles:
  guest: {}
  user:
    credentials:
      email: test@example.com
      password: TestPassword123
    loginEndpoint: /api/v1/auth/login

tests:
  # Auth tests - verify 401 for unauthenticated
  - name: Invoice list requires authentication
    as: guest
    request:
      method: GET
      path: /api/v1/portal/invoices
    expect:
      status: 401
      bodyNot:
        - invoices
        - total

  # Happy path - verify response shape
  - name: Authenticated user can list invoices
    as: user
    request:
      method: GET
      path: /api/v1/portal/invoices
    expect:
      status: 200
      statusNot: [401, 403]
      bodyHas:
        - invoices
        - total
      bodyShape:
        invoices: array
        total: number

  # Validation test - verify 422 for invalid input
  - name: Creating invoice requires client_id
    as: user
    request:
      method: POST
      path: /api/v1/portal/invoices
      body:
        title: "Test Invoice"
        amount: 1000
    expect:
      status: 422
      bodyHas:
        - detail

  # Not found test
  - name: Non-existent invoice returns 404
    as: user
    request:
      method: GET
      path: /api/v1/portal/invoices/99999999-9999-9999-9999-999999999999
    expect:
      status: 404
\`\`\`

### 2. Contract/Config Specs (config.spec.yaml) - Verify frontend follows backend contract

These use pattern matching to ensure frontend code sends what backend expects:

\`\`\`yaml
name: Configuration Checks
type: config

tests:
  # Verify frontend uses correct API endpoints
  - name: Frontend uses /portal/invoices endpoint for listing
    check: pattern_exists
    in: apps/web/src/api/portal.ts
    pattern: /portal/invoices
    message: Invoice list API must call /portal/invoices endpoint

  # Catch wrong URL patterns
  - name: No hardcoded fly.dev URLs in frontend
    check: no_pattern
    in: apps/web/src/**/*.{ts,tsx}
    pattern: https://[a-zA-Z0-9-]+\\.fly\\.dev
    exclude:
      - '*.test.ts'
      - '*.spec.ts'
    message: Use VITE_API_URL env var instead of hardcoded fly.dev URLs

  # Verify required form fields
  - name: Invoice form sends client_id
    check: pattern_exists
    in: apps/web/src/pages/invoices/InvoiceFormModal.tsx
    pattern: client_id
    message: Invoice form must include client_id field

  # Verify correct types are used
  - name: Frontend uses PortalInvoice type
    check: pattern_exists
    in: apps/web/src/api/portal.ts
    pattern: PortalInvoice
    message: Portal API must use PortalInvoice type

  # Production health check
  - name: Production API is reachable
    check: url_resolves
    url: https://api.example.com/api/v1/health
    expect:
      status: [200, 405]
\`\`\`

### 3. UI Specs (ui.spec.yaml) - Test user experience with Playwright

\`\`\`yaml
name: Invoice User Experience
type: ui
baseUrl: https://example.com

tests:
  - name: Invoice page loads without errors
    steps:
      - navigate: /invoices
      - waitFor: .invoices-container
      - assert:
          visible: .invoice-list
          notVisible: .error-message
          noConsoleErrors: true

  - name: User can create invoice
    steps:
      - navigate: /invoices
      - click: [data-testid="new-invoice-btn"]
      - waitFor: .invoice-modal
      - fill:
          "[name='client_id']": "test-client-id"
          "[name='amount']": "1000"
      - click: [data-testid="submit-invoice"]
      - waitFor: .success-toast
      - assert:
          visible: .success-toast
\`\`\`

## IMPORTANT RULES

1. Generate ALL THREE types of specs (API, Contract, UI)
2. For API specs: Test EVERY endpoint for auth (401), validation (422), happy path (200), not found (404)
3. For Contract specs: Verify frontend code matches backend requirements
4. For UI specs: Test critical user flows and error states
5. Use realistic test data and endpoints
6. Include descriptive error messages in contract specs
7. ALWAYS use bodyShape to validate response types in addition to bodyHas
8. Test that bodyNot doesn't contain sensitive data in error responses

## COVERAGE WARNING

If you generate fewer than:
- 5 API tests per major endpoint group
- 3 contract checks per feature
- 2 UI tests per user flow

Add a warning comment: "# WARNING: Low coverage - consider adding more tests"

Generate specs based on this backend analysis:
`;

/**
 * Generate basic specs with AI (legacy mode, use --basic flag)
 */
export async function generateSpecsWithAI(discovery, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for AI spec generation. Set it with: export ANTHROPIC_API_KEY=your-key');
  }

  const client = new Anthropic({ apiKey });

  console.log(chalk.cyan('\n🤖 Generating basic specs with AI...\n'));
  console.log(chalk.yellow('⚠️  Using basic mode. For comprehensive specs, remove the --basic flag.\n'));

  // Prepare API schema for Claude
  const apiSchema = formatDiscoveryForAI(discovery);

  if (options.verbose) {
    console.log(chalk.gray('API Schema being sent to AI:\n'));
    console.log(chalk.gray(apiSchema.slice(0, 1000) + '...\n'));
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: BASIC_SPEC_GENERATION_PROMPT + '\n\n' + apiSchema
    }]
  });

  const content = response.content[0].text;

  if (options.verbose) {
    console.log(chalk.gray('AI Response:\n'));
    console.log(chalk.gray(content.slice(0, 500) + '...\n'));
  }

  // Extract YAML blocks from response
  const specs = extractYamlSpecs(content);

  if (specs.length > 0) {
    console.log(chalk.green(`✅ Generated ${specs.length} spec file(s)\n`));
  } else {
    console.log(chalk.yellow('⚠️ No specs could be extracted from AI response\n'));
  }

  return specs;
}

function formatDiscoveryForAI(discovery) {
  const lines = [];

  lines.push('# API Overview');
  lines.push(`Framework: ${discovery.framework?.backend || 'Unknown'}`);
  lines.push(`Auth: ${discovery.auth?.type || 'Unknown'}`);
  if (discovery.auth?.loginEndpoint) {
    lines.push(`Login Endpoint: ${discovery.auth.loginEndpoint}`);
  }
  lines.push('');

  lines.push('# Endpoints');
  const endpoints = discovery.api?.endpoints || discovery.backend?.endpoints || [];
  for (const endpoint of endpoints) {
    const method = endpoint.method || 'GET';
    const endpointPath = endpoint.path || endpoint.route || '';
    lines.push(`- ${method} ${endpointPath}`);
    if (endpoint.auth !== undefined) {
      lines.push(`  Auth Required: ${endpoint.auth}`);
    }
    if (endpoint.description) {
      lines.push(`  Description: ${endpoint.description}`);
    }
  }
  lines.push('');

  // Also include legacy endpoints if available
  if (discovery.backend?.endpoints && discovery.backend.endpoints !== endpoints) {
    lines.push('# Additional Endpoints (from backend scan)');
    for (const endpoint of discovery.backend.endpoints) {
      lines.push(`- ${endpoint.method} ${endpoint.path}`);
    }
    lines.push('');
  }

  lines.push('# Models/Entities');
  const entities = discovery.models?.entities || [];
  for (const entity of entities) {
    lines.push(`- ${entity.name}`);
    for (const field of entity.fields || []) {
      const required = field.required ? ' (required)' : '';
      lines.push(`  - ${field.name}: ${field.type}${required}`);
    }
  }
  lines.push('');

  // Include UI routes if available
  if (discovery.ui?.routes?.length > 0) {
    lines.push('# UI Routes');
    for (const route of discovery.ui.routes.slice(0, 20)) {
      const auth = route.auth ? ' [protected]' : '';
      lines.push(`- ${route.path || route.route}${auth}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function extractYamlSpecs(content) {
  const specs = [];

  // Match YAML code blocks
  const yamlRegex = /```yaml\n([\s\S]*?)```/g;

  let match;
  while ((match = yamlRegex.exec(content)) !== null) {
    try {
      const spec = yaml.load(match[1]);
      if (spec && spec.tests && Array.isArray(spec.tests)) {
        // Validate and clean up each test
        spec.tests = spec.tests.map(test => cleanupTest(test)).filter(Boolean);
        if (spec.tests.length > 0) {
          specs.push(spec);
        }
      }
    } catch (e) {
      console.warn(chalk.yellow(`Warning: Could not parse YAML block: ${e.message}`));
    }
  }

  // If no code blocks found, try parsing entire content as YAML
  if (specs.length === 0) {
    try {
      const spec = yaml.load(content);
      if (spec && spec.tests && Array.isArray(spec.tests)) {
        spec.tests = spec.tests.map(test => cleanupTest(test)).filter(Boolean);
        if (spec.tests.length > 0) {
          specs.push(spec);
        }
      }
    } catch (e) {
      // Not valid YAML, that's okay
    }
  }

  return specs;
}

function cleanupTest(test) {
  if (!test || !test.name) return null;

  // For config/contract specs, check and path are not required
  if (test.check) {
    return test; // Config spec, return as-is
  }

  // For UI specs with steps
  if (test.steps) {
    return test; // UI spec, return as-is
  }

  // For API specs
  // Ensure required fields exist
  if (!test.request) {
    test.request = { method: 'GET', path: '/' };
  }
  if (!test.request.method) {
    test.request.method = 'GET';
  }
  if (!test.request.path) {
    return null; // Can't have a test without a path
  }
  if (!test.expect) {
    test.expect = { status: 200 };
  }
  if (!test.as) {
    test.as = 'guest';
  }

  // Convert status to number or array of numbers
  if (test.expect.status) {
    if (Array.isArray(test.expect.status)) {
      test.expect.status = test.expect.status.map(s => parseInt(s));
    } else {
      test.expect.status = parseInt(test.expect.status);
    }
  }

  // Convert statusNot to array of numbers
  if (test.expect.statusNot) {
    if (!Array.isArray(test.expect.statusNot)) {
      test.expect.statusNot = [test.expect.statusNot];
    }
    test.expect.statusNot = test.expect.statusNot.map(s => parseInt(s));
  }

  return test;
}

export async function interactiveSpecReview(specs, specsDir) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log(chalk.cyan('\n📋 Review Generated Specs\n'));

  const savedFiles = [];

  for (const spec of specs) {
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.bold.white(`Spec: ${spec.name}`));
    console.log(chalk.gray(`Type: ${spec.type || 'api'}`));
    console.log(chalk.gray(`Tests: ${spec.tests.length}`));
    console.log('');

    for (const test of spec.tests) {
      const role = test.as || 'guest';
      const method = test.request?.method || test.check || 'GET';
      const testPath = test.request?.path || test.in || test.url || '/';
      const status = test.expect?.status;
      const statusNot = test.expect?.statusNot;

      let expectStr = '';
      if (status) {
        expectStr = `expect ${Array.isArray(status) ? status.join('|') : status}`;
      }
      if (statusNot) {
        expectStr += ` not ${statusNot.join(',')}`;
      }
      if (test.check) {
        expectStr = `check: ${test.check}`;
      }

      console.log(chalk.white(`  • ${test.name}`));
      console.log(chalk.gray(`    ${role} → ${method} ${testPath} → ${expectStr}`));
    }

    const answer = await question(chalk.cyan('\nSave this spec? [Y/n/e(dit)]: '));

    if (answer.toLowerCase() === 'n') {
      console.log(chalk.yellow('Skipped.'));
      continue;
    }

    if (answer.toLowerCase() === 'e') {
      console.log(chalk.yellow('Interactive editing not yet implemented. Saving as-is.'));
    }

    // Generate filename from spec name and type
    let filename = (spec.name || 'generated')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.spec.yaml';

    // Append type prefix if it's a config or ui spec
    if (spec.type === 'config' && !filename.includes('config')) {
      filename = 'config-' + filename;
    } else if (spec.type === 'ui' && !filename.includes('ui')) {
      filename = 'ui-' + filename;
    }

    const filepath = path.join(specsDir, filename);

    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    fs.writeFileSync(filepath, yaml.dump(spec, { indent: 2, lineWidth: -1 }));
    console.log(chalk.green(`✅ Saved to ${filepath}`));
    savedFiles.push(filepath);
  }

  rl.close();
  return savedFiles;
}

export async function autoSaveSpecs(specs, specsDir) {
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  const savedFiles = [];

  for (const spec of specs) {
    let filename = (spec.name || 'generated')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.spec.yaml';

    // Append type prefix if it's a config or ui spec
    if (spec.type === 'config' && !filename.includes('config')) {
      filename = 'config-' + filename;
    } else if (spec.type === 'ui' && !filename.includes('ui')) {
      filename = 'ui-' + filename;
    }

    const filepath = path.join(specsDir, filename);

    fs.writeFileSync(filepath, yaml.dump(spec, { indent: 2, lineWidth: -1 }));
    savedFiles.push(filepath);
  }

  return savedFiles;
}

export function printSpecSummary(specs) {
  console.log(chalk.cyan('\n📊 Generated Specs Summary\n'));
  console.log(chalk.gray('─'.repeat(50)));

  let totalTests = 0;
  let apiTests = 0;
  let configTests = 0;
  let uiTests = 0;

  for (const spec of specs) {
    const testCount = spec.tests?.length || 0;
    totalTests += testCount;

    if (spec.type === 'config') {
      configTests += testCount;
    } else if (spec.type === 'ui') {
      uiTests += testCount;
    } else {
      apiTests += testCount;
    }

    const typeLabel = spec.type === 'config' ? '📜' : spec.type === 'ui' ? '🖥️' : '📡';
    console.log(chalk.white(`  ${typeLabel} ${spec.name}: ${testCount} tests`));
  }

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.bold.white(`  Total: ${totalTests} tests across ${specs.length} spec files`));
  if (apiTests > 0) console.log(chalk.gray(`    📡 API tests: ${apiTests}`));
  if (configTests > 0) console.log(chalk.gray(`    📜 Contract tests: ${configTests}`));
  if (uiTests > 0) console.log(chalk.gray(`    🖥️  UI tests: ${uiTests}`));
  console.log('');

  // Coverage warning
  if (totalTests < 10) {
    console.log(chalk.yellow('  ⚠️  Low test coverage. Consider adding more tests for comprehensive coverage.\n'));
  }
}

// ========================================
// COMPREHENSIVE SPEC GENERATION (DEFAULT)
// Generates API + Contract + UI specs
// ========================================

/**
 * Generate comprehensive "sandwich" specs using backend-first approach
 * This is the DEFAULT mode - generates API, Contract, and UI specs
 */
export async function generateComprehensiveSpecs(projectDir, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for AI spec generation. Set it with: export ANTHROPIC_API_KEY=your-key');
  }

  console.log(chalk.cyan('\n🔍 Analyzing codebase for comprehensive spec generation...\n'));

  // 1. Analyze backend code
  const backendInfo = await analyzeBackend(projectDir);
  console.log(chalk.gray(`   Found ${backendInfo.endpoints.length} endpoints in ${backendInfo.language || 'unknown'} backend`));

  // 1.5. Read feature files (NEW!)
  const features = await readFeatureFiles(projectDir);
  if (features.length > 0) {
    console.log(chalk.green(`   📋 Found ${features.length} feature description(s):`));
    for (const f of features) {
      console.log(chalk.gray(`      - ${f.name}`));
    }
  }

  if (backendInfo.endpoints.length === 0) {
    console.log(chalk.yellow('\n⚠️  No backend endpoints found. Make sure your backend code is in:'));
    console.log(chalk.gray('   - app/**/*.py (FastAPI)'));
    console.log(chalk.gray('   - api/**/*.py (FastAPI)'));
    console.log(chalk.gray('   - src/**/*.ts (Express)'));
    console.log(chalk.gray('   - routes/**/*.ts (Express)\n'));
    return [];
  }

  // 2. Extract requirements
  const requirements = extractBackendRequirements(backendInfo);
  printBackendRequirements(requirements);

  // 2.5. Extract Pydantic schemas for required field validation
  const schemas = await extractPydanticSchemas(projectDir);
  const schemaCount = Object.keys(schemas).length;
  if (schemaCount > 0) {
    console.log(chalk.gray(`   Found ${schemaCount} Pydantic schemas with required fields\n`));
  }

  // 2.6. Generate programmatic specs for FULL endpoint coverage
  console.log(chalk.cyan('🔧 Generating programmatic specs for guaranteed coverage...\n'));
  const programmatic = generateProgrammaticSpecs(backendInfo, schemas);
  console.log(chalk.green(`   📊 Programmatic generation stats:`));
  console.log(chalk.gray(`      - ${programmatic.stats.endpoints} endpoints analyzed`));
  console.log(chalk.gray(`      - ${programmatic.stats.authTests} auth tests (401)`));
  console.log(chalk.gray(`      - ${programmatic.stats.validationTests} validation tests (422)`));
  console.log(chalk.gray(`      - ${programmatic.stats.notFoundTests} not-found tests (404)`));
  console.log(chalk.gray(`      - ${programmatic.stats.happyPathTests} happy-path tests`));
  console.log(chalk.gray(`      - ${programmatic.stats.contractTests} contract tests\n`));

  // 3. Find frontend paths for contract checking
  const frontendPaths = await findFrontendPaths(projectDir);
  console.log(chalk.gray(`   Found ${frontendPaths.length} frontend components to check\n`));

  // 3.5. Analyze for shape contract mismatches (CRITICAL for paginated response bugs)
  console.log(chalk.cyan('🔍 Analyzing for shape contract mismatches...\n'));
  let shapeAnalysis = { contracts: [], issues: [], specTests: [], summary: { contractsFound: 0, issuesFound: 0, testsGenerated: 0 } };
  try {
    shapeAnalysis = await analyzeShapeContracts(projectDir, {
      backendDirs: ['app', 'api', 'src/api', 'server'],
      frontendDirs: ['apps/web', 'src', 'frontend', 'client'],
    });
    if (shapeAnalysis.summary.contractsFound > 0 || shapeAnalysis.summary.issuesFound > 0) {
      console.log(chalk.yellow(`   ⚠️  Shape analysis results:`));
      console.log(chalk.gray(`      - ${shapeAnalysis.summary.contractsFound} paginated response patterns found`));
      console.log(chalk.gray(`      - ${shapeAnalysis.summary.issuesFound} potential shape mismatches in frontend`));
      console.log(chalk.gray(`      - ${shapeAnalysis.summary.testsGenerated} shape validation tests generated\n`));

      // Print specific issues found
      if (shapeAnalysis.issues.length > 0) {
        console.log(chalk.yellow('   🐛 Potential bugs detected:'));
        for (const issue of shapeAnalysis.issues.slice(0, 5)) {
          console.log(chalk.red(`      - ${path.basename(issue.file)}:${issue.line} - ${issue.issue}`));
          console.log(chalk.gray(`        Fix: ${issue.suggestion}`));
        }
        if (shapeAnalysis.issues.length > 5) {
          console.log(chalk.gray(`      ... and ${shapeAnalysis.issues.length - 5} more issues\n`));
        }
      }
    } else {
      console.log(chalk.green(`   ✅ No shape mismatches detected\n`));
    }
  } catch (shapeError) {
    console.log(chalk.gray(`   Shape analysis skipped: ${shapeError.message}\n`));
  }

  // 4. Generate comprehensive specs with AI
  const client = new Anthropic({ apiKey });

  console.log(chalk.cyan('🤖 Generating comprehensive sandwich specs...\n'));
  console.log(chalk.gray('   This generates THREE types of specs:'));
  console.log(chalk.gray('   📡 API specs - test backend endpoints work correctly'));
  console.log(chalk.gray('   📜 Contract specs - verify frontend follows backend contract'));
  console.log(chalk.gray('   🖥️  UI specs - test user experience\n'));

  // Include feature requirements if available
  const featureSection = formatFeaturesForAI(features);

  const prompt = COMPREHENSIVE_SANDWICH_PROMPT + `
${featureSection}

## Backend Requirements

${formatRequirementsForAI(requirements)}

## Pydantic Schemas with Required Fields (CRITICAL FOR VALIDATION TESTS)

${formatSchemasForAI(schemas)}

## Frontend Paths to Check

${frontendPaths.slice(0, 30).map(p => `- ${path.relative(projectDir, p)}`).join('\n')}

## Project Structure

- Backend: ${backendInfo.language || 'unknown'} (${backendInfo.framework || 'unknown'})
- Endpoints: ${backendInfo.endpoints.length}
- Schemas with required fields: ${schemaCount}
- Frontend files: ${frontendPaths.length}
- Feature descriptions: ${features.length}

## MANDATORY TEST GENERATION RULES

### For EACH resource endpoint group, generate ALL of these test types:

1. **Authentication Test (401)**: Guest accessing protected endpoint
2. **List Test (200)**: Authenticated user listing resources
3. **Create Validation Tests (422)**: One test per required field missing
4. **Create Success Test (201)**: Valid create with all required fields
5. **Read Single Test (200)**: Get by ID with full response shape validation
6. **Update Test (200)**: PUT/PATCH with valid data
7. **Delete Test (204/200)**: Delete resource
8. **Not Found Test (404)**: Access non-existent resource

### Validation Tests are CRITICAL:
For EACH POST/PUT/PATCH endpoint with required fields:
- Test calling WITHOUT each required field -> expect 422
- Test calling WITH all required fields -> expect 200/201

Example: If POST /invoices requires {project_id, client_id, request_ids}:
- Test 1: POST without project_id -> expect 422
- Test 2: POST without client_id -> expect 422
- Test 3: POST without request_ids -> expect 422
- Test 4: POST with ALL fields -> expect 201

This catches bugs where frontend forgets to send required fields!

Generate comprehensive specs that would catch real bugs like:
1. API returning wrong status codes (403 instead of 401)
2. Frontend calling wrong endpoints
3. Frontend missing required headers
4. Validation not catching missing fields (THIS IS THE KEY!)
5. Error responses leaking sensitive data

## MINIMUM OUTPUT REQUIREMENTS

Output each spec as a separate YAML code block. Generate at least:
- 1 comprehensive API spec file with 15+ tests covering ALL resource groups
- 1 contract/config spec file with 8+ checks (verify frontend sends required fields)
- 1 UI spec file with 3+ user flow tests

If feature files are provided above, ensure EVERY endpoint mentioned in them has complete test coverage!
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,  // Increased for comprehensive specs
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const content = response.content[0].text;

  if (options.verbose) {
    console.log(chalk.gray('AI Response preview:\n'));
    console.log(chalk.gray(content.slice(0, 1000) + '...\n'));
  }

  // Extract and categorize specs
  const specs = extractYamlSpecs(content);

  // Categorize for display
  const apiSpecs = specs.filter(s => !s.type || s.type === 'api');
  const configSpecs = specs.filter(s => s.type === 'config');
  const uiSpecs = specs.filter(s => s.type === 'ui');

  // Count AI-generated tests
  const aiApiTestCount = apiSpecs.reduce((sum, s) => sum + (s.tests?.length || 0), 0);
  const aiConfigTestCount = configSpecs.reduce((sum, s) => sum + (s.tests?.length || 0), 0);
  const aiUiTestCount = uiSpecs.reduce((sum, s) => sum + (s.tests?.length || 0), 0);

  // Add programmatic specs to the result
  // Create programmatic spec objects with proper structure
  // CRITICAL: Include roles section so tests with 'as: user' can authenticate!
  // Use ${VAR} variables for deterministic regeneration - resolved at runtime from .devloop/config.yaml
  const programmaticApiSpec = {
    name: 'Programmatic API Coverage Tests',
    description: 'Auto-generated tests for guaranteed endpoint coverage (auth, validation, 404)',
    type: 'api',
    roles: {
      guest: {},
      user: {
        credentials: {
          email: '${TEST_USER_EMAIL}',
          password: '${TEST_USER_PASSWORD}'
        },
        loginEndpoint: '${LOGIN_ENDPOINT}'
      }
    },
    tests: programmatic.apiTests,
    _programmatic: true // Mark as programmatic for identification
  };

  const programmaticContractSpec = {
    name: 'Programmatic Contract Tests',
    description: 'Auto-generated contract tests to ensure frontend sends required fields',
    type: 'config',
    tests: programmatic.contractTests,
    _programmatic: true
  };

  // Create shape contract spec if we found paginated responses
  const shapeContractSpec = shapeAnalysis.specTests.length > 0 ? {
    name: 'Shape Contract Tests',
    description: 'Auto-generated tests to catch paginated response shape mismatches (e.g., calling .filter() on { items: [], total } instead of raw array)',
    type: 'api',
    roles: {
      guest: {},
      user: {
        credentials: {
          email: '${TEST_USER_EMAIL}',
          password: '${TEST_USER_PASSWORD}'
        },
        loginEndpoint: '${LOGIN_ENDPOINT}'
      }
    },
    tests: shapeAnalysis.specTests,
    _shapeContract: true
  } : null;

  // Combine AI specs with programmatic specs and shape contract specs
  const allSpecs = [
    ...specs,
    programmaticApiSpec,
    programmaticContractSpec,
    ...(shapeContractSpec ? [shapeContractSpec] : [])
  ];

  // Total counts (AI + programmatic + shape contracts)
  const shapeTestCount = shapeAnalysis.specTests.length;
  const totalApiTests = aiApiTestCount + programmatic.apiTests.length + shapeTestCount;
  const totalConfigTests = aiConfigTestCount + programmatic.contractTests.length;
  const totalTests = totalApiTests + totalConfigTests + aiUiTestCount;

  console.log(chalk.green('\n✅ Generated comprehensive sandwich specs:'));
  console.log(chalk.white(`   📡 API specs: ${apiSpecs.length + 1 + (shapeContractSpec ? 1 : 0)} file(s) with ${totalApiTests} tests`));
  console.log(chalk.gray(`      - ${aiApiTestCount} AI-generated`));
  console.log(chalk.gray(`      - ${programmatic.apiTests.length} programmatic`));
  if (shapeTestCount > 0) {
    console.log(chalk.yellow(`      - ${shapeTestCount} shape contract tests (paginated response validation)`));
  }
  console.log(chalk.white(`   📜 Contract specs: ${configSpecs.length + 1} file(s) with ${totalConfigTests} checks (${aiConfigTestCount} AI + ${programmatic.contractTests.length} programmatic)`));
  console.log(chalk.white(`   🖥️  UI specs: ${uiSpecs.length} file(s) with ${aiUiTestCount} tests`));
  console.log(chalk.bold.cyan(`   📊 Total: ${totalTests} tests across ${allSpecs.length} files\n`));

  // Coverage analysis
  const coveragePercent = Math.round((programmatic.stats.endpoints > 0 ? programmatic.stats.apiTests / programmatic.stats.endpoints : 0) * 100);
  console.log(chalk.gray(`   Endpoint coverage: ${coveragePercent}% (${programmatic.stats.apiTests} tests for ${programmatic.stats.endpoints} endpoints)`));

  if (totalTests < 50) {
    console.log(chalk.yellow('\n   ⚠️  Coverage could be improved. Review generated specs.'));
  } else {
    console.log(chalk.green('\n   ✅ Good coverage! Programmatic generation ensures all endpoints tested.'));
  }

  return allSpecs;
}

// ========================================
// BACKEND-FIRST SPEC GENERATION (legacy)
// ========================================

const BACKEND_FIRST_PROMPT = `You are generating test specs. CRITICAL: The BACKEND is the source of truth.

## Your Task

1. First, understand the BACKEND requirements I'm providing:
   - What endpoints exist
   - What headers/auth each endpoint REQUIRES
   - What parameters are expected

2. Generate specs that VERIFY the frontend follows the backend contract.

## Three Types of Specs to Generate

### 1. API Specs (prove backend works)
Test that the backend endpoints work correctly when called properly.

\`\`\`yaml
name: Client Portal API
type: api
tests:
  - name: Portal requires X-Portal-Token header
    method: GET
    path: /api/v1/client-portal/dashboard
    # No header - should fail
    expect:
      status: 401

  - name: Portal works with valid token
    method: GET
    path: /api/v1/client-portal/dashboard
    headers:
      X-Portal-Token: test-token
    expect:
      status: 200
      bodyHas: [client_name]
\`\`\`

### 2. Contract/Config Specs (verify frontend sends what backend needs)
These check that frontend code includes required patterns.

\`\`\`yaml
name: Portal Frontend Contract
type: config
tests:
  - name: Frontend MUST send X-Portal-Token header
    description: Backend requires this header, frontend must send it
    check: pattern_exists
    file: apps/web/src/**/client-portal/**/*.tsx
    pattern: X-Portal-Token
    message: |
      BACKEND REQUIRES X-Portal-Token header.
      Frontend must include: headers: { 'X-Portal-Token': token }

  - name: Frontend MUST call correct endpoint
    check: pattern_exists
    file: apps/web/src/**/client-portal/**/*.tsx
    pattern: /api/v1/client-portal/
    message: Backend endpoint is /api/v1/client-portal/
\`\`\`

### 3. UI Specs (test user experience)
Test what users actually see in the browser.

\`\`\`yaml
name: Portal User Experience
type: ui
tests:
  - name: User sees portal data, not errors
    url: /client-portal?token=test-token
    waitUntil: networkidle2
    expect:
      status: 200
      noNetworkErrors: true
      textNotContains:
        - "401"
        - "Unauthorized"
\`\`\`

## Key Principle

The CONTRACT spec says "frontend MUST do X because backend REQUIRES X".
If frontend code is buggy (missing the header), the CONTRACT spec FAILS.
This catches the bug BEFORE users see it.

Do NOT generate specs that match buggy frontend code.
Generate specs that enforce backend requirements.

## Backend Requirements to Enforce:
`;

/**
 * Generate specs using a backend-first approach (legacy function)
 * Backend is the source of truth - specs verify frontend follows backend contracts
 */
export async function generateBackendFirstSpecs(projectDir, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for AI spec generation. Set it with: export ANTHROPIC_API_KEY=your-key');
  }

  console.log(chalk.cyan('\n🔍 Analyzing BACKEND as source of truth...\n'));

  // 1. Analyze backend code
  const backendInfo = await analyzeBackend(projectDir);
  console.log(chalk.gray(`   Found ${backendInfo.endpoints.length} endpoints in ${backendInfo.language || 'unknown'} backend`));

  if (backendInfo.endpoints.length === 0) {
    console.log(chalk.yellow('\n⚠️  No backend endpoints found. Make sure your backend code is in:'));
    console.log(chalk.gray('   - app/**/*.py (FastAPI)'));
    console.log(chalk.gray('   - api/**/*.py (FastAPI)'));
    console.log(chalk.gray('   - src/**/*.ts (Express)'));
    console.log(chalk.gray('   - routes/**/*.ts (Express)\n'));
    return [];
  }

  // 2. Extract requirements
  const requirements = extractBackendRequirements(backendInfo);
  printBackendRequirements(requirements);

  // 3. Find frontend paths
  const frontendPaths = await findFrontendPaths(projectDir);
  console.log(chalk.gray(`   Found ${frontendPaths.length} frontend components to check\n`));

  // 4. Generate specs with AI
  const client = new Anthropic({ apiKey });

  console.log(chalk.cyan('🤖 Generating specs from backend requirements...\n'));

  const prompt = BACKEND_FIRST_PROMPT + `

${formatRequirementsForAI(requirements)}

Frontend paths to check for contract compliance:
${frontendPaths.slice(0, 20).map(p => `- ${path.relative(projectDir, p)}`).join('\n')}

Generate:
1. API specs - test each endpoint works (with and without auth)
2. Contract/Config specs - verify frontend sends required headers
3. UI specs - test user experience (no 401s, no network errors)

Output each spec as a separate YAML code block. Use the exact formats shown above.
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const content = response.content[0].text;

  if (options.verbose) {
    console.log(chalk.gray('AI Response preview:\n'));
    console.log(chalk.gray(content.slice(0, 800) + '...\n'));
  }

  // Extract and categorize specs
  const specs = extractYamlSpecs(content);

  // Categorize for display
  const apiSpecs = specs.filter(s => s.type === 'api' || !s.type);
  const configSpecs = specs.filter(s => s.type === 'config');
  const uiSpecs = specs.filter(s => s.type === 'ui');

  console.log(chalk.green('\n✅ Generated specs from backend requirements:'));
  console.log(chalk.white(`   📡 API specs: ${apiSpecs.length} (test backend works)`));
  console.log(chalk.white(`   📜 Contract specs: ${configSpecs.length} (verify frontend follows backend)`));
  console.log(chalk.white(`   🖥️  UI specs: ${uiSpecs.length} (test user experience)`));

  return specs;
}

function formatRequirementsForAI(requirements) {
  const lines = [];

  // Group by auth type
  const byAuth = {};
  for (const req of requirements) {
    const auth = req.authType || 'none';
    if (!byAuth[auth]) byAuth[auth] = [];
    byAuth[auth].push(req);
  }

  for (const [authType, endpoints] of Object.entries(byAuth)) {
    const authLabel = authType === 'none' ? 'Public (no auth required)' :
                      authType === 'portal-token' ? 'Portal Token Authentication (X-Portal-Token header)' :
                      authType === 'bearer' ? 'Bearer Token Authentication (Authorization header)' :
                      authType === 'api-key' ? 'API Key Authentication (X-API-Key header)' : authType;

    lines.push(`\n### ${authLabel}`);

    for (const ep of endpoints) {
      lines.push(`- ${ep.method} ${ep.endpoint}`);
      if (ep.headers.length > 0) {
        lines.push(`  Required headers: ${ep.headers.map(h => h.name).join(', ')}`);
      }
      if (ep.file) {
        lines.push(`  Defined in: ${ep.file}:${ep.line || '?'}`);
      }
      // Include request schema info for POST/PUT/PATCH endpoints
      if (ep.requestSchema && ep.requestSchema.modelName) {
        lines.push(`  Request body schema: ${ep.requestSchema.modelName}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format Pydantic schemas for AI prompt
 * This is CRITICAL for generating validation tests!
 */
function formatSchemasForAI(schemas) {
  const schemaNames = Object.keys(schemas);

  if (schemaNames.length === 0) {
    return 'No Pydantic schemas found with required fields.';
  }

  const lines = [];

  for (const [schemaName, schemaInfo] of Object.entries(schemas)) {
    lines.push(`### ${schemaName}`);
    lines.push(`File: ${schemaInfo.file}`);

    if (schemaInfo.requiredFields.length > 0) {
      lines.push('**REQUIRED fields (MUST generate validation tests for these!):**');
      for (const field of schemaInfo.requiredFields) {
        lines.push(`  - ${field.name}: ${field.type}`);
      }
    }

    if (schemaInfo.optionalFields.length > 0) {
      lines.push('Optional fields:');
      for (const field of schemaInfo.optionalFields) {
        const defaultStr = field.default ? ` = ${field.default}` : '';
        lines.push(`  - ${field.name}: ${field.type}${defaultStr}`);
      }
    }

    lines.push('');
  }

  // Add emphasis for AI
  lines.push('---');
  lines.push('IMPORTANT: For each schema with required fields, you MUST generate:');
  lines.push('1. A test that calls the endpoint WITHOUT each required field -> expect 422');
  lines.push('2. A test that calls the endpoint WITH all required fields -> expect 200/201');
  lines.push('');
  lines.push('Example: If CreateCheckoutSession requires "price_id":');
  lines.push('- Test: POST /billing/create-checkout-session with {} -> expect 422, bodyHas: [detail]');
  lines.push('- Test: POST /billing/create-checkout-session with {price_id: "price_xxx"} -> expect 200');

  return lines.join('\n');
}

// Re-export for use in spec command
export { analyzeBackend, findFrontendPaths, extractBackendRequirements, printBackendRequirements };
