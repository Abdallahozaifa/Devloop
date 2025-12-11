import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getProjectRoot, detectPlatform, loadConfig } from '../core/config.js';
import { success, error, info, warn, spinner, confirm, printBanner } from '../utils/ui.js';

export async function deployCommand(options) {
  printBanner();

  const projectRoot = getProjectRoot();
  const platform = options.platform || detectPlatform(projectRoot);

  if (!platform) {
    error('Could not detect deployment platform');
    info('Supported platforms: fly, vercel, railway, docker');
    info('Use --platform <name> to specify manually');
    return;
  }

  info(`Detected platform: ${platform}`);

  // Get deploy command based on platform
  let deployCmd, deployArgs;

  switch (platform) {
    case 'fly':
      deployCmd = 'fly';
      deployArgs = ['deploy'];
      if (options.env === 'staging') {
        deployArgs.push('--config', 'fly.staging.toml');
      }
      break;

    case 'vercel':
      deployCmd = 'vercel';
      deployArgs = [];
      if (options.env === 'production') {
        deployArgs.push('--prod');
      }
      break;

    case 'railway':
      deployCmd = 'railway';
      deployArgs = ['up'];
      break;

    case 'docker':
      // For docker, we build and optionally push
      deployCmd = 'docker';
      deployArgs = ['build', '-t', `${path.basename(projectRoot)}:latest`, '.'];
      break;

    default:
      error(`Unsupported platform: ${platform}`);
      return;
  }

  // Check if CLI tool is available
  const spin = spinner(`Checking ${platform} CLI...`).start();

  try {
    const checkResult = await runCommand('which', [deployCmd], projectRoot);
    if (!checkResult.success) {
      spin.fail(`${platform} CLI not found`);
      error(`Please install the ${platform} CLI first`);
      return;
    }
    spin.succeed(`${platform} CLI found`);
  } catch {
    spin.fail(`${platform} CLI not found`);
    error(`Please install the ${platform} CLI first`);
    return;
  }

  // Confirm deployment
  if (!options.yes) {
    const proceed = await confirm(`Deploy to ${platform}${options.env ? ` (${options.env})` : ''}?`);
    if (!proceed) {
      info('Deployment cancelled');
      return;
    }
  }

  console.log('');
  info(`Running: ${deployCmd} ${deployArgs.join(' ')}`);
  console.log('');

  // Run deployment
  return new Promise((resolve) => {
    const child = spawn(deployCmd, deployArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      console.log('');
      if (code === 0) {
        success('Deployment complete!');
        info('Run "devloop status" to check deployment status');
      } else {
        error(`Deployment failed with exit code ${code}`);
        info('Run "devloop fix" to analyze deployment logs');
      }
      resolve();
    });

    child.on('error', (err) => {
      error(`Failed to deploy: ${err.message}`);
      resolve();
    });
  });
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        code,
      });
    });

    child.on('error', () => {
      resolve({ success: false, stdout: '', stderr: '', code: 1 });
    });
  });
}
