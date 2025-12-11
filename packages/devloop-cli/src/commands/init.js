import fs from 'fs';
import path from 'path';
import { CONFIG_DIR, saveConfig, detectFramework, detectPlatform, getLicenseKey } from '../core/config.js';
import { verifyLicense, validateLicenseFormat } from '../core/license.js';
import { success, error, info, warn, spinner, prompt, printBanner } from '../utils/ui.js';

export async function initCommand(options) {
  printBanner();

  const projectRoot = process.cwd();
  const configDir = path.join(projectRoot, CONFIG_DIR);

  // Check if already initialized
  if (fs.existsSync(configDir) && !options.force) {
    warn('DevLoop is already initialized in this project.');
    info(`Config directory: ${configDir}`);
    info('Use --force to reinitialize.');
    return;
  }

  // Check for license
  let licenseKey = getLicenseKey();

  if (!licenseKey) {
    info('No license key found.');
    licenseKey = await prompt('Enter your DevLoop license key:');

    if (!validateLicenseFormat(licenseKey)) {
      error('Invalid license key format. Expected: DL-XXXX-XXXX-XXXX');
      return;
    }
  }

  // Verify license
  const spin = spinner('Verifying license...').start();

  const verification = await verifyLicense(licenseKey);

  if (!verification.valid) {
    spin.fail('License verification failed');
    error(verification.message || 'Invalid license key');
    return;
  }

  spin.succeed(`License verified (${verification.plan} plan)`);

  // Detect framework and platform
  const framework = detectFramework(projectRoot);
  const platform = detectPlatform(projectRoot);

  info(`Detected framework: ${framework.type} (${framework.language})`);
  if (platform) {
    info(`Detected platform: ${platform}`);
  }

  // Create config directory
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Save configuration
  const config = {
    license_key: licenseKey,
    framework: framework.type,
    language: framework.language,
    test_framework: framework.testFramework,
    platform: platform,
    initialized_at: new Date().toISOString(),
  };

  saveConfig(config);

  // Create .gitignore entry if needed
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.devloop')) {
      fs.appendFileSync(gitignorePath, '\n# DevLoop\n.devloop/\n');
      info('Added .devloop/ to .gitignore');
    }
  }

  console.log('');
  success('DevLoop initialized successfully!');
  console.log('');
  info('Next steps:');
  console.log('  1. devloop build "describe what you want to build"');
  console.log('  2. devloop test');
  console.log('  3. devloop deploy');
  console.log('');
}
