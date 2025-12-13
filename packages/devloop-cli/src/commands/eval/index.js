
import { Command } from 'commander';
import { initHandler } from './init.js';
import { runHandler } from './run.js';
import { reportHandler } from './report.js';

export function createEvalCommand() {
  const evalCommand = new Command('eval')
    .description('Run a deterministic evaluation harness to measure agent success.');

  evalCommand
    .command('init')
    .description('Create the .devloop/eval/ directory structure.')
    .option('--repo <path>', 'Path to the target repository where .devloop/eval should be created.', process.cwd())
    .action(initHandler);

  evalCommand
    .command('run')
    .description('Run an evaluation suite.')
    .option('--repo <path>', 'Path to the target repository to run the evaluation against.', process.cwd())
    .option('--suite <name>', 'Name of the evaluation suite to run (without .yaml extension).', 'example-suite')
    .option('--model <string>', 'The AI model to use for the agent.', 'gemini-1.5-pro-latest')
    .option('--max-iterations <int>', 'Maximum number of iterations for the agent loop.', 3)
    .option('--allow-writes', 'Allow tests to make POST/PUT/DELETE requests.', false)
    .option('-v, --verbose', 'Verbose output.', false)
    .action(runHandler);

  evalCommand
    .command('report')
    .description('Generate a report from an evaluation run.')
    .argument('[run_id]', 'The ID of the run to report on. If omitted, the latest run is used.')
    .option('--repo <path>', 'Path to the target repository where the evaluation was run.', process.cwd())
    .option('--last', 'Use the latest run from the specified repository.', true)
    .action(reportHandler);

  return evalCommand;
}
