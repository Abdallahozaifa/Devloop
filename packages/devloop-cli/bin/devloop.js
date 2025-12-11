#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { buildCommand } from '../src/commands/build.js';
import { testCommand } from '../src/commands/test.js';
import { deployCommand } from '../src/commands/deploy.js';
import { fixCommand } from '../src/commands/fix.js';
import { statusCommand } from '../src/commands/status.js';
import { auditCommand } from '../src/commands/audit.js';
import { qaCommand } from '../src/commands/qa.js';
const program = new Command();

program
  .name('devloop')
  .description('DevLoop CLI - Describe it. Ship it. Done.')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize DevLoop in current project')
  .option('-l, --license <key>', 'License key (or set DEVLOOP_LICENSE_KEY env)')
  .option('-y, --yes', 'Skip prompts')
  .action(initCommand);

program
  .command('build')
  .description('Build a feature using AI')
  .argument('<description>', 'Description of what to build')
  .option('-y, --yes', 'Auto-confirm the plan')
  .option('--no-test', 'Skip running tests after build')
  .action(buildCommand);

program
  .command('test')
  .description('Run tests')
  .option('-w, --watch', 'Watch mode')
  .option('-v, --verbose', 'Verbose output')
  .action(testCommand);

program
  .command('deploy')
  .description('Deploy to production')
  .option('-p, --platform <platform>', 'Platform (fly, vercel, railway)')
  .option('--no-verify', 'Skip verification after deploy')
  .action(deployCommand);

program
  .command('fix')
  .description('Analyze production logs and fix errors')
  .option('--auto', 'Automatically apply fixes')
  .action(fixCommand);

program
  .command('status')
  .description('Show project and license status')
  .action(statusCommand);

program
  .command('audit')
  .description('Audit project to discover features, pages, and endpoints')
  .option('-v, --verbose', 'Show detailed feature matrix')
  .action(auditCommand);

program
  .command('qa')
  .description('Run QA tests on discovered features')
  .option('-u, --url <url>', 'Base URL to test')
  .option('-a, --api-url <apiUrl>', 'API base URL')
  .option('-f, --flow <flow>', 'Test specific flow (e.g., "authentication")')
  .option('--fix', 'Attempt to auto-fix failures')
  .option('--no-auth', 'Skip authentication/credentials (run only public tests)')
  .option('--skip-ui', 'Skip UI tests')
  .action(qaCommand);

program.parse();
