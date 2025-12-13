import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'bin', 'devloop.js');

async function runTest() {
  let passed = 0;
  let failed = 0;

  // Test 1: --spec with missing file should exit 1 and print exact message
  console.log('Test 1: --spec with missing file...');
  const missingPath = '/tmp/nonexistent-spec-file.yaml';
  const expectedMsg = `Spec file not found: ${missingPath}`;

  await new Promise((resolve) => {
    exec(`node "${cliPath}" test --spec "${missingPath}"`, { cwd: projectRoot }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      if (error && error.code === 1 && output.includes(expectedMsg)) {
        console.log('  ✅ Test 1 passed: correct error message and exit code 1');
        passed++;
      } else {
        console.error('  ❌ Test 1 failed');
        console.error(`    Expected exit code 1, got: ${error ? error.code : 0}`);
        console.error(`    Expected message: "${expectedMsg}"`);
        console.error(`    Actual output: ${output}`);
        failed++;
      }
      resolve();
    });
  });

  // Test 2: --spec with valid file should run only that spec
  console.log('Test 2: --spec with valid file...');
  const validSpecPath = path.join(projectRoot, '.devloop', 'specs', 'api.spec.yaml');

  await new Promise((resolve) => {
    exec(`node "${cliPath}" test --spec "${validSpecPath}"`, { cwd: projectRoot }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      // Should show "Running 1 spec file(s)" indicating only the specified spec ran
      if (output.includes('Running 1 spec file(s)')) {
        console.log('  ✅ Test 2 passed: ran only the specified spec file');
        passed++;
      } else {
        console.error('  ❌ Test 2 failed: did not run only the specified spec');
        console.error(`    Output: ${output}`);
        failed++;
      }
      resolve();
    });
  });

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTest();
