import { getProjectRoot } from '../core/config.js';
import { validateConfig, formatIssues, quickScan } from '../core/config-validator.js';
import { success, error, info, warn, printBanner } from '../utils/ui.js';
import chalk from 'chalk';

/**
 * DevLoop validate command
 * DEPRECATED: Use config specs with `devloop test` instead
 * Scans codebase for common configuration issues
 */
export async function validateCommand(options = {}) {
  printBanner();

  const projectRoot = getProjectRoot();
  const { verbose = false, quick = false, fix = false } = options;

  console.log('');
  console.log(chalk.yellow.bold('NOTICE: devloop validate is deprecated'));
  console.log(chalk.yellow('Use config specs instead: create .devloop/specs/config.spec.yaml'));
  console.log(chalk.yellow('Then run: devloop test'));
  console.log('');
  console.log(chalk.bold.white('Configuration Validator (Legacy)'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  info(`Scanning project: ${projectRoot}`);
  console.log('');

  if (quick) {
    // Quick scan - just report summary
    const result = await quickScan(projectRoot);
    if (result.hasIssues) {
      if (result.hasCritical) {
        error(`Found ${result.criticalCount} critical issues and ${result.count - result.criticalCount} warnings`);
      } else {
        warn(`Found ${result.count} potential configuration issues`);
      }
      info('Run "devloop validate" (without --quick) for details');
      return 1;
    } else {
      success('No configuration issues detected');
      return 0;
    }
  }

  // Full scan
  const issues = await validateConfig(projectRoot, { verbose });

  if (issues.length === 0) {
    success('No configuration issues found!');
    console.log('');
    info('Your codebase looks good. No hardcoded URLs or misconfigurations detected.');
    return 0;
  }

  // Display issues
  console.log(formatIssues(issues));

  // Summary
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  if (errors.length > 0) {
    error(`${errors.length} error(s) found - these should be fixed before deployment`);
  }

  if (warnings.length > 0) {
    warn(`${warnings.length} warning(s) - review these to ensure they're intentional`);
  }

  console.log('');
  info('Common fixes:');
  console.log(chalk.gray('  - Use environment variables instead of hardcoded URLs'));
  console.log(chalk.gray('  - For same-origin APIs, use relative URLs (empty string or /api/v1)'));
  console.log(chalk.gray('  - Ensure .env.production has correct production values'));
  console.log('');

  return errors.length > 0 ? 1 : 0;
}

export default validateCommand;
