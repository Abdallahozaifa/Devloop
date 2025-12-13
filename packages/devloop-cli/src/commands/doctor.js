
import chalk from 'chalk';
import { runHardcodeLinter } from '../core/hardcode-linter.js';
import { Command } from 'commander';

export function createDoctorCommand() {
  const doctor = new Command('doctor')
    .description('Scans the DevLoop source code for hardcoded literals.')
    .action(async () => {
      console.log(chalk.cyan('Running DevLoop Doctor...'));
      console.log(chalk.cyan('Scanning for hardcoded literals in the source code.'));

      const violations = await runHardcodeLinter();

      if (violations.length > 0) {
        console.error(chalk.red.bold('\nError: Hardcoded literals found!'));
        console.error(chalk.red('Please remove them or add them to the allow-list in src/core/hardcode-linter.js.'));
        violations.forEach(violation => {
          console.error(
            `  - ${chalk.yellow(violation.file)}:${chalk.yellow(violation.line)} - Found: ${chalk.red.bold(violation.match)}`
          );
        });
        process.exit(1);
      } else {
        console.log(chalk.green.bold('Doctor check passed! No hardcoded literals found.'));
      }
    });

  return doctor;
}
