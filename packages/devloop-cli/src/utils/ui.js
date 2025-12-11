import chalk from 'chalk';
import ora from 'ora';

export const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

export function printBanner() {
  console.log(chalk.cyan(`
  ██████╗ ███████╗██╗   ██╗██╗      ██████╗  ██████╗ ██████╗
  ██╔══██╗██╔════╝██║   ██║██║     ██╔═══██╗██╔═══██╗██╔══██╗
  ██║  ██║█████╗  ██║   ██║██║     ██║   ██║██║   ██║██████╔╝
  ██║  ██║██╔══╝  ╚██╗ ██╔╝██║     ██║   ██║██║   ██║██╔═══╝
  ██████╔╝███████╗ ╚████╔╝ ███████╗╚██████╔╝╚██████╔╝██║
  ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝
`));
  console.log(chalk.gray('  Describe it. Ship it. Done.\n'));
}

export function success(message) {
  console.log(chalk.green('✓ ' + message));
}

export function error(message) {
  console.log(chalk.red('✗ ' + message));
}

export function warn(message) {
  console.log(chalk.yellow('⚠ ' + message));
}

export function info(message) {
  console.log(chalk.blue('ℹ ' + message));
}

export function step(message) {
  console.log(chalk.cyan('→ ' + message));
}

export function dim(message) {
  console.log(chalk.gray(message));
}

export function spinner(message) {
  return ora({
    text: message,
    color: 'cyan',
    spinner: 'dots',
  });
}

export function formatPlan(plan) {
  let output = '\n' + chalk.bold.white('Implementation Plan:\n');
  output += chalk.gray('─'.repeat(50)) + '\n\n';

  plan.steps.forEach((step, i) => {
    output += chalk.cyan(`${i + 1}. `) + chalk.white(step.description) + '\n';
    if (step.files) {
      step.files.forEach(f => {
        output += chalk.gray(`   → ${f}\n`);
      });
    }
  });

  output += '\n' + chalk.gray('─'.repeat(50)) + '\n';
  output += chalk.yellow(`Files to create/modify: ${plan.files?.length || 0}\n`);

  return output;
}

export function formatTestResults(results) {
  let output = '\n' + chalk.bold.white('Test Results:\n');
  output += chalk.gray('─'.repeat(50)) + '\n\n';

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    if (r.passed) {
      output += chalk.green(`  ✓ ${r.name}\n`);
    } else {
      output += chalk.red(`  ✗ ${r.name}\n`);
      if (r.error) {
        output += chalk.gray(`    ${r.error}\n`);
      }
    }
  });

  output += '\n' + chalk.gray('─'.repeat(50)) + '\n';
  output += chalk.green(`${passed} passed`) + chalk.gray(' | ') + chalk.red(`${failed} failed`) + '\n';

  return output;
}

export async function confirm(message) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`${message} [Y/n] `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() !== 'n');
    });
  });
}

export async function prompt(message) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan(message + ' '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
