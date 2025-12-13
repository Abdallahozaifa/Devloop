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
import { createSpecCommand } from '../src/commands/spec.js';
import { validateCommand } from '../src/commands/validate.js';
import { lint } from '../src/commands/lint.js';
import { fixturesCommand } from '../src/commands/fixtures.js';
import { createDoctorCommand } from '../src/commands/doctor.js';
import { createEvalCommand } from '../src/commands/eval/index.js';
const program = new Command();

program
  .name('devloop')
  .description('DevLoop CLI - Describe it. Ship it. Done.')
  .version('0.1.0');

program.addCommand(createDoctorCommand());
program.addCommand(createEvalCommand());

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
  .description('Run tests (spec tests if .devloop/specs exists, otherwise framework tests)')
  .option('-w, --watch', 'Watch mode')
  .option('-v, --verbose', 'Verbose output')
  .option('-s, --spec <file>', 'Run a specific spec file from .devloop/specs/')
  .option('-u, --unit', 'Force unit/framework tests')
  .option('--url <url>', 'Base URL for spec tests')
  .option('--api-url <apiUrl>', 'API URL for spec tests')
  .option('--token <token>', 'Auth token for authenticated tests')
  .option('--coverage', 'Run with coverage (framework tests)')
  .option('--json', 'Output results as JSON (for CI/CD integration)')
  .option('--dry-run', 'Show what would be tested without making requests')
  .option('--allow-writes', 'Enable POST/PUT/DELETE tests (default: read-only)')
  .option('--skip-ui', 'Skip UI tests (useful if no browser installed)')
  .option('--skip-contracts', 'Skip contract checks')
  .action(testCommand);

// Add spec command
program.addCommand(createSpecCommand());

// Add fixtures command
program.addCommand(fixturesCommand);

program
  .command('deploy')
  .description('Deploy to production')
  .option('-p, --platform <platform>', 'Platform (fly, vercel, railway)')
  .option('-y, --yes', 'Skip confirmation prompt')
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
  .option('--live', 'Run live production flow tests (register, login, CRUD)')
  .action(qaCommand);

program
  .command('validate')
  .description('Scan codebase for configuration issues (hardcoded URLs, wrong API patterns)')
  .option('-v, --verbose', 'Show verbose output')
  .option('-q, --quick', 'Quick scan - just report summary')
  .action(validateCommand);

program
  .command('lint')
  .description('Fast static analysis to catch API/frontend shape mismatches')
  .option('--json', 'Output results as JSON')
  .option('--fix', 'Show fix suggestions')
  .action(async (options) => {
    await lint({ ...options, cwd: process.cwd() });
  });

program.parse();
