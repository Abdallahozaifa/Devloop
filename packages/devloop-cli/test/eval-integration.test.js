
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import util from 'util';
import assert from 'assert';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const CLI_PATH = path.join(ROOT_DIR, 'bin', 'devloop.js');
const FIXTURE_REPO_PATH = path.join(ROOT_DIR, 'fixtures', 'eval-project');

describe('DevLoop Eval Harness Integration Test', function() {
  this.timeout(120000); // Set timeout to 2 minutes
  let testDir;

  before(async () => {
    // Create a temporary directory for the evaluation run
    testDir = await fs.mkdtemp(path.join(ROOT_DIR, 'test-eval-run-'));
    console.log(`Created temporary directory for eval test: ${testDir}`);
  });

  after(async () => {
    // Clean up the temporary directory
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log(`Cleaned up temporary directory: ${testDir}`);
    }
  });

  it('should run the full eval process (init, run, report) successfully', async () => {
    // 1. Run `devloop eval init`
    const initCmd = `node ${CLI_PATH} eval init`;
    await execPromise(initCmd, { cwd: testDir });

    // Verify directory structure
    await fs.access(path.join(testDir, '.devloop', 'eval', 'tasks'));
    await fs.access(path.join(testDir, '.devloop', 'eval', 'suites'));

    // 2. Run `devloop eval run`
    const runCmd = `node ${CLI_PATH} eval run --repo ${FIXTURE_REPO_PATH} --suite example-suite --max-iterations 1`;
    const { stdout: runStdout } = await execPromise(runCmd, { cwd: testDir });
    console.log(runStdout);

    // Extract the run ID from the output
    const runIdMatch = runStdout.match(/Starting evaluation run (\S+)/);
    assert(runIdMatch && runIdMatch[1], 'Could not find run ID in the output');
    const runId = runIdMatch[1];
    console.log(`Found run ID: ${runId}`);

    // 3. Verify that the run results were created
    const resultsPath = path.join(testDir, '.devloop', 'eval', 'runs', runId, 'run-results.json');
    await fs.access(resultsPath);

    // 4. Run `devloop eval report`
    const reportCmd = `node ${CLI_PATH} eval report ${runId}`;
    await execPromise(reportCmd, { cwd: testDir });

    // 5. Verify that the report files were created
    const reportMdPath = path.join(testDir, '.devloop', 'eval', 'report', `${runId}-report.md`);
    const reportJsonPath = path.join(testDir, '.devloop', 'eval', 'report', `${runId}-report.json`);
    await fs.access(reportMdPath);
    await fs.access(reportJsonPath);

    // 6. Check the content of the markdown report
    const mdContent = await fs.readFile(reportMdPath, 'utf8');
    assert(mdContent.includes('# Evaluation Report'), 'Report title is missing');
    assert(mdContent.includes('## Summary'), 'Summary section is missing');
    assert(mdContent.includes('## Failure Analysis'), 'Failure Analysis section is missing');
  });
});
