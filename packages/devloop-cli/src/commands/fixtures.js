import { Command } from 'commander';
import { setupFixtures, checkFixtureStatus, teardownFixtures } from '../core/fixtures/runner.js';

export const fixturesCommand = new Command('fixtures')
  .description('Manage test data fixtures');

fixturesCommand
  .command('setup')
  .description('Create test fixtures and cache IDs')
  .option('-u, --api-url <url>', 'API base URL', process.env.API_URL)
  .option('-t, --token <token>', 'Auth token (bypasses email/password auth)')
  .action(async (options) => {
    const apiUrl = options.apiUrl;
    if (!apiUrl) {
      console.log('❌ API URL required. Use --api-url or set API_URL env var');
      process.exit(1);
    }

    const projectDir = process.cwd();
    const results = await setupFixtures(projectDir, apiUrl, { token: options.token });

    if (!results || results.failed.length > 0) {
      process.exit(1);
    }
  });

fixturesCommand
  .command('status')
  .description('Show fixture status and cached IDs')
  .option('-u, --api-url <url>', 'API base URL', process.env.API_URL)
  .action(async (options) => {
    const projectDir = process.cwd();
    await checkFixtureStatus(projectDir, options.apiUrl);
  });

fixturesCommand
  .command('teardown')
  .description('Delete fixtures and clear cache')
  .option('-u, --api-url <url>', 'API base URL', process.env.API_URL)
  .action(async (options) => {
    const apiUrl = options.apiUrl;
    if (!apiUrl) {
      console.log('❌ API URL required. Use --api-url or set API_URL env var');
      process.exit(1);
    }

    const projectDir = process.cwd();
    await teardownFixtures(projectDir, apiUrl);
  });

fixturesCommand
  .command('reset')
  .description('Teardown then setup (fresh fixtures)')
  .option('-u, --api-url <url>', 'API base URL', process.env.API_URL)
  .option('-t, --token <token>', 'Auth token (bypasses email/password auth)')
  .action(async (options) => {
    const apiUrl = options.apiUrl;
    if (!apiUrl) {
      console.log('❌ API URL required. Use --api-url or set API_URL env var');
      process.exit(1);
    }

    const projectDir = process.cwd();
    console.log('🔄 Resetting fixtures...\n');

    await teardownFixtures(projectDir, apiUrl);
    console.log('');
    await setupFixtures(projectDir, apiUrl, { token: options.token });
  });

export default fixturesCommand;
