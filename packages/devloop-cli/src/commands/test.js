import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getProjectRoot, loadConfig, detectFramework } from '../core/config.js';
import { success, error, info, warn, spinner, printBanner } from '../utils/ui.js';
import { loadAllSpecs } from '../core/spec/parser.js';
import { runSpec } from '../core/spec/runners/runner.js';
import { isConfigSpec, runConfigSpec } from '../core/spec/runners/config-runner.js';
import { isUISpec, runUISpec } from '../core/spec/runners/ui-runner.js';
import { formatResults } from '../core/spec/reporter.js';
import { formatError, formatErrorFromException } from '../core/error-messages.js';
import { redactHeaders } from '../core/security.js';
import chalk from 'chalk';
import yaml from 'js-yaml';

export async function testCommand(options) {
  // Skip banner for JSON output
  if (!options.json) {
    printBanner();
  }

  const projectRoot = getProjectRoot();
  const specsDir = path.join(projectRoot, '.devloop', 'specs');

  // Handle dry-run mode
  if (options.dryRun) {
    await showTestPlan(projectRoot, options); // showTestPlan still needs all specs
    return;
  }

  // Determine which specs to run
  let specToRun = null; // Default to run all specs if specsDir exists
  if (typeof options.spec === 'string') {
    specToRun = options.spec; // Specific spec file provided
  } else if (options.spec === true) {
    // Boolean --spec flag is present, means force run all spec tests
    specToRun = null; // No specific file, run all
  } 
  
  // If we decided to run spec tests (either by --spec, or by default if specsDir exists)
  if (specToRun !== null || (fs.existsSync(specsDir) && !options.unit)) {
    await runSpecTests(projectRoot, options, specToRun); // Pass specToRun
    return;
  }


  // Fall back to framework tests
  await runFrameworkTests(projectRoot, options);
}

/**
 * Show test plan without executing (dry-run)
 */
async function showTestPlan(projectRoot, options) {
  console.log(chalk.cyan('\n🔍 DRY RUN - No requests will be made\n'));

  const specsDir = path.join(projectRoot, '.devloop', 'specs');
  if (!fs.existsSync(specsDir)) {
    console.log(formatError('NO_SPECS_FOUND'));
    return;
  }

  const specs = loadAllSpecs(specsDir);
  if (specs.length === 0) {
    console.log(formatError('NO_SPECS_FOUND'));
    return;
  }

  console.log(chalk.white('📋 Test Plan\n'));

  let apiCount = 0, contractCount = 0, uiCount = 0;
  let writeCount = 0;

  for (const spec of specs) {
    if (isConfigSpec(spec)) {
      contractCount += spec.tests?.length || 0;
      console.log(chalk.gray(`   📜 Contract: ${spec.name} (${spec.tests?.length || 0} checks)`));
    } else if (isUISpec(spec)) {
      uiCount += spec.tests?.length || 0;
      console.log(chalk.gray(`   🖥️  UI: ${spec.name} (${spec.tests?.length || 0} tests)`));
    } else {
      const testCount = spec.tests?.length || 0;
      apiCount += testCount;

      // Count write operations
      for (const test of spec.tests || []) {
        const method = test.request?.method || 'GET';
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          writeCount++;
        }
      }
      console.log(chalk.gray(`   📡 API: ${spec.name} (${testCount} tests)`));
    }
  }

  console.log(chalk.white('\n─────────────────────────────'));
  console.log(chalk.white(`Total: ${apiCount + contractCount + uiCount} tests`));
  console.log(chalk.gray(`  API: ${apiCount} (${writeCount} write operations)`));
  console.log(chalk.gray(`  Contract: ${contractCount}`));
  console.log(chalk.gray(`  UI: ${uiCount}`));

  // Read-only mode warnings
  const isReadOnly = !options.allowWrites;
  if (isReadOnly && writeCount > 0) {
    console.log(chalk.yellow(`\n⚠️  ${writeCount} write tests will be SKIPPED (read-only mode)`));
    console.log(chalk.gray('   Use --allow-writes to enable POST/PUT/DELETE tests'));
  }

  if (options.skipUi && uiCount > 0) {
    console.log(chalk.yellow(`\n⚠️  ${uiCount} UI tests will be SKIPPED (--skip-ui)`));
  }

  if (options.skipContracts && contractCount > 0) {
    console.log(chalk.yellow(`\n⚠️  ${contractCount} contract checks will be SKIPPED (--skip-contracts)`));
  }

  console.log(chalk.green('\n✅ Run without --dry-run to execute tests\n'));
}

async function runSpecTests(projectRoot, options, specToRun = null) {
  const specsDir = path.join(projectRoot, '.devloop', 'specs');
  const isJson = options.json;

  let specs = [];
  if (specToRun) { // If a specific spec file is provided
    // Support both absolute paths and relative paths (resolved against cwd or specsDir)
    let specFilePath;
    if (path.isAbsolute(specToRun)) {
      specFilePath = specToRun;
    } else if (fs.existsSync(specToRun)) {
      specFilePath = path.resolve(specToRun);
    } else {
      specFilePath = path.resolve(specsDir, specToRun);
    }

    if (!fs.existsSync(specFilePath)) {
      console.log(`Spec file not found: ${specToRun}`);
      process.exitCode = 1;
      return;
    }
    const content = fs.readFileSync(specFilePath, 'utf-8');
    specs = [yaml.load(content)];
  } else {
    // If no specific spec file, load all specs from the directory
    if (!fs.existsSync(specsDir)) {
      if (isJson) {
        console.log(JSON.stringify({ error: 'No specs found', specs: [] }));
      } else {
        console.log(formatError('NO_SPECS_FOUND'));
      }
      return;
    }
    specs = loadAllSpecs(specsDir);
  }

  if (specs.length === 0) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'No spec files found to run', specs: [] }));
    } else {
      console.log(formatError('NO_SPECS_FOUND'));
    }
    return;
  }


  // Get API URL from options or config
  const config = loadConfig();
  const apiUrl = options.apiUrl || options.url || config.apiUrl || process.env.API_URL || 'http://localhost:3000';

  // Determine read-only mode (default: true unless --allow-writes)
  const isReadOnly = !options.allowWrites;

  if (!isJson) {
    console.log(chalk.cyan(`\nRunning ${specs.length} spec file(s) against ${apiUrl}`));
    if (isReadOnly) {
      console.log(chalk.gray('   Mode: read-only (only GET requests)'));
      console.log(chalk.gray('   Use --allow-writes to enable mutations\n'));
    } else {
      console.log(chalk.yellow('   Mode: full (includes POST/PUT/DELETE)\n'));
    }
  }

  const context = {
    apiUrl,
    variables: {},
    auth: {},
    readOnly: isReadOnly,
    skipUi: options.skipUi,
    skipContracts: options.skipContracts,
  };

  // Add auth from options if provided
  if (options.token) {
    context.auth.user = { token: options.token };
  }

  const allResults = [];

  for (const spec of specs) {
    let results;

    try {
      if (isConfigSpec(spec)) {
        // Skip contracts if requested
        if (options.skipContracts) {
          if (!isJson) {
            console.log(chalk.gray(`\n  Contract: ${spec.name} (SKIPPED)`));
          }
          results = { name: spec.name, tests: [], passed: 0, failed: 0, skipped: spec.tests?.length || 0 };
        } else {
          if (!isJson) {
            console.log(chalk.cyan(`\n  Contract: ${spec.name}`));
          }
          results = await runConfigSpec(spec, { projectDir: projectRoot });
        }
      } else if (isUISpec(spec)) {
        // Skip UI tests if requested
        if (options.skipUi) {
          if (!isJson) {
            console.log(chalk.gray(`\n  UI: ${spec.name} (SKIPPED)`));
          }
          results = { name: spec.name, tests: [], passed: 0, failed: 0, skipped: spec.tests?.length || 0 };
        } else {
          if (!isJson) {
            console.log(chalk.cyan(`\n  UI: ${spec.name}`));
          }
          results = await runUISpec(spec, { baseUrl: apiUrl, apiUrl });
        }
      } else {
        // API/standard spec - run HTTP tests
        if (!isJson) {
          console.log(chalk.cyan(`\n  API: ${spec.name}`));
        }
        results = await runSpec(spec, context);
      }
    } catch (err) {
      if (!isJson) {
        console.log(formatErrorFromException(err));
      }
      results = {
        name: spec.name,
        tests: [],
        passed: 0,
        failed: 1,
        skipped: 0,
        error: err.message,
      };
    }

    allResults.push(results);
  }

  // Format and display results
  console.log(formatResults(allResults, { verbose: options.verbose, json: isJson }));

  // Return exit code based on results
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

async function runFrameworkTests(projectRoot, options) {
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
