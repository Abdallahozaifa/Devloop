import fs from 'fs';
import path from 'path';
import { getLicenseKey, getProjectRoot, loadConfig } from '../core/config.js';
import { verifyLicense, recordRun } from '../core/license.js';
import { readCodebase, buildContext } from '../core/codebase-reader.js';
import { generateFix, writeFiles } from '../core/generator.js';
import { success, error, info, warn, spinner, confirm, prompt, printBanner } from '../utils/ui.js';

export async function fixCommand(options) {
  printBanner();

  // Check license
  const licenseKey = getLicenseKey();
  if (!licenseKey) {
    error('No license key found. Run "devloop init" first.');
    return;
  }

  const spin = spinner('Verifying license...').start();
  const verification = await verifyLicense(licenseKey);

  if (!verification.valid) {
    spin.fail('License verification failed');
    error(verification.message);
    return;
  }

  spin.succeed('License verified');

  // Get error input
  let errorContent = '';

  if (options.file) {
    // Read error from file
    const errorPath = path.resolve(options.file);
    if (!fs.existsSync(errorPath)) {
      error(`Error file not found: ${errorPath}`);
      return;
    }
    errorContent = fs.readFileSync(errorPath, 'utf8');
    info(`Reading error from: ${options.file}`);
  } else if (options.log) {
    // Read from log file (common patterns)
    const projectRoot = getProjectRoot();
    const logPatterns = [
      'npm-debug.log',
      'yarn-error.log',
      '.npm/_logs/*.log',
      'logs/*.log',
    ];

    for (const pattern of logPatterns) {
      const logPath = path.join(projectRoot, pattern.replace('*', ''));
      if (fs.existsSync(logPath)) {
        errorContent = fs.readFileSync(logPath, 'utf8');
        info(`Found log file: ${pattern}`);
        break;
      }
    }

    if (!errorContent) {
      error('No log files found');
      info('Use --file <path> to specify a log file');
      return;
    }
  } else {
    // Prompt for error
    console.log('');
    info('Paste the error message (press Enter twice to submit):');
    console.log('');

    errorContent = await getMultilineInput();

    if (!errorContent.trim()) {
      error('No error provided');
      return;
    }
  }

  // Read codebase for context
  spin.start('Reading codebase...');

  let codebase;
  try {
    codebase = await readCodebase();
    spin.succeed(`Read ${codebase.totalFiles} files`);
  } catch (err) {
    spin.fail('Failed to read codebase');
    error(err.message);
    return;
  }

  // Build context
  const context = buildContext(codebase);

  // Generate fix
  spin.start('Analyzing error and generating fix...');

  let fix;
  try {
    fix = await generateFix(errorContent, context);
    spin.succeed('Fix generated');
  } catch (err) {
    spin.fail('Failed to generate fix');
    error(err.message);
    return;
  }

  // Record the run
  await recordRun(licenseKey);

  // Display analysis
  console.log('');
  console.log('─'.repeat(50));
  console.log('');
  info('Analysis:');
  console.log(fix.analysis);
  console.log('');

  if (fix.files && fix.files.length > 0) {
    info('Proposed changes:');
    fix.files.forEach(f => {
      console.log(`  → ${f.path} (${f.action})`);
      console.log(`    ${f.changes}`);
    });
    console.log('');

    // Confirm changes
    if (!options.yes) {
      const proceed = await confirm('Apply these fixes?');
      if (!proceed) {
        info('Cancelled by user');
        return;
      }
    }

    // Apply fixes
    spin.start('Applying fixes...');

    try {
      const filesToWrite = fix.files.map(f => ({
        path: f.path,
        content: f.content,
        action: f.action,
      }));

      const written = writeFiles(filesToWrite);
      spin.succeed(`Applied ${written.length} fixes`);

      console.log('');
      success('Fixes applied!');
      info('Files modified:');
      written.forEach(f => console.log(`  → ${f}`));
      console.log('');
      info('Run "devloop test" to verify the fix');
    } catch (err) {
      spin.fail('Failed to apply fixes');
      error(err.message);
    }
  } else {
    warn('No code changes needed');
    info('The error might be environmental or require manual intervention');
  }
}

async function getMultilineInput() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const lines = [];
    let emptyLineCount = 0;

    rl.on('line', (line) => {
      if (line === '') {
        emptyLineCount++;
        if (emptyLineCount >= 2) {
          rl.close();
          resolve(lines.join('\n'));
          return;
        }
      } else {
        emptyLineCount = 0;
      }
      lines.push(line);
    });

    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}
