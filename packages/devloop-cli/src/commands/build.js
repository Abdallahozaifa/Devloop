import { getLicenseKey, loadConfig } from '../core/config.js';
import { verifyLicense, recordRun } from '../core/license.js';
import { readCodebase, buildContext } from '../core/codebase-reader.js';
import { generatePlan, generateCode, writeFiles } from '../core/generator.js';
import { success, error, info, warn, spinner, confirm, formatPlan, printBanner } from '../utils/ui.js';

export async function buildCommand(description, options) {
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

  // Check throttle limits
  if (verification.throttle?.remaining === 0) {
    error(`Rate limit reached. Resets at ${new Date(verification.throttle.reset_at).toLocaleString()}`);
    return;
  }

  if (verification.throttle?.remaining) {
    info(`API calls remaining today: ${verification.throttle.remaining}/${verification.throttle.limit}`);
  }

  // Read codebase
  spin.start('Reading codebase...');

  let codebase;
  try {
    codebase = await readCodebase();
    spin.succeed(`Read ${codebase.totalFiles} files (${Math.round(codebase.totalSize / 1024)}KB)`);
  } catch (err) {
    spin.fail('Failed to read codebase');
    error(err.message);
    return;
  }

  // Build context
  spin.start('Building context...');
  const context = buildContext(codebase);
  spin.succeed('Context built');

  // Generate plan
  spin.start('Generating implementation plan...');

  let plan;
  try {
    plan = await generatePlan(description, context);
    spin.succeed('Plan generated');
  } catch (err) {
    spin.fail('Failed to generate plan');
    error(err.message);
    return;
  }

  // Display plan
  console.log(formatPlan(plan));

  // Record the run
  await recordRun(licenseKey);

  // Confirm with user
  if (!options.yes) {
    const proceed = await confirm('Proceed with implementation?');
    if (!proceed) {
      info('Cancelled by user');
      return;
    }
  }

  // Generate code for each file
  const generatedFiles = [];

  for (let i = 0; i < plan.files.length; i++) {
    const file = plan.files[i];
    spin.start(`Generating ${file.path}...`);

    try {
      const result = await generateCode(plan, context, i);
      generatedFiles.push(result);
      spin.succeed(`Generated ${file.path}`);
    } catch (err) {
      spin.fail(`Failed to generate ${file.path}`);
      error(err.message);
      return;
    }
  }

  // Write files
  spin.start('Writing files...');

  try {
    const written = writeFiles(generatedFiles);
    spin.succeed(`Written ${written.length} files`);

    console.log('');
    success('Build complete!');
    console.log('');
    info('Files created/modified:');
    written.forEach(f => console.log(`  → ${f}`));
    console.log('');
    info('Next steps:');
    console.log('  1. Review the generated code');
    console.log('  2. Run "devloop test" to generate and run tests');
    console.log('  3. Run "devloop deploy" when ready');
    console.log('');
  } catch (err) {
    spin.fail('Failed to write files');
    error(err.message);
  }
}
