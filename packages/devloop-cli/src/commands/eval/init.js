
import path from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';

export async function initHandler(options) {
  const targetRepoPath = path.resolve(options.repo);
  const evalRoot = path.join(targetRepoPath, '.devloop', 'eval');
  const directories = [
    path.join(evalRoot, 'tasks'),
    path.join(evalRoot, 'suites'),
    path.join(evalRoot, 'specs'),
    path.join(evalRoot, 'runs'),
    path.join(evalRoot, 'report'),
  ];

  console.log(chalk.cyan('Initializing DevLoop evaluation harness...'));

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(chalk.green(`  Created directory: ${dir}`));
    } catch (error) {
      console.error(chalk.red(`  Failed to create directory ${dir}: ${error.message}`));
      return;
    }
  }

  // Create an example task file
  const exampleTaskPath = path.join(evalRoot, 'tasks', 'example-task.yaml');
  const exampleTaskContent = `
id: health-check-task
description: "Add a new health check endpoint at /healthz that returns a JSON object with a 'status' key set to 'ok'."
repo_context:
  include:
    - "index.js"
gates:
  - command: "test"
    args: "--spec 'GET /healthz returns 200 with JSON { status: \\'ok\\' }'"
variables:
  - name: "PORT"
    default: "8080"
`;
  try {
    await fs.writeFile(exampleTaskPath, exampleTaskContent.trim());
    console.log(chalk.green(`  Created example task: ${exampleTaskPath}`));
  } catch (error) {
    console.error(chalk.red(`  Failed to create example task file: ${error.message}`));
  }

  // Create an example suite file
  const exampleSuitePath = path.join(evalRoot, 'suites', 'example-suite.yaml');
  const exampleSuiteContent = `
name: "Example Suite"
description: "An example evaluation suite that runs a single task."
tasks:
  - "./tasks/health-check-task.yaml"
`;
  try {
    await fs.writeFile(exampleSuitePath, exampleSuiteContent.trim());
    console.log(chalk.green(`  Created example suite: ${exampleSuitePath}`));
  } catch (error) {
    console.error(chalk.red(`  Failed to create example suite file: ${error.message}`));
  }

  console.log(chalk.cyan('\nDevLoop evaluation harness initialized successfully.'));
  console.log('Next steps:');
  console.log('1. Review and customize the tasks in .devloop/eval/tasks/');
  console.log('2. Review and customize the suites in .devloop/eval/suites/');
  console.log('3. Run an evaluation with `devloop eval run --suite example-suite`.');
}
