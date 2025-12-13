import path from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Evaluator {
  constructor(options) {
    this.repoPath = path.resolve(options.repo);
    this.suite = options.suite;
    this.model = options.model;
    this.maxIterations = options.maxIterations;
    this.allowWrites = options.allowWrites;
    this.verbose = options.verbose;
    this.runId = new Date().toISOString().replace(/:/g, '-').slice(0, 19) + '-' + uuidv4().slice(0, 4);
    this.evalRoot = path.join(this.repoPath, '.devloop', 'eval');
    this.runsRoot = path.join(this.evalRoot, 'runs');
    this.runPath = path.join(this.runsRoot, this.runId);
    this.results = [];
  }

  async run() {
    console.log(chalk.cyan(`Starting evaluation run ${this.runId} for repo ${this.repoPath}...`));
    await fs.mkdir(this.runPath, { recursive: true });

    // 1. Ensure .devloop is initialized in the target repo
    await this.ensureDevloopInitialized();

    // 2. Find and parse the suite file
    const tasks = await this.getTasks();
    if (!tasks) return;

    // 3. Loop through tasks and variants
    for (const task of tasks) {
      console.log(chalk.blue.bold(`\nRunning task: ${task.id}`));
      const variants = ['vague', 'basic', 'comprehensive'];

      for (const variant of variants) {
        console.log(chalk.magenta(`\n  Running variant: ${variant}`));
        const result = await this.runSingleEvaluation(task, variant);
        this.results.push(result);
        await this.saveResults();
      }
    }

    console.log(chalk.cyan(`\nEvaluation run ${this.runId} finished.`));
    console.log(chalk.cyan(`See report details in ${this.runPath}`));
  }

  async ensureDevloopInitialized() {
    const devloopDir = path.join(this.repoPath, '.devloop');
    try {
      await fs.access(devloopDir);
    } catch (error) {
      console.log(chalk.yellow(`No .devloop directory found in ${this.repoPath}. Running 'devloop init'...`));
      await this.runCommand(`node ${path.resolve(__dirname, '../../bin/devloop.js')} init -y`, this.repoPath);
    }
  }

  async getTasks() {
    const suitePath = path.join(this.evalRoot, 'suites', `${this.suite}.yaml`);
    try {
      const suiteContent = await fs.readFile(suitePath, 'utf8');
      const suiteData = yaml.load(suiteContent);

      const taskPromises = suiteData.tasks.map(async (taskPath) => {
        const fullTaskPath = path.join(this.evalRoot, taskPath);
        const taskContent = await fs.readFile(fullTaskPath, 'utf8');
        const taskData = yaml.load(taskContent);
        // Add the file path to the task object for later reference
        taskData.filePath = fullTaskPath;
        return taskData;
      });

      return Promise.all(taskPromises);

    } catch (error) {
      console.error(chalk.red(`Error: Could not load suite file at ${suitePath}.`));
      console.error(error.message);
      return null;
    }
  }

  async runSingleEvaluation(task, variant) {
    const variantPath = path.join(this.runPath, task.id, variant);
    await fs.mkdir(variantPath, { recursive: true });

    let iterations = 0;
    let status = 'RED';
    let failureReason = 'unknown';
    let failureDetails = 'Max iterations reached.';
    let specFileName = ''; // Declare specFileName here
    let currentPrompt = task.description;
    let testResult = { numTests: 0, success: false, stdout: '', stderr: '' }; // Declare with default

    while(iterations < this.maxIterations) {
      iterations++;
      console.log(chalk.gray(`    Iteration ${iterations}...`));

      // Step 1: Generate spec
      specFileName = `eval-${task.id}-${variant}-iter${iterations}.yaml`;
      const specFilePath = path.join(this.repoPath, '.devloop', 'specs', specFileName);
      
      try {
        await this.generateSpec(specFileName, task, variant, currentPrompt);
      } catch (error) {
        if (error.message.startsWith('spec_generation_warning')) {
            failureReason = 'spec_generation_warning';
            failureDetails = error.message;
            console.log(chalk.red(`    ❌ WARNING: ${failureReason}`));
            // Do not break, allow refinement loop to continue with this categorized failure
        } else {
            failureReason = 'extraction_failure';
            failureDetails = error.stderr || error.message;
            break; // Stop if other spec generation failure occurs
        }
      }

      // Step 2: Run tests
      testResult = await this.runTests(specFileName);

      // Step 3: Determine GREEN/RED
      if (testResult.success && testResult.numTests > 0) {
        status = 'GREEN';
        failureReason = null;
        failureDetails = null;
        console.log(chalk.green.bold('    ✅ SUCCESS: All gates passed!'));
        break; // Exit loop on success
      } else {
        status = 'RED'; // Always RED if not GREEN

        if (testResult.success && testResult.numTests === 0) { // If it "succeeded" with 0 tests
            failureReason = 'no_tests_executed';
            failureDetails = 'Spec resulted in 0 tests being executed.';
        } else { // Actual failure
            failureReason = this.categorizeFailure(testResult.stderr, testResult.stdout);
            failureDetails = testResult.stderr;
        }
        
        // Log failure details
        if (this.verbose || status === 'RED') { // Always log if verbose or actually failed
            console.error(chalk.red('    DevLoop Test STDOUT on failure:'), testResult.stdout);
            console.error(chalk.red('    DevLoop Test STDERR on failure:'), testResult.stderr);
        }
        console.log(chalk.red(`    ❌ FAILURE: ${failureReason}`));
      }

      // Step 4: Refinement (for comprehensive variant only)
      if (variant === 'comprehensive') {
        currentPrompt = `The previous attempt failed. Here is the error:\n\n${testResult.stderr}\n\nPlease refine the spec to fix this issue. The original task was: "${task.description}"`;
      } else {
        // For vague and basic, we only run once.
        break;
      }
    }

    const result = {
      runId: this.runId,
      taskId: task.id,
      variant,
      status,
      iterations,
      specFileUsed: specFileName, // Store the name of the spec file used
      numberOfTestsExecuted: testResult.numTests || 0, // Assuming runTests can return this
      failureReason,
      failureDetails,
    };
    
    // We don't save full artifacts yet, just the result.
    // This could be extended to save spec files, logs, etc.
    
    return result;
  }

  async generateSpec(specFileName, task, variant, prompt) {
    const specFilePath = path.join(this.repoPath, '.devloop', 'specs', specFileName);
    let specContent = '';
    let numTests = 0;

    if (variant === 'vague') {
      specContent = `
name: ${task.id} (vague)
type: api
description: ${task.description}
tests: [] # No tests in vague spec
`;
      numTests = 0;
    } else if (variant === 'basic') {
        specContent = `
name: ${task.id} (basic)
type: api
description: ${task.description}
tests:
  - name: Basic health check
    as: guest
    request:
      method: GET
      path: /health
    expect:
      status: 200
`;
      numTests = 1;
    } else if (variant === 'comprehensive') {
        const cmd = `node ${path.resolve(__dirname, '../../bin/devloop.js')} spec generate "${prompt}" --file "${specFileName}"`;
        try {
            const { stdout: specGenStdout, stderr: specGenStderr } = await this.runCommand(cmd, this.repoPath);
            console.log('DEBUG: spec generate stdout:', specGenStdout);
            console.log('DEBUG: spec generate stderr:', specGenStderr);
            if (specGenStderr && (specGenStderr.includes('❌') || specGenStderr.includes('Error:'))) {
                 throw new Error(specGenStderr); // Re-throw to be caught by runSingleEvaluation
            }
            if (specGenStdout && specGenStdout.includes('YAML parse warning')) { // New check
                 throw new Error('spec_generation_warning: YAML parse warning during spec generation. Check spec output for details.');
            }
        } catch (error) {
            console.error('DEBUG: spec generate error:', error);
            // If the error indicates a spec generation warning, we categorize it but allow iteration to continue
            if (error.message.startsWith('spec_generation_warning')) {
                throw error; // Re-throw the warning error to be caught and categorized
            }
            // For other extraction_failure errors, we still break
            throw error;
        }
        return; // The command writes the file directly
    }

    await fs.writeFile(specFilePath, specContent.trim());
    return { numTests };
  }

  async runTests(specFileName) {
    let cmd = `node ${path.resolve(__dirname, '../../bin/devloop.js')} test --spec "${specFileName}" --json`;
    if (this.allowWrites) cmd += ' --allow-writes';
    if (this.verbose) cmd += ' -v';
    
    try {
      const { stdout, stderr } = await this.runCommand(cmd, this.repoPath);
      // Parse JSON output from devloop test to get test count and results
      let result = { totalTests: 0, totalFailed: 0, stdout, stderr };
      try {
        const jsonStartIndex = stdout.indexOf('{');
        if (jsonStartIndex !== -1) {
            result = JSON.parse(stdout.substring(jsonStartIndex));
            result.stdout = stdout; // Retain full stdout
            result.stderr = stderr; // Retain full stderr
        } else {
            console.warn(chalk.yellow(`Warning: No JSON output found from 'devloop test'. Raw stdout:\n${stdout}`));
        }
      } catch (jsonError) {
        console.warn(chalk.yellow(`Warning: Could not parse JSON output from 'devloop test'. JSON parsing error: ${jsonError.message}. Raw stdout:\n${stdout}`));
      }
      const numTests = result.totalTests || 0;
      return { success: result.totalFailed === 0, stdout, stderr, numTests };
    } catch (error) {
      return { success: false, stdout: error.stdout, stderr: error.stderr, numTests: 0 };
    }
  }

  categorizeFailure(stderr, stdout) { // Added stdout parameter
    if (stderr.includes('Contract validation failed')) return 'contract_failure';
    if (stderr.includes('Spec validation failed')) return 'spec_validation_failure';
    if (stderr.includes('Test failed') || stderr.includes('❌')) return 'test_failure';
    if (stderr.includes('Error: No spec files found') || stderr.includes('Error: Spec file not found')) return 'spec_not_found';
    if (stderr.includes('ANTHROPIC_API_KEY') || stderr.includes('AI generation failed')) return 'extraction_failure';
    if (stdout && stdout.includes('YAML parse warning')) return 'spec_generation_warning'; // New category
    if (stderr.includes('Unknown command')) return 'cli_command_error'; // New category for issues with calling devloop commands
    if (stderr.includes('no_tests_executed')) return 'no_tests_executed'; // New category
    return 'unknown';
  }
  
  async runCommand(command, cwd) {
    return execPromise(command, { cwd });
  }

  async saveResults() {
    const resultsFilePath = path.join(this.runPath, 'run-results.json');
    await fs.writeFile(resultsFilePath, JSON.stringify(this.results, null, 2));
  }
}

export async function runHandler(options) {
  const evaluator = new Evaluator(options);
  await evaluator.run();
}