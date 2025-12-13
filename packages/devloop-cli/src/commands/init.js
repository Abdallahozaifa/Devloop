import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { CONFIG_DIR, saveConfig, loadConfig, detectFramework, detectPlatform, getLicenseKey } from '../core/config.js';
import { verifyLicense, validateLicenseFormat } from '../core/license.js';
import { success, error, info, warn, spinner, prompt, printBanner } from '../utils/ui.js';

/**
 * Generate config.yaml template content for test configuration
 */
function generateConfigYamlTemplate(apiUrl) {
  return `# DevLoop Test Configuration
# This file configures authentication and variables for running tests

# API base URL (required for API tests)
apiUrl: ${apiUrl || 'http://localhost:3000'}

# Authentication roles for testing
# Tests use "as: user" or "as: other_user" to authenticate
roles:
  # Primary test user
  user:
    # Option 1: Use a pre-existing token
    # token: YOUR_JWT_TOKEN_HERE

    # Option 2: Login with credentials (devloop will authenticate automatically)
    credentials:
      email: test@example.com
      password: testpassword123
    loginEndpoint: /api/v1/auth/login

  # Secondary user for authorization tests (e.g., "user cannot access other user's data")
  other_user:
    credentials:
      email: other@example.com
      password: testpassword123
    loginEndpoint: /api/v1/auth/login

# Variables for test interpolation
# Use {VARIABLE_NAME} in tests, e.g., /api/v1/items/{ITEM_ID}
# Add variables based on your spec's requirements
variables:
  # Example: ITEM_ID: 00000000-0000-0000-0000-000000000001
`;
}

export async function initCommand(options) {
  printBanner();

  const projectRoot = process.cwd();
  const configDir = path.join(projectRoot, CONFIG_DIR);
  const configPath = path.join(configDir, 'config.yaml');

  // Check if already initialized - make init idempotent
  const alreadyInitialized = fs.existsSync(configDir);
  let existingConfig = {};

  if (alreadyInitialized) {
    try {
      existingConfig = loadConfig() || {};
    } catch {
      // Config exists but may be invalid, continue with fresh config
    }

    if (!options.yes) {
      info('DevLoop is already initialized in this project.');
      info('Re-running will update your configuration.');
    }
  }

  // Check for license - use existing if available
  let licenseKey = options.license || getLicenseKey() || existingConfig.license_key;

  if (!licenseKey && !options.yes) {
    info('No license key found.');
    licenseKey = await prompt('Enter your DevLoop license key:');

    if (!validateLicenseFormat(licenseKey)) {
      error('Invalid license key format. Expected: DL-XXXX-XXXX-XXXX');
      return;
    }
  } else if (!licenseKey && options.yes) {
    // Skip license verification in -y mode if no license provided
    warn('No license key provided. Some features may be limited.');
    licenseKey = '';
  }

  // Verify license (skip if empty)
  let verification = { valid: true, plan: 'community' };
  if (licenseKey) {
    const spin = spinner('Verifying license...').start();
    verification = await verifyLicense(licenseKey);

    if (!verification.valid) {
      spin.fail('License verification failed');
      error(verification.message || 'Invalid license key');
      return;
    }
    spin.succeed(`License verified (${verification.plan} plan)`);
  }

  // Detect framework and platform
  const framework = detectFramework(projectRoot);
  const platform = detectPlatform(projectRoot);

  info(`Detected framework: ${framework.type} (${framework.language})`);
  if (platform) {
    info(`Detected platform: ${platform}`);
  }

  // Create config directory if needed
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Create specs directory if needed
  const specsDir = path.join(configDir, 'specs');
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  // Merge with existing config (preserves user customizations)
  const config = {
    ...existingConfig,
    version: '2.3.0',
    license_key: licenseKey || existingConfig.license_key,
    framework: framework.type,
    language: framework.language,
    test_framework: framework.testFramework,
    platform: platform,
    initialized_at: existingConfig.initialized_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveConfig(config);

  // Create config.yaml template for test configuration (only if it doesn't exist)
  const configYamlPath = path.join(configDir, 'config.yaml');
  if (!fs.existsSync(configYamlPath)) {
    const configYamlContent = generateConfigYamlTemplate();
    fs.writeFileSync(configYamlPath, configYamlContent);
    info('Created .devloop/config.yaml template for test configuration');
  }

  // Create .gitignore entry if needed
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.devloop')) {
      fs.appendFileSync(gitignorePath, '\n# DevLoop\n.devloop/\n');
      info('Added .devloop/ to .gitignore');
    }
  } else {
    // Create .gitignore with devloop entry
    fs.writeFileSync(gitignorePath, '# DevLoop\n.devloop/\n');
    info('Created .gitignore with .devloop/ entry');
  }

  console.log('');
  if (alreadyInitialized) {
    success('DevLoop configuration updated!');
  } else {
    success('DevLoop initialized successfully!');
  }
  console.log('');
  info('Next steps:');
  console.log('  1. devloop spec generate "your feature"  # Generate test specs');
  console.log('  2. devloop test --dry-run                # Preview what will be tested');
  console.log('  3. devloop test                          # Run tests (read-only by default)');
  console.log('');
}
