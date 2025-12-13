
/**
 * @fileoverview Data structures for the DevLoop evaluation harness.
 */

/**
 * Represents a single evaluation task.
 */
export class Task {
  constructor(id, description, repo_context, gates, variables) {
    this.id = id;
    this.description = description;
    this.repo_context = repo_context;
    this.gates = gates;
    this.variables = variables;
  }

  static fromYAML(data) {
    return new Task(data.id, data.description, data.repo_context, data.gates, data.variables);
  }
}

/**
 * Represents the result of a single evaluation run (for one task and one variant).
 */
export class RunResult {
  constructor(runId, taskId, variant) {
    this.runId = runId;
    this.taskId = taskId;
    this.variant = variant; // 'vague', 'basic', 'comprehensive'
    this.status = 'RED'; // 'GREEN' or 'RED'
    this.iterations = 0;
    this.specFileUsed = null;
    this.numberOfTestsExecuted = 0;
    this.failureReason = null; // e.g., 'compilation', 'test_failure'
    this.failureDetails = null; // E.g., compiler output or test failure snippet
  }
}

/**
 * Represents the final aggregated report.
 */
export class Report {
  constructor(runId) {
    this.runId = runId;
    this.summary = {
      vague: { success_rate: 0, avg_iterations: 0, count: 0 },
      basic: { success_rate: 0, avg_iterations: 0, count: 0 },
      comprehensive: { success_rate: 0, avg_iterations: 0, count: 0 },
    };
    this.results = []; // Array of RunResult objects
    this.failures = []; // Detailed failure analysis
  }

  addResult(result) {
    this.results.push(result);
  }

  generate() {
    // Logic to calculate summary statistics and failure breakdowns
    const totals = { vague: { green: 0, total_iterations: 0 }, basic: { green: 0, total_iterations: 0 }, comprehensive: { green: 0, total_iterations: 0 } };

    for (const result of this.results) {
      this.summary[result.variant].count++;
      if (result.status === 'GREEN') {
        totals[result.variant].green++;
        totals[result.variant].total_iterations += result.iterations;
      } else {
        this.failures.push({
          taskId: result.taskId,
          variant: result.variant,
          reason: result.failureReason,
          details: result.failureDetails,
        });
      }
    }

    for (const variant in this.summary) {
      if (this.summary[variant].count > 0) {
        this.summary[variant].success_rate = (totals[variant].green / this.summary[variant].count) * 100;
        if (totals[variant].green > 0) {
          this.summary[variant].avg_iterations = totals[variant].total_iterations / totals[variant].green;
        }
      }
    }
  }
}
