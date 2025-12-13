
import { Task } from '../src/core/eval/structures.js';
import yaml from 'js-yaml';
import assert from 'assert';

const sampleTaskYAML = `
id: sample-task
description: "A sample task."
repo_context:
  include: ["src/**/*.js"]
gates:
  - command: "lint"
  - command: "test"
variables:
  - name: "API_KEY"
`;

describe('DevLoop Eval Harness', () => {
  it('should parse a task from YAML correctly', () => {
    const taskData = yaml.load(sampleTaskYAML);
    const task = Task.fromYAML(taskData);

    assert.strictEqual(task.id, 'sample-task');
    assert.strictEqual(task.description, 'A sample task.');
    assert.deepStrictEqual(task.repo_context.include, ['src/**/*.js']);
    assert.strictEqual(task.gates.length, 2);
    assert.strictEqual(task.gates[0].command, 'lint');
    assert.strictEqual(task.variables[0].name, 'API_KEY');
  });

  it('should aggregate report results correctly', () => {
    const report = new Report('test-run');
    report.addResult({ taskId: 't1', variant: 'vague', status: 'RED', iterations: 10, failureReason: 'test_failure' });
    report.addResult({ taskId: 't1', variant: 'basic', status: 'GREEN', iterations: 5 });
    report.addResult({ taskId: 't1', variant: 'comprehensive', status: 'GREEN', iterations: 2 });
    report.addResult({ taskId: 't2', variant: 'vague', status: 'RED', failureReason: 'compilation' });
    report.addResult({ taskId: 't2', variant: 'basic', status: 'RED', failureReason: 'test_failure' });
    report.addResult({ taskId: 't2', variant: 'comprehensive', status: 'GREEN', iterations: 3 });

    report.generate();

    assert.strictEqual(report.summary.vague.success_rate, 0);
    assert.strictEqual(report.summary.basic.success_rate, 50);
    assert.strictEqual(report.summary.comprehensive.success_rate, 100);
    
    assert.strictEqual(report.summary.basic.avg_iterations, 5);
    assert.strictEqual(report.summary.comprehensive.avg_iterations, 2.5);
  });

  it('should categorize failures correctly', () => {
    const report = new Report('test-run-failures');
    report.addResult({ taskId: 't1', variant: 'vague', status: 'RED', failureReason: 'test_failure', failureDetails: 'expected 200 but got 500' });
    report.addResult({ taskId: 't2', variant: 'basic', status: 'RED', failureReason: 'compilation', failureDetails: 'SyntaxError: Unexpected token' });

    report.generate();

    assert.strictEqual(report.failures.length, 2);
    assert.strictEqual(report.failures[0].reason, 'test_failure');
    assert.strictEqual(report.failures[1].reason, 'compilation');
  });
});
