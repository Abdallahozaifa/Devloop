import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Config Runner for DevLoop Specs
 * Runs config-type specs that check for configuration issues:
 * - URL health checks
 * - Pattern detection in code
 * - Environment variable validation
 */

export function isConfigSpec(spec) {
  return spec.type === 'config';
}

export async function runConfigSpec(spec, context) {
  const results = {
    name: spec.name,
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0
  };

  const projectDir = context.projectDir || process.cwd();

  for (const test of spec.tests || []) {
    if (test.skip) {
      results.skipped++;
      results.tests.push({ ...test, status: 'skipped', passed: false });
      continue;
    }

    const result = await runConfigTest(test, projectDir);
    results.tests.push(result);

    if (result.passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  return results;
}

async function runConfigTest(test, projectDir) {
  const result = {
    name: test.name,
    passed: false,
    errors: [],
    response: null
  };

  try {
    switch (test.check) {
      case 'url_resolves':
        await checkUrlResolves(test, result);
        break;

      case 'no_pattern':
        await checkNoPattern(test, projectDir, result);
        break;

      case 'pattern_exists':
        await checkPatternExists(test, projectDir, result);
        break;

      case 'env_exists':
        checkEnvExists(test, projectDir, result);
        break;

      case 'file_exists':
        checkFileExists(test, projectDir, result);
        break;

      case 'env_no_placeholder':
        checkEnvNoPlaceholder(test, projectDir, result);
        break;

      default:
        result.errors.push(`Unknown check type: ${test.check}`);
    }

    result.passed = result.errors.length === 0;
  } catch (e) {
    result.errors.push(e.message);
  }

  return result;
}

async function checkUrlResolves(test, result) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(test.url, {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeout);

    const expectedStatus = test.expect?.status || 200;
    const validStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

    result.response = { status: res.status };

    if (!validStatuses.includes(res.status)) {
      result.errors.push(`Expected status ${validStatuses.join('/')}, got ${res.status}`);
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      result.errors.push(`URL timeout: ${test.url}`);
    } else {
      result.errors.push(`URL unreachable: ${test.url} (${e.message})`);
    }
  }
}

async function checkNoPattern(test, projectDir, result) {
  const patterns = Array.isArray(test.in) ? test.in : [test.in];
  const regex = new RegExp(test.pattern, 'g');
  const excludePatterns = test.exclude || [];

  for (const globPattern of patterns) {
    try {
      const files = await glob(globPattern, {
        cwd: projectDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
      });

      for (const relFile of files) {
        // Skip excluded files
        if (excludePatterns.some(ex => {
          const exPattern = ex.replace(/\*/g, '.*');
          return new RegExp(exPattern).test(relFile);
        })) {
          continue;
        }

        const fullPath = path.join(projectDir, relFile);

        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const matches = content.match(regex);

        if (matches) {
          const msg = test.message || `Pattern '${test.pattern}' found in ${relFile}`;
          result.errors.push(msg);
          result.errors.push(`  Found: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
        }
      }
    } catch (e) {
      // Glob pattern might not match anything, that's ok
    }
  }
}

async function checkPatternExists(test, projectDir, result) {
  const patterns = Array.isArray(test.in) ? test.in : [test.in];
  const regex = new RegExp(test.pattern, 'g');
  const excludePatterns = test.exclude || [];
  let found = false;
  let filesSearched = 0;

  for (const globPattern of patterns) {
    try {
      const files = await glob(globPattern, {
        cwd: projectDir,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
      });

      for (const relFile of files) {
        // Skip excluded files
        if (excludePatterns.some(ex => {
          const exPattern = ex.replace(/\*/g, '.*');
          return new RegExp(exPattern).test(relFile);
        })) {
          continue;
        }

        const fullPath = path.join(projectDir, relFile);

        if (!fs.existsSync(fullPath)) continue;

        filesSearched++;
        const content = fs.readFileSync(fullPath, 'utf-8');
        const matches = content.match(regex);

        if (matches) {
          found = true;
          break;
        }
      }

      if (found) break;
    } catch (e) {
      // Glob pattern might not match anything, that's ok
    }
  }

  if (!found) {
    const msg = test.message || `Pattern '${test.pattern}' NOT found in ${patterns.join(', ')}`;
    result.errors.push(msg);
    if (filesSearched === 0) {
      result.errors.push(`  No files matched pattern: ${patterns.join(', ')}`);
    } else {
      result.errors.push(`  Searched ${filesSearched} file(s)`);
    }
  }
}

function checkEnvExists(test, projectDir, result) {
  const envPath = path.join(projectDir, test.file);

  if (!fs.existsSync(envPath)) {
    result.errors.push(`File not found: ${test.file}`);
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const varRegex = new RegExp(`^${test.var}=.+`, 'm');

  if (!varRegex.test(content)) {
    result.errors.push(`${test.var} not found or empty in ${test.file}`);
  }
}

function checkFileExists(test, projectDir, result) {
  const filePath = path.join(projectDir, test.path);

  if (!fs.existsSync(filePath)) {
    result.errors.push(`File not found: ${test.path}`);
  }
}

function checkEnvNoPlaceholder(test, projectDir, result) {
  const envPath = path.join(projectDir, test.file);

  if (!fs.existsSync(envPath)) {
    return; // File doesn't exist, skip
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const placeholders = ['your-', 'changeme', 'xxxxx', 'TODO', 'CHANGE_ME', 'placeholder'];

  for (const placeholder of placeholders) {
    if (content.toLowerCase().includes(placeholder.toLowerCase())) {
      result.errors.push(`Placeholder value found in ${test.file}: contains '${placeholder}'`);
    }
  }
}

export { runConfigTest };
