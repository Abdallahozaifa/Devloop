/**
 * Comprehensive Spec Generator
 *
 * Generates complete feature specifications using AI that include:
 * - Data models with types and constraints
 * - API endpoints with all response codes
 * - Business rules
 * - Frontend components with behavior
 * - Contract checks
 * - API and UI tests
 *
 * Uses framework detection to provide context-aware generation.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import ora from 'ora';
import chalk from 'chalk';
import { detectFramework, detectAllFrameworks } from '../../generators/framework-registry.js';
import { validateSpec } from '../universal-spec.js';

// Import framework generators to register them
import '../../generators/fastapi.js';
import '../../generators/react.js';
import '../../generators/express.js';

/**
 * Fix YAML content that contains unquoted special characters
 * @param {string} yamlContent - Raw YAML content
 * @returns {string} Fixed YAML content
 */
function fixYamlSpecialCharacters(yamlContent) {
  const lines = yamlContent.split('\n');
  const fixedLines = lines.map(line => {
    // Skip lines that are already properly quoted as full strings
    if (line.match(/:\s*["'].*["']$/)) {
      return line;
    }

    // Fix TypeScript type annotations like "onSuccess: (invoice: Invoice) => void"
    const typeMatch = line.match(/^(\s+)(\w+):\s*(\([^)]+\)\s*=>\s*\w+.*|.*\[\].*|.*<.*>.*|\w+\[\]|\(\)\s*=>\s*\w+)$/);
    if (typeMatch && !line.includes('"') && !line.includes("'")) {
      const [, indent, key, value] = typeMatch;
      if (value.includes('=>') || value.includes(':') || value.includes('[]') || value.includes('<')) {
        return `${indent}${key}: "${value.replace(/"/g, '\\"')}"`;
      }
    }

    // Fix array values with ${} variables like "request_ids: [${REQUEST_ID}]"
    const arrayVarMatch = line.match(/^(\s+)(\w+):\s*(\[.*\$\{[^}]+\}.*\])$/);
    if (arrayVarMatch && !line.includes('"')) {
      const [, indent, key, value] = arrayVarMatch;
      return `${indent}${key}: "${value}"`;
    }

    // Fix list items that contain quotes inside (e.g., - "Create Invoice" button opens Modal)
    const listItemWithQuotesMatch = line.match(/^(\s*-\s+)(.+".*".+)$/);
    if (listItemWithQuotesMatch) {
      const [, prefix, value] = listItemWithQuotesMatch;
      return `${prefix}'${value.replace(/'/g, "''")}'`;
    }

    // Fix list items that start with - and contain colons in the value
    const listItemWithColonMatch = line.match(/^(\s*-\s+)([^:]+:\s*\w+,\s*[^:]+:.*)$/);
    if (listItemWithColonMatch && !line.includes('"') && !line.includes("'")) {
      const [, prefix, value] = listItemWithColonMatch;
      if (value.includes(',') && !value.match(/^\w+:$/)) {
        return `${prefix}"${value.replace(/"/g, '\\"')}"`;
      }
    }

    // Fix values with pipe characters like "sm | md | lg"
    const pipeMatch = line.match(/^(\s+)(\w+):\s*(\w+\s*\|\s*.+)$/);
    if (pipeMatch && !line.includes('"') && !line.includes("'")) {
      const [, indent, key, value] = pipeMatch;
      return `${indent}${key}: "${value.replace(/"/g, '\\"')}"`;
    }

    // Fix ${} variable syntax - convert to placeholder
    if (line.includes('${') && !line.includes('"')) {
      return line.replace(/\$\{([^}]+)\}/g, '$1_PLACEHOLDER');
    }

    return line;
  });
  return fixedLines.join('\n');
}

/**
 * Comprehensive prompt for AI spec generation
 */
const COMPREHENSIVE_PROMPT = `You are an expert software architect generating COMPREHENSIVE, FRAMEWORK-AGNOSTIC specifications.

Generate specs so complete that a developer can build the feature with 90%+ first-pass success.

## OUTPUT FORMAT (YAML)

The spec must be FRAMEWORK-AGNOSTIC. Use universal types, not framework-specific ones.

\`\`\`yaml
name: Feature Name
version: "1.0"
description: What this feature does

# === DATA MODELS ===
# Define models with universal types (uuid, string, int, decimal, boolean, datetime, enum, array)
models:
  ModelName:
    fields:
      id:
        type: uuid
        generated: true
      name:
        type: string
        required: true
        maxLength: 255
      amount:
        type: decimal
        required: true
        min: 0
      status:
        type: enum
        values:
          - draft
          - active
          - completed
        default: draft
      created_at:
        type: datetime
        generated: true
      parent_id:
        type: uuid
        references: parents.id
      items:
        type: array
        of: ItemModel
      total:
        type: decimal
        computed: "sum(items.amount)"

# === API ENDPOINTS ===
# Define all CRUD operations with ALL response codes
api:
  - endpoint: POST /api/v1/resources
    auth: required
    description: Create a new resource
    request:
      body:
        field1:
          type: uuid
          required: true
        field2:
          type: string
          required: true
        field3:
          type: decimal
          default: 0
    response:
      - status: 201
        body: ModelName
        description: Created successfully
      - status: 400
        when: invalid data
        body:
          detail: string
      - status: 401
        when: not authenticated
      - status: 403
        when: not authorized
      - status: 404
        when: referenced resource not found
      - status: 422
        when: validation fails
        body:
          detail: string

  - endpoint: GET /api/v1/resources
    auth: required
    description: List resources
    request:
      query:
        limit:
          type: int
          default: 20
          max: 100
        offset:
          type: int
          default: 0
        status:
          type: enum
          values:
            - draft
            - active
          optional: true
    response:
      - status: 200
        body:
          items:
            type: array
            of: ModelName
          total:
            type: int

  - endpoint: GET /api/v1/resources/{id}
    auth: required
    response:
      - status: 200
        body: ModelName
      - status: 403
        when: not owner
      - status: 404
        when: not found

  - endpoint: PATCH /api/v1/resources/{id}
    auth: required
    request:
      body:
        field1:
          type: string
          optional: true
    response:
      - status: 200
        body: ModelName
      - status: 400
        when: business rule violated
      - status: 403
        when: not owner
      - status: 404
        when: not found

  - endpoint: DELETE /api/v1/resources/{id}
    auth: required
    response:
      - status: 204
        description: Deleted
      - status: 400
        when: cannot delete
      - status: 403
        when: not owner
      - status: 404
        when: not found

# === BUSINESS RULES ===
rules:
  - Rule 1 in plain English
  - Rule 2 in plain English
  - User can only access own resources

# === UI COMPONENTS ===
ui:
  components:
    ComponentName:
      description: What this component does
      props:
        propName: type
      state:
        stateName: type
      behavior:
        - Behavior 1
        - Behavior 2
        - On success show toast and close modal
      apiCalls:
        - POST /api/v1/resources
        - GET /api/v1/resources

  routes:
    /resources: ResourceListPage
    /resources/:id: ResourceDetailPage

# === CONTRACT CHECKS ===
contracts:
  - name: Frontend uses correct endpoint
    file: "**/resource*/**/*.tsx"
    must_contain:
      - /api/v1/resources
    must_not_contain:
      - /api/v1/resource

  - name: Frontend sends required fields
    file: "**/ResourceForm*.tsx"
    must_contain:
      - field1
      - field2

# === TESTS ===
tests:
  api:
    # Auth tests
    - name: Create requires auth
      as: guest
      request:
        method: POST
        path: /api/v1/resources
        body:
          field1: test
      expect:
        status: 401

    # Validation tests - one per required field
    - name: Create fails without field1
      as: user
      request:
        method: POST
        path: /api/v1/resources
        body:
          field2: test
      expect:
        status: 422

    # Happy path
    - name: Create succeeds with valid data
      as: user
      request:
        method: POST
        path: /api/v1/resources
        body:
          field1: FIELD1_VALUE_PLACEHOLDER
          field2: test
      expect:
        status: 201
        bodyHas:
          - id
          - field1
          - field2
          - created_at
        bodyShape:
          id: uuid
          status: string
        bodyNot:
          - password
          - secret

    # Authorization
    - name: Cannot access other user resource
      as: other_user
      request:
        method: GET
        path: /api/v1/resources/OTHER_USER_RESOURCE_ID
      expect:
        status_one_of:
          - 403
          - 404

    # Business rules
    - name: Cannot violate business rule
      as: user
      request:
        method: PATCH
        path: /api/v1/resources/RESOURCE_ID
        body:
          field1: invalid
      expect:
        status: 400

  ui:
    - name: List page loads
      steps:
        - goto: /resources
        - wait: 2000
      expect:
        - url: /resources
        - not_visible: error

    - name: Create flow works
      steps:
        - goto: /resources
        - click: "[data-testid=create-button]"
        - waitFor: "[role=dialog]"
        - fill_selector: "[name=field1]"
          fill_value: test value
        - click: "button:has-text('Submit')"
        - wait: 2000
      expect:
        - not_visible: error
        - visible_any:
            - Success
            - Created
\`\`\`

## CRITICAL REQUIREMENTS

1. Use ONLY universal types (uuid, string, int, decimal, boolean, datetime, enum, array)
2. Every model field needs type and constraints
3. Every endpoint needs ALL response codes as an ARRAY (200/201, 400, 401, 403, 404, 422)
4. Every required field needs a validation test
5. Every protected resource needs auth (401) and authorization (403) tests
6. Every business rule needs a test
7. Specs must be framework-agnostic - no FastAPI, React, Express specific code
8. Use YAML array format for responses (with - status: prefix), NOT object format
9. Do NOT use \${} variable syntax - use _PLACEHOLDER suffix instead (e.g., PROJECT_ID_PLACEHOLDER)
10. For fill actions in UI tests, use fill_selector and fill_value on separate lines

Generate a comprehensive spec for the feature described.
`;

/**
 * Generate a comprehensive spec for a feature
 */
export async function generateComprehensiveSpec(featureDescription, projectDir, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required. Get your API key at: https://console.anthropic.com/');
  }

  const client = new Anthropic({ apiKey });

  // Detect frameworks in use
  const frameworks = detectAllFrameworks(projectDir);
  const backendFramework = frameworks.find(f => ['fastapi', 'express', 'django'].includes(f));
  const frontendFramework = frameworks.find(f => ['react', 'vue', 'angular'].includes(f));

  console.log(chalk.cyan('\n🔧 Generating COMPREHENSIVE spec...\n'));
  console.log(chalk.gray(`   Backend framework: ${backendFramework || 'unknown'}`));
  console.log(chalk.gray(`   Frontend framework: ${frontendFramework || 'unknown'}`));
  console.log(chalk.gray('   Output: Framework-agnostic universal spec'));
  console.log('');
  console.log(chalk.gray('   Spec will include:'));
  console.log(chalk.gray('   • Data models with types and constraints'));
  console.log(chalk.gray('   • API endpoints with all response codes'));
  console.log(chalk.gray('   • Business rules'));
  console.log(chalk.gray('   • Frontend components with behavior'));
  console.log(chalk.gray('   • Contract checks'));
  console.log(chalk.gray('   • API and UI tests'));
  console.log('');

  // Read feature file if exists
  let featureContent = featureDescription;
  const featureFile = path.join(projectDir, '.devloop', 'features', `${featureDescription}.md`);
  if (fs.existsSync(featureFile)) {
    featureContent = fs.readFileSync(featureFile, 'utf-8');
    console.log(chalk.gray(`   📄 Using feature file: .devloop/features/${featureDescription}.md\n`));
  }

  // Try to load config
  let config = {};
  const configFile = path.join(projectDir, '.devloop', 'config.yaml');
  if (fs.existsSync(configFile)) {
    try {
      config = yaml.load(fs.readFileSync(configFile, 'utf-8')) || {};
    } catch (e) {
      // Ignore config errors
    }
  }

  const spinner = ora('Generating comprehensive spec with AI...').start();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: `${COMPREHENSIVE_PROMPT}

## FEATURE TO IMPLEMENT

${featureContent}

## CONFIGURATION

Login endpoint: ${config.api?.login_endpoint || '/api/v1/auth/login'}
Use _PLACEHOLDER suffix for dynamic values (e.g., PROJECT_ID_PLACEHOLDER, USER_ID_PLACEHOLDER).

Generate the complete spec now.
`
      }]
    });

    spinner.succeed('Spec generated');

    const specContent = response.content[0].text;

    // Extract YAML from response
    let spec;
    const yamlMatch = specContent.match(/```yaml([\s\S]*?)```/);
    if (yamlMatch) {
      const yamlContent = fixYamlSpecialCharacters(yamlMatch[1]);
      spec = yaml.load(yamlContent);
    } else {
      try {
        const yamlContent = fixYamlSpecialCharacters(specContent);
        spec = yaml.load(yamlContent);
      } catch (e) {
        console.error(chalk.red('\nFailed to parse spec as YAML'));
        console.error(chalk.gray(e.message));
        if (options.verbose) {
          console.log('\n--- Raw Response ---\n');
          console.log(specContent);
        }
        return null;
      }
    }

    // Validate spec
    const validation = validateSpec(spec);
    if (!validation.valid) {
      console.warn(chalk.yellow('\n⚠️  Spec validation warnings:'));
      validation.errors.forEach(e => console.warn(chalk.red(`   - ${e}`)));
    }
    if (validation.warnings?.length > 0) {
      validation.warnings.forEach(w => console.warn(chalk.yellow(`   - ${w}`)));
    }

    return spec;
  } catch (error) {
    spinner.fail('Spec generation failed');
    throw error;
  }
}

/**
 * Save comprehensive spec to file
 */
export function saveComprehensiveSpec(spec, projectDir, featureName) {
  const specsDir = path.join(projectDir, '.devloop', 'specs');
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  const filename = `${featureName.toLowerCase().replace(/\s+/g, '-')}.spec.yaml`;
  const filepath = path.join(specsDir, filename);

  const content = yaml.dump(spec, { indent: 2, lineWidth: 120, noRefs: true });
  fs.writeFileSync(filepath, content);

  return filepath;
}

/**
 * Print spec summary
 */
export function printSpecSummary(spec) {
  console.log(chalk.cyan('\n📊 Spec Summary:'));
  console.log(chalk.white(`   📦 Models:     ${Object.keys(spec.models || {}).length}`));
  console.log(chalk.white(`   🔌 Endpoints:  ${(spec.api || []).length}`));
  console.log(chalk.white(`   📜 Rules:      ${(spec.rules || []).length}`));
  console.log(chalk.white(`   🖥️  Components: ${Object.keys(spec.ui?.components || {}).length}`));
  console.log(chalk.white(`   🗺️  Routes:     ${Object.keys(spec.ui?.routes || {}).length}`));
  console.log(chalk.white(`   📜 Contracts:  ${(spec.contracts || []).length}`));
  console.log(chalk.white(`   🧪 API Tests:  ${(spec.tests?.api || []).length}`));
  console.log(chalk.white(`   🧪 UI Tests:   ${(spec.tests?.ui || []).length}`));
}

/**
 * Get spec summary as object
 */
export function getSpecSummary(spec) {
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

export default {
  generateComprehensiveSpec,
  saveComprehensiveSpec,
  printSpecSummary,
  getSpecSummary
};
