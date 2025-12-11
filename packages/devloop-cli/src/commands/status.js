import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getProjectRoot, loadConfig, detectFramework, detectPlatform, getLicenseKey, CONFIG_DIR } from '../core/config.js';
import { verifyLicense } from '../core/license.js';
import { success, error, info, warn, dim, printBanner } from '../utils/ui.js';
import chalk from 'chalk';

export async function statusCommand(options) {
  printBanner();

  const projectRoot = getProjectRoot();
  const configDir = path.join(projectRoot, CONFIG_DIR);

  // Check initialization
  if (!fs.existsSync(configDir)) {
    warn('DevLoop is not initialized in this project');
    info('Run "devloop init" to get started');
    return;
  }

  const config = loadConfig();
  const framework = detectFramework(projectRoot);
  const platform = detectPlatform(projectRoot);

  console.log('');
  console.log(chalk.bold.white('Project Status'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  // Project info
  console.log(chalk.cyan('Project:'));
  console.log(`  Root:      ${projectRoot}`);
  console.log(`  Framework: ${framework.type} (${framework.language})`);
  console.log(`  Tests:     ${framework.testFramework}`);
  if (platform) {
    console.log(`  Platform:  ${platform}`);
  }
  console.log('');

  // License status
  const licenseKey = getLicenseKey();
  if (licenseKey) {
    console.log(chalk.cyan('License:'));
    console.log(`  Key:       ${maskLicenseKey(licenseKey)}`);

    const verification = await verifyLicense(licenseKey);
    if (verification.valid) {
      console.log(`  Status:    ${chalk.green('Active')}`);
      console.log(`  Plan:      ${verification.plan}`);
      if (verification.email) {
        console.log(`  Email:     ${verification.email}`);
      }
      if (verification.throttle) {
        console.log(`  API Calls: ${verification.throttle.remaining}/${verification.throttle.limit} remaining`);
      }
      if (verification.cached) {
        dim('  (cached)');
      }
    } else {
      console.log(`  Status:    ${chalk.red('Invalid')}`);
    }
  } else {
    console.log(chalk.cyan('License:'));
    console.log(`  Status:    ${chalk.yellow('Not configured')}`);
  }
  console.log('');

  // Git status
  if (fs.existsSync(path.join(projectRoot, '.git'))) {
    console.log(chalk.cyan('Git:'));
    const gitStatus = await getGitStatus(projectRoot);
    if (gitStatus) {
      console.log(`  Branch:    ${gitStatus.branch}`);
      console.log(`  Status:    ${gitStatus.clean ? chalk.green('Clean') : chalk.yellow('Modified')}`);
      if (!gitStatus.clean) {
        console.log(`  Changed:   ${gitStatus.changed} files`);
      }
    }
    console.log('');
  }

  // Recent activity
  const historyFile = path.join(configDir, 'history.json');
  if (fs.existsSync(historyFile)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      if (history.runs && history.runs.length > 0) {
        console.log(chalk.cyan('Recent Activity:'));
        const recent = history.runs.slice(-5).reverse();
        recent.forEach(run => {
          const date = new Date(run.timestamp).toLocaleDateString();
          console.log(`  ${date}: ${run.command} - ${run.description || ''}`);
        });
        console.log('');
      }
    } catch {
      // Ignore history parse errors
    }
  }

  // Quick actions
  console.log(chalk.cyan('Quick Actions:'));
  console.log('  devloop build "description"  - Generate code from description');
  console.log('  devloop test                 - Run tests');
  console.log('  devloop deploy               - Deploy to production');
  console.log('  devloop fix                  - Analyze and fix errors');
  console.log('');
}

function maskLicenseKey(key) {
  if (!key) return '';
  const parts = key.split('-');
  if (parts.length !== 4) return '****';
  return `${parts[0]}-${parts[1]}-****-****`;
}

async function getGitStatus(cwd) {
  return new Promise((resolve) => {
    const child = spawn('git', ['status', '--porcelain', '-b'], { cwd, shell: true });
    let output = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const lines = output.trim().split('\n');
      const branchLine = lines[0] || '';
      const branchMatch = branchLine.match(/^## ([^\s.]+)/);

      resolve({
        branch: branchMatch ? branchMatch[1] : 'unknown',
        clean: lines.length <= 1,
        changed: Math.max(0, lines.length - 1),
      });
    });

    child.on('error', () => {
      resolve(null);
    });
  });
}
