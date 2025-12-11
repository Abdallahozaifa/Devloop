import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getProjectRoot, loadConfig, detectFramework } from '../core/config.js';
import { success, error, info, warn, spinner, printBanner } from '../utils/ui.js';

export async function testCommand(options) {
  printBanner();

  const projectRoot = getProjectRoot();
  const config = loadConfig();
  const framework = detectFramework(projectRoot);

  info(`Test framework: ${framework.testFramework}`);

  // Determine test command based on framework
  let testCmd, testArgs;

  switch (framework.testFramework) {
    case 'jest':
      testCmd = 'npx';
      testArgs = ['jest', '--passWithNoTests'];
      if (options.watch) testArgs.push('--watch');
      if (options.coverage) testArgs.push('--coverage');
      break;

    case 'vitest':
      testCmd = 'npx';
      testArgs = ['vitest', 'run'];
      if (options.watch) testArgs = ['vitest'];
      if (options.coverage) testArgs.push('--coverage');
      break;

    case 'pytest':
      testCmd = 'pytest';
      testArgs = ['-v'];
      if (options.coverage) testArgs.push('--cov');
      break;

    case 'cargo':
      testCmd = 'cargo';
      testArgs = ['test'];
      break;

    case 'go':
      testCmd = 'go';
      testArgs = ['test', './...'];
      if (options.coverage) testArgs.push('-cover');
      break;

    default:
      // Try to detect from package.json scripts
      const pkgPath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.test) {
          testCmd = 'npm';
          testArgs = ['test'];
        } else {
          error('No test script found in package.json');
          info('Add a "test" script or configure a test framework');
          return;
        }
      } else {
        error('Could not detect test framework');
        return;
      }
  }

  console.log('');
  info(`Running: ${testCmd} ${testArgs.join(' ')}`);
  console.log('');

  // Run tests
  return new Promise((resolve) => {
    const child = spawn(testCmd, testArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      console.log('');
      if (code === 0) {
        success('All tests passed!');
      } else {
        error(`Tests failed with exit code ${code}`);
        info('Run "devloop fix" to analyze and fix test failures');
      }
      resolve();
    });

    child.on('error', (err) => {
      error(`Failed to run tests: ${err.message}`);
      resolve();
    });
  });
}
