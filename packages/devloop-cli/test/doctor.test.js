
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const violationFilePath = path.join(projectRoot, 'src', 'test-violation.js');

async function runTest() {
  // 1. Create a file with a hardcoded string
  const violationCode = `const apiUrl = "/api/v1/users";`;
  await fs.writeFile(violationFilePath, violationCode);
  console.log('Created test violation file.');

  // 2. Run the doctor command
  console.log('Running doctor command...');
  exec('npm run doctor', { cwd: projectRoot }, (error, stdout, stderr) => {
    // 3. Check the results
    console.log('Doctor command finished.');
    if (error) {
      console.log('Doctor command failed as expected.');
      const output = stdout + stderr;
      if (output.includes(violationFilePath) && output.includes('/api/v1')) {
        console.log('✅ Test passed: Doctor command failed and reported the violation.');
      } else {
        console.error('❌ Test failed: Doctor command failed but did not report the correct violation.');
        console.error('Output:', output);
        process.exit(1);
      }
    } else {
      console.error('❌ Test failed: Doctor command passed but was expected to fail.');
      process.exit(1);
    }

    // 4. Clean up the violation file
    fs.unlink(violationFilePath).then(() => {
      console.log('Cleaned up test violation file.');
    });
  });
}

runTest();
