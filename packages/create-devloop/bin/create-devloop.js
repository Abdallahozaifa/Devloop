#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

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
  --help, -h     Show this help message
  --yes, -y      Skip prompts and use defaults

What this does:
  1. Creates .claude/ folder with QA documentation templates
  2. Creates scripts/ folder with automated QA scripts
  3. Creates .cursorrules for AI-assisted development

The scripts enable:
  - Autonomous API endpoint testing
  - UI screenshot testing with AI vision
  - Auto-fix loop that finds bugs and fixes them
  - Integration with Claude CLI for AI-powered debugging
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

  log(`Setting up DevLoop in: ${targetDir}\n`, COLORS.blue);

  // Detect project type
  const projectType = await detectProjectType(targetDir);
  log(`Detected project type: ${projectType}`, COLORS.green);

  if (!skipPrompts) {
    const confirm = await prompt(`\nThis will create:\n  - .claude/ folder (QA config & docs)\n  - scripts/ folder (QA automation scripts)\n  - .cursorrules (AI coding guidelines)\n\nContinue? [Y/n] `);
    if (confirm.toLowerCase() === 'n') {
      log('\nAborted.', COLORS.yellow);
      process.exit(0);
    }
  }

  log('\nCreating DevLoop structure...\n', COLORS.blue);

  // Copy templates
  const claudeTemplateDir = path.join(TEMPLATES_DIR, '.claude');
  const scriptsTemplateDir = path.join(TEMPLATES_DIR, 'scripts');
  const cursorrules = path.join(TEMPLATES_DIR, '.cursorrules');

  const targetClaudeDir = path.join(targetDir, '.claude');
  const targetScriptsDir = path.join(targetDir, 'scripts');
  const targetCursorrules = path.join(targetDir, '.cursorrules');

  // Create .claude folder
  if (fs.existsSync(claudeTemplateDir)) {
    copyDir(claudeTemplateDir, targetClaudeDir);
    log('  Created .claude/', COLORS.green);
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

  // Create .claude/qa directory
  const qaDir = path.join(targetClaudeDir, 'qa');
  if (!fs.existsSync(qaDir)) {
    fs.mkdirSync(qaDir, { recursive: true });
    fs.mkdirSync(path.join(qaDir, 'screenshots'), { recursive: true });
  }

  log(`
${COLORS.green}${COLORS.bright}DevLoop is ready!${COLORS.reset}

${COLORS.cyan}Next steps:${COLORS.reset}

1. Configure your project in ${COLORS.yellow}.claude/INSTRUCTIONS.md${COLORS.reset}
   - Set your tech stack, URLs, and conventions

2. Add test accounts in ${COLORS.yellow}.claude/test-accounts.md${COLORS.reset}
   - Create QA credentials for automated testing

3. Define features in ${COLORS.yellow}.claude/features.md${COLORS.reset}
   - List your routes and API endpoints

4. Run your first QA test:
   ${COLORS.blue}./scripts/qa.sh smoke${COLORS.reset}

${COLORS.cyan}Quick commands:${COLORS.reset}
  ./scripts/quick.sh qa          Run full QA suite
  ./scripts/quick.sh qa-api      Test API endpoints
  ./scripts/quick.sh qa-ui       Test UI with screenshots
  ./scripts/quick.sh qa-fix      Auto-fix failures with AI

${COLORS.cyan}Environment variables:${COLORS.reset}
  DEVLOOP_API_URL     Your API base URL
  DEVLOOP_APP_URL     Your app base URL
  ANTHROPIC_API_KEY   For AI vision checks (optional)

${COLORS.yellow}Tip:${COLORS.reset} Run ${COLORS.blue}./scripts/quick.sh${COLORS.reset} to see all available commands.
`);
}

main().catch(console.error);
