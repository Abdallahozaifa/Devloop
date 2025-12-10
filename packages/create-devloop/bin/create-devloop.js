#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import https from 'https';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const API_URL = process.env.DEVLOOP_API_URL || 'https://api.devloop.dev';
const LICENSE_CACHE_FILE = path.join(os.homedir(), '.devloop-license');
const LICENSE_CACHE_HOURS = 24;

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = '') {
  console.log(`${color}${message}${COLORS.reset}`);
}

function printBanner() {
  log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██████╗ ███████╗██╗   ██╗██╗      ██████╗  ██████╗ ██████╗  ║
║   ██╔══██╗██╔════╝██║   ██║██║     ██╔═══██╗██╔═══██╗██╔══██╗ ║
║   ██║  ██║█████╗  ██║   ██║██║     ██║   ██║██║   ██║██████╔╝ ║
║   ██║  ██║██╔══╝  ╚██╗ ██╔╝██║     ██║   ██║██║   ██║██╔═══╝  ║
║   ██████╔╝███████╗ ╚████╔╝ ███████╗╚██████╔╝╚██████╔╝██║      ║
║   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝      ║
║                                                               ║
║   Autonomous QA for Indie Hackers                             ║
║   Ship faster. Break nothing.                                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`, COLORS.cyan);
}

function showHelp() {
  printBanner();
  log(`
Usage: npx create-devloop [options]

Options:
  --help, -h       Show this help message
  --yes, -y        Skip prompts and use defaults
  --license, -l    Your DevLoop license key (or use DEVLOOP_LICENSE_KEY env)

What this does:
  1. Verifies your DevLoop license
  2. Creates .devloop/ folder with QA documentation templates
  3. Creates scripts/ folder with automated QA scripts
  4. Creates .cursorrules for AI-assisted development

The scripts enable:
  - Autonomous API endpoint testing
  - UI screenshot testing with AI vision
  - Auto-fix loop that finds bugs and fixes them
  - Integration with DevLoop AI for AI-powered debugging

Get your license at: https://devloop.dev
`, COLORS.reset);
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptHidden(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Disable echo for password input
    if (process.stdin.isTTY) {
      process.stdout.write(question);
      const stdin = process.openStdin();
      let input = '';

      const onData = (char) => {
        char = char.toString();
        if (char === '\n' || char === '\r') {
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (char === '\u007F') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += char;
        }
      };

      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

function httpRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function getCachedLicense() {
  try {
    if (!fs.existsSync(LICENSE_CACHE_FILE)) return null;

    const cache = JSON.parse(fs.readFileSync(LICENSE_CACHE_FILE, 'utf8'));
    const age = (Date.now() - cache.timestamp) / (1000 * 60 * 60);

    if (age > LICENSE_CACHE_HOURS) {
      return null; // Cache expired
    }

    return cache;
  } catch {
    return null;
  }
}

function saveLicenseCache(licenseKey, data) {
  const cache = {
    license_key: licenseKey,
    timestamp: Date.now(),
    ...data,
  };
  fs.writeFileSync(LICENSE_CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function verifyLicense(licenseKey) {
  // Check cache first
  const cached = getCachedLicense();
  if (cached && cached.license_key === licenseKey && cached.valid) {
    return { valid: true, cached: true, plan: cached.plan };
  }

  // Verify with API
  try {
    log('Verifying license...', COLORS.blue);

    const response = await httpRequest(`${API_URL}/api/v1/license/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { license_key: licenseKey });

    if (response.status === 200 && response.data.valid) {
      saveLicenseCache(licenseKey, response.data);
      return { valid: true, cached: false, plan: response.data.plan };
    }

    return { valid: false, message: response.data.message || 'Invalid license key' };
  } catch (error) {
    // If API is unreachable, use cached data if available (grace period)
    if (cached && cached.license_key === licenseKey) {
      log('API unreachable, using cached license data', COLORS.yellow);
      return { valid: true, cached: true, plan: cached.plan };
    }

    return { valid: false, message: 'Could not verify license. Check your internet connection.' };
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function makeExecutable(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.sh')) {
      const filePath = path.join(dir, file);
      fs.chmodSync(filePath, '755');
    }
  }
}

async function detectProjectType(targetDir) {
  const hasPackageJson = fs.existsSync(path.join(targetDir, 'package.json'));
  const hasRequirementsTxt = fs.existsSync(path.join(targetDir, 'requirements.txt'));
  const hasPyprojectToml = fs.existsSync(path.join(targetDir, 'pyproject.toml'));
  const hasCargoToml = fs.existsSync(path.join(targetDir, 'Cargo.toml'));
  const hasGoMod = fs.existsSync(path.join(targetDir, 'go.mod'));

  if (hasPackageJson) {
    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    if (pkg.dependencies?.next || pkg.devDependencies?.next) return 'nextjs';
    if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'react';
    if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return 'vue';
    return 'node';
  }
  if (hasRequirementsTxt || hasPyprojectToml) return 'python';
  if (hasCargoToml) return 'rust';
  if (hasGoMod) return 'go';

  return 'generic';
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const skipPrompts = args.includes('--yes') || args.includes('-y');
  const targetDir = process.cwd();

  printBanner();

  // Get license key
  let licenseKey = process.env.DEVLOOP_LICENSE_KEY;

  // Check for --license flag
  const licenseIdx = args.findIndex(a => a === '--license' || a === '-l');
  if (licenseIdx !== -1 && args[licenseIdx + 1]) {
    licenseKey = args[licenseIdx + 1];
  }

  // Prompt for license if not provided
  if (!licenseKey) {
    log('DevLoop requires a valid license to run.', COLORS.yellow);
    log('Get yours at: https://devloop.dev\n', COLORS.blue);
    licenseKey = await prompt(`Enter your license key (DL-XXXX-XXXX-XXXX): `);

    if (!licenseKey) {
      log('\nLicense key is required. Get one at https://devloop.dev', COLORS.red);
      process.exit(1);
    }
  }

  // Validate license format
  const licensePattern = /^DL-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i;
  if (!licensePattern.test(licenseKey)) {
    log('\nInvalid license key format. Expected: DL-XXXX-XXXX-XXXX', COLORS.red);
    process.exit(1);
  }

  // Verify license
  const verification = await verifyLicense(licenseKey);

  if (!verification.valid) {
    log(`\nLicense verification failed: ${verification.message}`, COLORS.red);
    log('Get a valid license at: https://devloop.dev', COLORS.yellow);
    process.exit(1);
  }

  log(`License verified! Plan: ${verification.plan}${verification.cached ? ' (cached)' : ''}`, COLORS.green);

  log(`\nSetting up DevLoop in: ${targetDir}\n`, COLORS.blue);

  // Detect project type
  const projectType = await detectProjectType(targetDir);
  log(`Detected project type: ${projectType}`, COLORS.green);

  if (!skipPrompts) {
    const confirm = await prompt(`\nThis will create:\n  - .devloop/ folder (QA config & docs)\n  - scripts/ folder (QA automation scripts)\n  - .cursorrules (AI coding guidelines)\n\nContinue? [Y/n] `);
    if (confirm.toLowerCase() === 'n') {
      log('\nAborted.', COLORS.yellow);
      process.exit(0);
    }
  }

  log('\nCreating DevLoop structure...\n', COLORS.blue);

  // Copy templates
  const devloopTemplateDir = path.join(TEMPLATES_DIR, '.devloop');
  const scriptsTemplateDir = path.join(TEMPLATES_DIR, 'scripts');
  const cursorrules = path.join(TEMPLATES_DIR, '.cursorrules');

  const targetDevloopDir = path.join(targetDir, '.devloop');
  const targetScriptsDir = path.join(targetDir, 'scripts');
  const targetCursorrules = path.join(targetDir, '.cursorrules');

  // Create .devloop folder
  if (fs.existsSync(devloopTemplateDir)) {
    copyDir(devloopTemplateDir, targetDevloopDir);
    log('  Created .devloop/', COLORS.green);
  }

  // Create scripts folder
  if (fs.existsSync(scriptsTemplateDir)) {
    copyDir(scriptsTemplateDir, targetScriptsDir);
    makeExecutable(targetScriptsDir);
    log('  Created scripts/', COLORS.green);
  }

  // Copy .cursorrules
  if (fs.existsSync(cursorrules)) {
    fs.copyFileSync(cursorrules, targetCursorrules);
    log('  Created .cursorrules', COLORS.green);
  }

  // Create .devloop/qa directory
  const qaDir = path.join(targetDevloopDir, 'qa');
  if (!fs.existsSync(qaDir)) {
    fs.mkdirSync(qaDir, { recursive: true });
    fs.mkdirSync(path.join(qaDir, 'screenshots'), { recursive: true });
  }

  // Save license key to .env if not already there
  const envFile = path.join(targetDir, '.env');
  let envContent = '';
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
  }

  if (!envContent.includes('DEVLOOP_LICENSE_KEY')) {
    const licenseEnv = `\n# DevLoop License\nDEVLOOP_LICENSE_KEY=${licenseKey}\n`;
    fs.appendFileSync(envFile, licenseEnv);
    log('  Added DEVLOOP_LICENSE_KEY to .env', COLORS.green);
  }

  log(`
${COLORS.green}${COLORS.bright}DevLoop is ready!${COLORS.reset}

${COLORS.cyan}Your license:${COLORS.reset} ${licenseKey}
${COLORS.cyan}Plan:${COLORS.reset} ${verification.plan}

${COLORS.cyan}Next steps:${COLORS.reset}

1. Configure your project in ${COLORS.yellow}.devloop/INSTRUCTIONS.md${COLORS.reset}
   - Set your tech stack, URLs, and conventions

2. Add test accounts in ${COLORS.yellow}.devloop/test-accounts.md${COLORS.reset}
   - Create QA credentials for automated testing

3. Define features in ${COLORS.yellow}.devloop/features.md${COLORS.reset}
   - List your routes and API endpoints

4. Run your first QA test:
   ${COLORS.blue}./scripts/qa.sh smoke${COLORS.reset}

${COLORS.cyan}Quick commands:${COLORS.reset}
  ./scripts/quick.sh qa          Run full QA suite
  ./scripts/quick.sh qa-api      Test API endpoints
  ./scripts/quick.sh qa-ui       Test UI with screenshots
  ./scripts/quick.sh qa-fix      Auto-fix failures with AI

${COLORS.cyan}Environment variables:${COLORS.reset}
  DEVLOOP_LICENSE_KEY   Your license key (already set in .env)
  DEVLOOP_API_URL       Your API base URL
  DEVLOOP_APP_URL       Your app base URL

${COLORS.yellow}Tip:${COLORS.reset} Run ${COLORS.blue}./scripts/quick.sh${COLORS.reset} to see all available commands.

${COLORS.cyan}Dashboard:${COLORS.reset} https://devloop.dev/dashboard
`);
}

main().catch(console.error);
