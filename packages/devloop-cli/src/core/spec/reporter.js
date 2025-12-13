import chalk from 'chalk';

/**
 * Format test results into a comprehensive, readable report
 * Shows totals, pass/fail rates, all failures with details, and action items
 */
export function formatResults(results, options = {}) {
  const { verbose = false, json = false } = options;

  // If JSON output requested, return JSON format
  if (json) {
    return formatResultsJSON(results);
  }

  const lines = [];
  const width = 70;

  // Collect all failures grouped by type
  const failures = {
    api: [],
    config: [],
    ui: []
  };

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Process all results
  for (const spec of results) {
    const specType = detectSpecType(spec);

    for (const test of spec.tests) {
      if (test.status === 'skipped') {
        totalSkipped++;
        continue;
      }

      if (test.passed) {
        totalPassed++;
      } else {
        totalFailed++;
        failures[specType].push({
          specName: spec.name,
          testName: test.name,
          errors: test.errors || [],
          response: test.response,
          expected: test.expected
        });
      }
    }
  }

  const total = totalPassed + totalFailed + totalSkipped;
  const testable = total - totalSkipped;
  const passRate = testable > 0 ? Math.round((totalPassed / testable) * 100) : 0;

  // Header
  lines.push('');
  lines.push(chalk.cyan('╔' + '═'.repeat(width - 2) + '╗'));
  lines.push(chalk.cyan('║') + centerText('DEVLOOP TEST RESULTS', width - 2, chalk.cyan.bold) + chalk.cyan('║'));
  lines.push(chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));

  // Summary stats
  const passedStr = chalk.green(`${totalPassed} passed`);
  const failedStr = totalFailed > 0 ? chalk.red(`${totalFailed} failed`) : chalk.gray(`${totalFailed} failed`);
  const skippedStr = totalSkipped > 0 ? chalk.yellow(`${totalSkipped} skipped`) : chalk.gray(`${totalSkipped} skipped`);
  const rateStr = passRate >= 100 ? chalk.green.bold(`${passRate}%`) :
                  passRate >= 80 ? chalk.yellow(`${passRate}%`) : chalk.red(`${passRate}%`);

  lines.push(chalk.cyan('║') + `  Total: ${total}  |  ${passedStr}  |  ${failedStr}  |  ${skippedStr}`.padEnd(width + 30) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + `  Pass Rate: ${rateStr}`.padEnd(width + 10) + chalk.cyan('║'));
  lines.push(chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));

  // Show all test results by spec file
  for (const spec of results) {
    const specPassed = spec.tests.filter(t => t.passed).length;
    const specFailed = spec.tests.filter(t => !t.passed && t.status !== 'skipped').length;
    const specType = detectSpecType(spec);
    const icon = specType === 'api' ? '📡' : specType === 'config' ? '📜' : '🖥️';

    lines.push(chalk.cyan('║') + chalk.white.bold(`  ${icon} ${spec.name}`) + chalk.gray(` (${specPassed}/${specPassed + specFailed} passed)`).padEnd(width - 20) + chalk.cyan('║'));

    // Show individual tests (always show for clarity)
    for (const test of spec.tests) {
      if (test.status === 'skipped') {
        lines.push(chalk.cyan('║') + chalk.yellow(`     ⏭️  ${truncate(test.name, width - 15)}`).padEnd(width + 5) + chalk.cyan('║'));
      } else if (test.passed) {
        lines.push(chalk.cyan('║') + chalk.green(`     ✅ ${truncate(test.name, width - 15)}`).padEnd(width + 5) + chalk.cyan('║'));
      } else {
        lines.push(chalk.cyan('║') + chalk.red(`     ❌ ${truncate(test.name, width - 15)}`).padEnd(width + 5) + chalk.cyan('║'));
      }
    }
    lines.push(chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
  }

  // Failures section (if any)
  if (totalFailed > 0) {
    lines.push(chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));
    lines.push(chalk.cyan('║') + centerText('FAILURES', width - 2, chalk.red.bold) + chalk.cyan('║'));
    lines.push(chalk.cyan('╠' + '─'.repeat(width - 2) + '╣'));

    // API Failures
    if (failures.api.length > 0) {
      lines.push(chalk.cyan('║') + chalk.red.bold(`  📡 API Failures (${failures.api.length})`).padEnd(width + 5) + chalk.cyan('║'));
      for (const failure of failures.api) {
        lines.push(chalk.cyan('║') + chalk.red(`     • ${truncate(failure.testName, width - 12)}`).padEnd(width + 5) + chalk.cyan('║'));
        for (const err of failure.errors) {
          lines.push(chalk.cyan('║') + chalk.gray(`       └─ ${truncate(err, width - 14)}`).padEnd(width + 5) + chalk.cyan('║'));
        }
        if (failure.response && failure.response.status) {
          lines.push(chalk.cyan('║') + chalk.gray(`       └─ Got status: ${failure.response.status}`).padEnd(width + 5) + chalk.cyan('║'));
        }
      }
      lines.push(chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    }

    // Config/Contract Failures
    if (failures.config.length > 0) {
      lines.push(chalk.cyan('║') + chalk.red.bold(`  📜 Contract Failures (${failures.config.length})`).padEnd(width + 5) + chalk.cyan('║'));
      for (const failure of failures.config) {
        lines.push(chalk.cyan('║') + chalk.red(`     • ${truncate(failure.testName, width - 12)}`).padEnd(width + 5) + chalk.cyan('║'));
        for (const err of failure.errors) {
          lines.push(chalk.cyan('║') + chalk.gray(`       └─ ${truncate(err, width - 14)}`).padEnd(width + 5) + chalk.cyan('║'));
        }
      }
      lines.push(chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    }

    // UI Failures
    if (failures.ui.length > 0) {
      lines.push(chalk.cyan('║') + chalk.red.bold(`  🖥️  UI Failures (${failures.ui.length})`).padEnd(width + 5) + chalk.cyan('║'));
      for (const failure of failures.ui) {
        lines.push(chalk.cyan('║') + chalk.red(`     • ${truncate(failure.testName, width - 12)}`).padEnd(width + 5) + chalk.cyan('║'));
        for (const err of failure.errors) {
          lines.push(chalk.cyan('║') + chalk.gray(`       └─ ${truncate(err, width - 14)}`).padEnd(width + 5) + chalk.cyan('║'));
        }
      }
      lines.push(chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
    }

    // Action Items
    lines.push(chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));
    lines.push(chalk.cyan('║') + centerText('ACTION ITEMS', width - 2, chalk.yellow.bold) + chalk.cyan('║'));
    lines.push(chalk.cyan('╠' + '─'.repeat(width - 2) + '╣'));

    if (failures.api.length > 0) {
      lines.push(chalk.cyan('║') + chalk.yellow(`  📡 Fix ${failures.api.length} API endpoint(s):`).padEnd(width + 5) + chalk.cyan('║'));
      lines.push(chalk.cyan('║') + chalk.gray(`     - Check backend routes and auth middleware`).padEnd(width + 5) + chalk.cyan('║'));
      lines.push(chalk.cyan('║') + chalk.gray(`     - Verify response status codes and body shapes`).padEnd(width + 5) + chalk.cyan('║'));
    }

    if (failures.config.length > 0) {
      lines.push(chalk.cyan('║') + chalk.yellow(`  📜 Fix ${failures.config.length} contract violation(s):`).padEnd(width + 5) + chalk.cyan('║'));
      lines.push(chalk.cyan('║') + chalk.gray(`     - Update frontend to match backend API contract`).padEnd(width + 5) + chalk.cyan('║'));
      lines.push(chalk.cyan('║') + chalk.gray(`     - Check pattern matches in source files`).padEnd(width + 5) + chalk.cyan('║'));
    }

    if (failures.ui.length > 0) {
      lines.push(chalk.cyan('║') + chalk.yellow(`  🖥️  Fix ${failures.ui.length} UI issue(s):`).padEnd(width + 5) + chalk.cyan('║'));
      lines.push(chalk.cyan('║') + chalk.gray(`     - Check component rendering and selectors`).padEnd(width + 5) + chalk.cyan('║'));
      lines.push(chalk.cyan('║') + chalk.gray(`     - Verify user flow steps complete successfully`).padEnd(width + 5) + chalk.cyan('║'));
    }
  }

  // Footer
  lines.push(chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));

  // Final status line
  lines.push('');
  if (totalFailed === 0) {
    lines.push(chalk.green.bold('  ✅ ALL TESTS PASSED'));
  } else {
    lines.push(chalk.red.bold(`  ❌ ${totalFailed} TEST(S) FAILED - See details above`));
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format results as JSON for CI/CD integration
 */
export function formatResultsJSON(results) {
  const output = {
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0
    },
    specs: [],
    failures: {
      api: [],
      config: [],
      ui: []
    },
    timestamp: new Date().toISOString()
  };

  for (const spec of results) {
    const specType = detectSpecType(spec);
    const specResult = {
      name: spec.name,
      type: specType,
      passed: spec.passed,
      failed: spec.failed,
      skipped: spec.skipped,
      tests: spec.tests.map(t => ({
        name: t.name,
        passed: t.passed,
        status: t.status,
        errors: t.errors || [],
        response: t.response ? { status: t.response.status } : null
      }))
    };
    output.specs.push(specResult);

    output.summary.passed += spec.passed;
    output.summary.failed += spec.failed;
    output.summary.skipped += spec.skipped || 0;

    // Collect failures
    for (const test of spec.tests) {
      if (!test.passed && test.status !== 'skipped') {
        output.failures[specType].push({
          specName: spec.name,
          testName: test.name,
          errors: test.errors || [],
          response: test.response ? { status: test.response.status } : null
        });
      }
    }
  }

  output.summary.total = output.summary.passed + output.summary.failed + output.summary.skipped;
  const testable = output.summary.total - output.summary.skipped;
  output.summary.passRate = testable > 0 ? Math.round((output.summary.passed / testable) * 100) : 0;

  return JSON.stringify(output, null, 2);
}

/**
 * Format a single test result
 */
export function formatTestResult(test) {
  if (test.passed) {
    return chalk.green(`✅ ${test.name}`);
  }

  let output = chalk.red(`❌ ${test.name}\n`);
  for (const error of test.errors) {
    output += chalk.red(`   └─ ${error}\n`);
  }

  return output;
}

/**
 * Calculate summary statistics from results
 */
export function formatSummary(results) {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const spec of results) {
    totalPassed += spec.passed;
    totalFailed += spec.failed;
    totalSkipped += spec.skipped || 0;
  }

  const total = totalPassed + totalFailed + totalSkipped;
  const testable = total - totalSkipped;
  const passRate = testable > 0 ? Math.round((totalPassed / testable) * 100) : 0;

  return {
    total,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    passRate
  };
}

/**
 * Detect the type of spec (api, config, or ui)
 */
function detectSpecType(spec) {
  if (spec.type === 'config') return 'config';
  if (spec.type === 'ui') return 'ui';
  if (spec.name?.toLowerCase().includes('config') || spec.name?.toLowerCase().includes('contract')) return 'config';
  if (spec.name?.toLowerCase().includes('ui') || spec.name?.toLowerCase().includes('browser')) return 'ui';
  return 'api';
}

/**
 * Center text within a given width
 */
function centerText(text, width, colorFn = (t) => t) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + colorFn(text) + ' '.repeat(width - padding - text.length);
}

/**
 * Truncate text to fit within a given width
 */
function truncate(text, maxWidth) {
  if (!text) return '';
  if (text.length <= maxWidth) return text;
  return text.substring(0, maxWidth - 3) + '...';
}
