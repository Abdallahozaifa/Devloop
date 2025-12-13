
import path from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import { Report } from './structures.js';
import yaml from 'js-yaml';

class Reporter {
  constructor(runId, repoPath = process.cwd()) {
    if (!runId) {
      throw new Error('A runId must be provided to the Reporter.');
    }
    this.runId = runId;
    this.repoPath = path.resolve(repoPath);
    this.evalRoot = path.join(this.repoPath, '.devloop', 'eval');
    this.runPath = path.join(this.evalRoot, 'runs', this.runId);
    this.reportDir = path.join(this.evalRoot, 'report');
  }

  async generateReport() {
    console.log(chalk.cyan(`Generating report for run ${this.runId}...`));

    const report = new Report(this.runId);
    
    // In the full implementation, this would scan the run directory
    // and load the result artifact from each task/variant.
    const runResults = await this.collectRunResults();
    if (!runResults) {
        console.error(chalk.red(`Could not find any results for run ID "${this.runId}" in repository "${this.repoPath}". Did the run complete successfully?`));
        return;
    }
    
    for (const result of runResults) {
        report.addResult(result);
    }

    report.generate();

    await this.saveReport(report);

    console.log(chalk.green(`Report generated successfully in ${this.reportDir}`));
    console.log(`  - ${path.join(this.reportDir, `${this.runId}-report.json`)}`);
    console.log(`  - ${path.join(this.reportDir, `${this.runId}-report.md`)}`);
  }

  async collectRunResults() {
    const resultsFilePath = path.join(this.runPath, 'run-results.json');
    try {
      const resultsContent = await fs.readFile(resultsFilePath, 'utf8');
      return JSON.parse(resultsContent);
    } catch (error) {
      return null;
    }
  }

  async saveReport(report) {
    await fs.mkdir(this.reportDir, { recursive: true });
    const reportJsonPath = path.join(this.reportDir, `${this.runId}-report.json`);
    const reportMdPath = path.join(this.reportDir, `${this.runId}-report.md`);

    // Save JSON report
    await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2));

    // Save Markdown report
    let mdContent = `# Evaluation Report: ${this.runId}\n\n`;
    mdContent += '## Summary\n\n';
    mdContent += '| Spec Variant | Success Rate | Avg. Iterations (for success) | Total Runs |\n';
    mdContent += '|--------------|--------------|-------------------------------|------------|\n';
    for (const variant in report.summary) {
      const { success_rate, avg_iterations, count } = report.summary[variant];
      mdContent += `| ${variant} | ${success_rate.toFixed(2)}% | ${avg_iterations.toFixed(2)} | ${count} |\n`;
    }

    mdContent += '## Failure Analysis\n\n';
    if (report.failures.length > 0) {
      mdContent += '| Task ID | Variant | Reason | Details | Spec File | Tests |\n';
      mdContent += '|---------|---------|--------|---------|-----------|-------|\n';
      for (const failure of report.failures) {
        mdContent += `| ${failure.taskId} | ${failure.variant} | ${failure.reason} | ${failure.details} | ${failure.specFileUsed || 'N/A'} | ${failure.numberOfTestsExecuted || 0} |\n`;
      }
    } else {
      mdContent += 'No failures in this run.\n';
    }

    await fs.writeFile(reportMdPath, mdContent);
  }
}

async function getLatestRunId(repoPath) {
  const runsDir = path.join(repoPath, '.devloop', 'eval', 'runs');
  try {
    const runDirs = await fs.readdir(runsDir, { withFileTypes: true });
    const sortedRuns = runDirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort() // Sorts lexicographically, which works for ISO timestamps
      .reverse();
    return sortedRuns.length > 0 ? sortedRuns[0] : null;
  } catch (error) {
    return null;
  }
}

export async function reportHandler(runIdFromArgs, options) {
  let actualRunId = runIdFromArgs;
  const repoPath = path.resolve(options.repo);

  if (options.last || !runIdFromArgs) {
    actualRunId = await getLatestRunId(repoPath);
    if (!actualRunId) {
      console.error(chalk.red(`Error: No runs found in repository "${repoPath}".`));
      return;
    }
    console.log(chalk.gray(`Using latest run ID: ${actualRunId}`));
  }

  if (!actualRunId) {
    console.error(chalk.red('Error: A run ID must be provided or --last option used.'));
    console.log('Usage: devloop eval report <run_id> [--repo <path>]');
    console.log('Or:    devloop eval report --last [--repo <path>]');
    return;
  }
  const reporter = new Reporter(actualRunId, repoPath);
  await reporter.generateReport();
}
