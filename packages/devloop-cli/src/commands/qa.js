import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { getProjectRoot, CONFIG_DIR, loadConfig, saveConfig } from '../core/config.js';
import { success, error, info, warn, spinner, printBanner } from '../utils/ui.js';
import { resolveTestVariables, buildExecutionPlan, getTestStats } from '../core/test-generator/index.js';
import { generateFakeEntity, generateCredentials } from '../core/test-generator/data-faker.js';
import { detectHostingPlatform, probeUrlsWithPatterns, analyzeError } from '../core/pattern-matcher.js';
import chalk from 'chalk';
import crypto from 'crypto';

/**
 * AUTONOMOUS QA COMMAND
 * Zero-setup testing - automatically handles credentials, accounts, and authentication
 */
export async function qaCommand(options) {
  printBanner();

  const projectRoot = getProjectRoot();
  const configDir = path.join(projectRoot, CONFIG_DIR);
  const generatedTestsFile = path.join(configDir, 'generated-tests.json');
  const discoveryFile = path.join(configDir, 'discovery.json');
  const credentialsFile = path.join(configDir, 'qa-credentials.json');

  // Check if discovery and test generation has been run
  if (!fs.existsSync(generatedTestsFile) || !fs.existsSync(discoveryFile)) {
    warn('No generated tests found. Running audit first...');
    console.log('');

    // Import and run audit
    const { auditCommand } = await import('./audit.js');
    await auditCommand({ verbose: false });
    console.log('');
  }

  // Load generated tests and discovery
  let generatedTests, discovery;
  try {
    generatedTests = JSON.parse(fs.readFileSync(generatedTestsFile, 'utf8'));
    discovery = JSON.parse(fs.readFileSync(discoveryFile, 'utf8'));
  } catch (err) {
    error('Failed to load generated tests');
    return;
  }

  // Get test stats
  const stats = getTestStats(generatedTests);
  info(`Loaded ${stats.total} generated tests`);
  console.log(`  Auth: ${stats.byType.auth}, API: ${stats.byType.api}, UI: ${stats.byType.ui}, Flows: ${stats.byType.flows}`);
  console.log('');

  // ========================================
  // STEP 1: SMART URL DETECTION
  // ========================================
  const config = loadConfig();

  // Use smart URL resolution
  const { baseUrl, apiUrl } = await resolveUrls(projectRoot, config, options, discovery);

  if (!baseUrl && !apiUrl) {
    warn('No URLs configured. Use --url and --api-url or set in .devloop/config.json');
    info('Hint: Add to .env: VITE_API_URL=http://localhost:8000/api/v1');
    console.log('');
  }

  info(`Frontend URL: ${baseUrl || 'Not configured'}`);
  info(`API URL: ${apiUrl || 'Not configured'}`);
  console.log('');

  // ========================================
  // STEP 2: AUTO-DETECT/CREATE CREDENTIALS
  // ========================================
  let credentials = null;
  let authToken = null;

  // Skip auth handling if --no-auth flag is set (options.auth is false when --no-auth used)
  if (options.auth !== false && discovery.auth?.type && discovery.auth.type !== 'none') {
    const spin = spinner('Auto-detecting credentials...').start();

    // Try to load existing credentials
    credentials = await detectCredentials(projectRoot, configDir, discovery);

    if (credentials) {
      spin.succeed(`Found credentials: ${credentials.email}`);

      // Verify credentials work
      if (apiUrl && discovery.auth?.loginEndpoint) {
        const verifySpin = spinner('Verifying credentials...').start();
        authToken = await autoLogin(apiUrl, discovery.auth, credentials);

        if (authToken) {
          verifySpin.succeed('Credentials verified');
        } else {
          verifySpin.warn('Saved credentials invalid');
          credentials = null; // Reset to trigger prompt
        }
      }
    }

    if (!credentials) {
      spin.info('No valid credentials found');

      // Try to create test account
      if (apiUrl && discovery.auth?.registerEndpoint) {
        const testCreds = generateTestCredentials(discovery);
        const registerSpin = spinner('Creating test account...').start();
        const registered = await createTestAccount(apiUrl, discovery.auth, testCreds);

        if (registered) {
          // Verify login works
          authToken = await autoLogin(apiUrl, discovery.auth, testCreds);
          if (authToken) {
            credentials = testCreds;
            saveCredentials(credentialsFile, credentials);
            registerSpin.succeed(`Created test account: ${credentials.email}`);
          } else {
            registerSpin.warn('Account created but login failed (may need email verification)');
          }
        } else {
          registerSpin.warn('Could not create test account');
        }
      }

      // Interactive fallback - prompt user for credentials
      if (!credentials && !options.nonInteractive) {
        console.log('');
        warn('Could not auto-detect or create credentials');
        info('Please enter test account credentials:\n');

        credentials = await promptForCredentials();

        if (credentials && apiUrl && discovery.auth?.loginEndpoint) {
          const loginSpin = spinner('Verifying credentials...').start();
          authToken = await autoLogin(apiUrl, discovery.auth, credentials);

          if (authToken) {
            loginSpin.succeed('Authenticated successfully');

            // Ask to save
            const save = await promptYesNo('Save credentials for future runs?');
            if (save) {
              saveCredentials(credentialsFile, credentials);
              info('Credentials saved to .devloop/qa-credentials.json');
            }
          } else {
            loginSpin.fail('Login failed with provided credentials');
            credentials = null;
          }
        }
      }
    }

    // ========================================
    // STEP 3: AUTO-LOGIN (if not already done)
    // ========================================
    if (credentials && !authToken && apiUrl && discovery.auth?.loginEndpoint) {
      const loginSpin = spinner('Authenticating...').start();
      authToken = await autoLogin(apiUrl, discovery.auth, credentials);

      if (authToken) {
        loginSpin.succeed('Authenticated successfully');
      } else {
        loginSpin.warn('Authentication failed - protected tests may fail');
      }
    }

    console.log('');
  } else if (options.auth === false) {
    // --no-auth flag used
    info('Running in --no-auth mode: skipping authentication, only testing public endpoints');
    console.log('');
  }

  // Build execution plan
  const plan = buildExecutionPlan(generatedTests);

  // Initialize results
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl,
    apiUrl,
    framework: discovery.framework,
    credentials: credentials ? { email: credentials.email } : null,
    authenticated: !!authToken,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    phases: [],
    context: {
      auth: authToken ? { token: authToken } : null,
    },
    failures: [], // Track failures for auto-fix
  };

  // ========================================
  // STEP 4: EXECUTE TESTS
  // ========================================
  for (const phase of plan.phases) {
    console.log(chalk.bold.cyan(`\n--- ${phase.name} ---\n`));

    const phaseResult = {
      name: phase.name,
      tests: [],
      passed: 0,
      failed: 0,
    };

    // Check if we need auth but don't have it
    if (phase.requiresAuth && !results.context.auth?.token) {
      warn('Phase requires authentication but no token available');

      // Skip this phase's tests
      for (const test of phase.tests) {
        results.total++;
        results.skipped++;
        phaseResult.tests.push({ ...test, skipped: true, reason: 'No authentication token' });
      }
      results.phases.push(phaseResult);
      continue;
    }

    // Run tests
    for (const test of phase.tests) {
      results.total++;

      // Skip if URL not configured
      if ((test.type === 'api' || test.type === 'auth' || test.type === 'crud_flow') && !apiUrl) {
        results.skipped++;
        phaseResult.tests.push({ ...test, skipped: true, reason: 'No API URL' });
        continue;
      }

      if ((test.type === 'ui' || test.type === 'ui_flow' || test.type === 'ui_form' || test.type === 'ui_navigation') && !baseUrl) {
        results.skipped++;
        phaseResult.tests.push({ ...test, skipped: true, reason: 'No base URL' });
        continue;
      }

      // Filter by flow if specified
      if (options.flow && !testMatchesFlow(test, options.flow)) {
        results.skipped++;
        continue;
      }

      // Run the test
      const testResult = await runTest(test, {
        baseUrl,
        apiUrl,
        config: generatedTests.config,
        context: results.context,
        discovery,
      });

      if (testResult.passed) {
        results.passed++;
        phaseResult.passed++;
      } else {
        results.failed++;
        phaseResult.failed++;

        // Track failure for auto-fix
        results.failures.push({
          test: testResult,
          phase: phase.name,
        });
      }

      phaseResult.tests.push(testResult);

      // Store created entities in context for later tests
      if (testResult.savedData && test.saveAs) {
        results.context[test.saveAs] = testResult.savedData;
      }
    }

    results.phases.push(phaseResult);
  }

  // ========================================
  // STEP 5: GENERATE REPORT
  // ========================================
  console.log('');
  console.log(chalk.bold.white('QA Summary'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`Total:   ${results.total}`);
  console.log(`Passed:  ${chalk.green(results.passed)}`);
  console.log(`Failed:  ${chalk.red(results.failed)}`);
  console.log(`Skipped: ${chalk.gray(results.skipped)}`);

  const passRate = results.total > 0 ? Math.round((results.passed / Math.max(results.total - results.skipped, 1)) * 100) : 0;
  console.log(`Pass Rate: ${passRate >= 80 ? chalk.green(passRate + '%') : passRate >= 50 ? chalk.yellow(passRate + '%') : chalk.red(passRate + '%')}`);
  console.log('');

  // Show failures
  if (results.failures.length > 0) {
    console.log(chalk.bold.red('Failures:'));
    for (const { test, phase } of results.failures.slice(0, 10)) { // Limit to first 10
      console.log(`  ${chalk.red('✗')} ${test.name} [${phase}]`);
      if (test.error) {
        console.log(`    ${chalk.gray(formatErrorMessage(test.error, test.statusCode))}`);
      }
      if (test.statusCode) {
        console.log(`    ${chalk.gray(`Status: ${test.statusCode}`)}`);
      }
    }
    if (results.failures.length > 10) {
      console.log(chalk.gray(`  ... and ${results.failures.length - 10} more failures`));
    }
    console.log('');
  }

  // Save reports
  const reportPath = path.join(configDir, 'qa-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  const markdownReport = generateMarkdownReport(results, discovery, generatedTests);
  const markdownPath = path.join(configDir, 'qa-report.md');
  fs.writeFileSync(markdownPath, markdownReport);

  success(`Report saved to ${CONFIG_DIR}/qa-report.md`);

  // ========================================
  // STEP 6: AUTO-FIX (if requested)
  // ========================================
  if (options.fix && results.failures.length > 0) {
    console.log('');
    info('Auto-fix requested - analyzing failures...');

    const fixes = await analyzeAndFix(results.failures, discovery, projectRoot);

    if (fixes.length > 0) {
      console.log('');
      console.log(chalk.bold.yellow('Suggested Fixes:'));
      for (const fix of fixes) {
        console.log(`  ${chalk.yellow('→')} ${fix.description}`);
        if (fix.file) {
          console.log(`    ${chalk.gray(`File: ${fix.file}`)}`);
        }
        if (fix.suggestion) {
          console.log(`    ${chalk.gray(`Suggestion: ${fix.suggestion}`)}`);
        }
      }

      // Save fixes to file
      const fixesPath = path.join(configDir, 'qa-fixes.json');
      fs.writeFileSync(fixesPath, JSON.stringify(fixes, null, 2));
      info(`Fixes saved to ${CONFIG_DIR}/qa-fixes.json`);
    } else {
      info('No automatic fixes could be determined');
    }
  }

  // Return exit code
  return results.failed > 0 ? 1 : 0;
}

// ============================================================================
// SMART URL DETECTION
// ============================================================================

/**
 * Smart URL resolution with multiple strategies and SELF-HEALING
 */
async function resolveUrls(projectRoot, config, options, discovery) {
  let baseUrl = options.url || null;
  let apiUrl = options.apiUrl || null;
  let apiUrlSource = null;

  // 1. Check config.json first (highest priority after CLI options)
  if (!baseUrl && config.base_url) {
    baseUrl = config.base_url;
  }
  if (!apiUrl) {
    // Check various config keys
    apiUrl = config.api_url || config.apiUrl || config.qa?.apiUrl;
    if (apiUrl) apiUrlSource = 'config.json';
  }
  if (!baseUrl) {
    baseUrl = config.frontend_url || config.frontendUrl || config.qa?.frontendUrl;
  }

  // 2. Check .env files in multiple locations (monorepo support)
  const envPaths = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'apps/web/.env',
    'apps/frontend/.env',
    'frontend/.env',
    'web/.env',
    'client/.env',
  ];

  const apiUrlKeys = [
    'VITE_API_URL',
    'NEXT_PUBLIC_API_URL',
    'REACT_APP_API_URL',
    'API_URL',
    'API_BASE_URL',
    'BACKEND_URL',
  ];

  const baseUrlKeys = [
    'VITE_BASE_URL',
    'VITE_APP_URL',
    'NEXT_PUBLIC_BASE_URL',
    'REACT_APP_BASE_URL',
    'BASE_URL',
    'APP_URL',
    'FRONTEND_URL',
  ];

  for (const envPath of envPaths) {
    const fullPath = path.join(projectRoot, envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Look for API URL
      if (!apiUrl) {
        for (const key of apiUrlKeys) {
          const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
          if (match) {
            apiUrl = match[1].trim().replace(/["']/g, '');
            apiUrlSource = envPath;
            break;
          }
        }
      }

      // Look for Base URL
      if (!baseUrl) {
        for (const key of baseUrlKeys) {
          const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
          if (match) {
            baseUrl = match[1].trim().replace(/["']/g, '');
            break;
          }
        }
      }
    }
  }

  // 3. Check for fly.toml files (frontend and API separately)
  const flyTomlPaths = [
    { path: 'fly.toml', type: 'frontend' },
    { path: 'apps/web/fly.toml', type: 'frontend' },
    { path: 'frontend/fly.toml', type: 'frontend' },
    { path: 'api/fly.toml', type: 'api' },
    { path: 'backend/fly.toml', type: 'api' },
    { path: 'server/fly.toml', type: 'api' },
    { path: 'apps/api/fly.toml', type: 'api' },
  ];

  for (const { path: flyPath, type } of flyTomlPaths) {
    const fullPath = path.join(projectRoot, flyPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const appMatch = content.match(/^app\s*=\s*["']?([^"'\s\n]+)["']?/m);
      if (appMatch) {
        const flyUrl = `https://${appMatch[1]}.fly.dev`;
        if (type === 'api' && !apiUrl) {
          apiUrl = flyUrl;
          apiUrlSource = flyPath;
        } else if (type === 'frontend' && !baseUrl) {
          baseUrl = flyUrl;
        }
      }
    }
  }

  // ========================================
  // SELF-HEALING: Verify and probe for API URL using PATTERN DATABASE
  // ========================================

  // First, detect hosting platform from project files
  const platformInfo = detectHostingPlatform(projectRoot);
  if (platformInfo) {
    info(`Detected hosting: ${platformInfo.platformName} (app: ${platformInfo.appName})`);
  }

  // If we have an API URL, verify it's reachable
  if (apiUrl) {
    const isReachable = await verifyApiUrl(apiUrl);

    if (!isReachable) {
      warn(`Configured API URL not reachable: ${apiUrl}`);
      info(`Source: ${apiUrlSource || 'unknown'}`);
      info('Using pattern database to auto-discover working API URL...');
      console.log('');

      // Try pattern-based probing first (uses patterns.json database)
      const probeResult = await probeUrlsWithPatterns(projectRoot, baseUrl, { verbose: true });
      if (probeResult) {
        apiUrl = probeResult.url;
        success(`Found working API: ${probeResult.url} (${probeResult.pattern})`);
      } else if (baseUrl) {
        // Fall back to generic probing
        const probedUrl = await probeApiUrl(baseUrl, true);
        if (probedUrl) {
          apiUrl = probedUrl;
        }
      }
    }
  } else if (baseUrl || platformInfo) {
    // No API URL configured, try pattern-based discovery
    info('No API URL configured. Using pattern database to auto-discover...');

    const probeResult = await probeUrlsWithPatterns(projectRoot, baseUrl, { verbose: true });
    if (probeResult) {
      apiUrl = probeResult.url;
      success(`Found working API: ${probeResult.url} (${probeResult.pattern})`);
    } else if (baseUrl) {
      // Fall back to generic probing
      const probedUrl = await probeApiUrl(baseUrl, false);
      if (probedUrl) {
        apiUrl = probedUrl;
      }
    }
  }

  // 5. Detect and append API prefix if needed
  if (apiUrl) {
    apiUrl = await detectApiPrefix(apiUrl, discovery);
  }

  return { baseUrl, apiUrl };
}

/**
 * Detect and append API prefix (/api/v1, /api, etc.)
 */
async function detectApiPrefix(apiUrl, discovery) {
  // If URL already has /api, don't modify
  if (apiUrl.includes('/api')) {
    return apiUrl;
  }

  // Check discovery for basePath hint
  if (discovery.api?.basePath) {
    const basePath = discovery.api.basePath;
    if (!apiUrl.endsWith(basePath)) {
      return apiUrl + basePath;
    }
  }

  // Test common prefixes
  const prefixes = ['/api/v1', '/api', '/v1', ''];

  for (const prefix of prefixes) {
    const testUrl = apiUrl + prefix;
    // Try health endpoint or docs endpoint
    const healthWorks = await testEndpoint(testUrl + '/health', 2000);
    const docsWorks = await testEndpoint(testUrl + '/docs', 2000);

    if (healthWorks || docsWorks) {
      return testUrl;
    }
  }

  // Default: append /api/v1 as it's most common
  return apiUrl + '/api/v1';
}

/**
 * Test if an endpoint responds
 */
async function testEndpoint(url, timeout = 3000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'DevLoop-QA/1.0' },
    });

    clearTimeout(timeoutId);
    return response.status < 500;
  } catch (e) {
    return false;
  }
}

/**
 * SELF-HEALING API URL PROBING
 * Try multiple URL patterns to find a working API endpoint
 */
async function probeApiUrl(frontendUrl, verbose = true) {
  if (!frontendUrl) return null;

  // Generate candidate URLs from the frontend URL
  const candidates = generateApiCandidates(frontendUrl);

  if (verbose) {
    info(`Probing ${candidates.length} possible API URLs...`);
  }

  // Test each candidate with health/docs endpoints
  const testEndpoints = ['/health', '/docs', '/api/health', '/api/v1/health', '/openapi.json', '/'];

  for (const candidate of candidates) {
    for (const endpoint of testEndpoints) {
      const testUrl = candidate.url + endpoint;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'DevLoop-QA/1.0' },
        });

        clearTimeout(timeoutId);

        // Found a working endpoint!
        if (response.ok || response.status === 401 || response.status === 403) {
          if (verbose) {
            success(`Found working API: ${candidate.url} (${candidate.pattern})`);
          }
          return candidate.url;
        }
      } catch (e) {
        // Connection failed, try next
        continue;
      }
    }
  }

  if (verbose) {
    warn('Could not find a working API URL from probing');
  }
  return null;
}

/**
 * Generate candidate API URLs from a frontend URL
 */
function generateApiCandidates(frontendUrl) {
  const candidates = [];

  try {
    const url = new URL(frontendUrl);
    const hostname = url.hostname;
    const protocol = url.protocol;

    // Pattern 1: Same origin with /api/v1 prefix (most common for monolithic apps)
    candidates.push({
      url: `${protocol}//${hostname}/api/v1`,
      pattern: 'same-origin /api/v1',
    });

    // Pattern 2: Same origin with /api prefix
    candidates.push({
      url: `${protocol}//${hostname}/api`,
      pattern: 'same-origin /api',
    });

    // Pattern 3: api. subdomain
    if (!hostname.startsWith('api.')) {
      candidates.push({
        url: `${protocol}//api.${hostname}`,
        pattern: 'api. subdomain',
      });
      candidates.push({
        url: `${protocol}//api.${hostname}/api/v1`,
        pattern: 'api. subdomain + /api/v1',
      });
    }

    // Pattern 4: -api suffix for fly.dev apps
    if (hostname.endsWith('.fly.dev')) {
      const appName = hostname.replace('.fly.dev', '');
      // app-api.fly.dev
      candidates.push({
        url: `${protocol}//${appName}-api.fly.dev`,
        pattern: 'app-api.fly.dev',
      });
      candidates.push({
        url: `${protocol}//${appName}-api.fly.dev/api/v1`,
        pattern: 'app-api.fly.dev + /api/v1',
      });
      // appapi.fly.dev (no hyphen)
      candidates.push({
        url: `${protocol}//${appName}api.fly.dev`,
        pattern: 'appapi.fly.dev',
      });
    }

    // Pattern 5: -api suffix for vercel.app
    if (hostname.endsWith('.vercel.app')) {
      const appName = hostname.replace('.vercel.app', '');
      candidates.push({
        url: `${protocol}//${appName}-api.vercel.app`,
        pattern: 'app-api.vercel.app',
      });
    }

    // Pattern 6: -backend suffix
    if (hostname.includes('-')) {
      const baseName = hostname.split('-')[0];
      if (hostname.endsWith('.fly.dev')) {
        candidates.push({
          url: `${protocol}//${baseName}-backend.fly.dev`,
          pattern: 'app-backend.fly.dev',
        });
        candidates.push({
          url: `${protocol}//${baseName}-backend.fly.dev/api/v1`,
          pattern: 'app-backend.fly.dev + /api/v1',
        });
      }
    }

    // Pattern 7: Same origin root (API might be at root)
    candidates.push({
      url: `${protocol}//${hostname}`,
      pattern: 'same-origin root',
    });

  } catch (e) {
    // Invalid URL, return empty
  }

  return candidates;
}

/**
 * Verify an API URL is actually reachable
 */
async function verifyApiUrl(apiUrl, timeout = 5000) {
  if (!apiUrl) return false;

  const testEndpoints = ['/health', '/docs', '/', '/api/health'];

  for (const endpoint of testEndpoints) {
    const testUrl = apiUrl + endpoint;
    const works = await testEndpoint(testUrl, timeout);
    if (works) return true;
  }

  return false;
}

// ============================================================================
// CREDENTIAL DETECTION & MANAGEMENT
// ============================================================================

/**
 * Detect credentials from multiple sources
 */
async function detectCredentials(projectRoot, configDir, discovery) {
  // Priority order:
  // 1. Saved QA credentials from previous run
  // 2. .devloop/config.json
  // 3. Environment variables (QA_EMAIL, QA_PASSWORD)
  // 4. .env file (TEST_EMAIL, TEST_PASSWORD)
  // 5. Discovery hints

  // 1. Check saved credentials
  const credentialsFile = path.join(configDir, 'qa-credentials.json');
  if (fs.existsSync(credentialsFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
      if (saved.email && saved.password) {
        return saved;
      }
    } catch (e) {
      // Ignore malformed file
    }
  }

  // 2. Check config.json
  const configFile = path.join(configDir, 'config.json');
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (config.qa_email && config.qa_password) {
        return { email: config.qa_email, password: config.qa_password };
      }
      if (config.test_email && config.test_password) {
        return { email: config.test_email, password: config.test_password };
      }
      // Check nested qa object
      if (config.qa?.email && config.qa?.password) {
        return { email: config.qa.email, password: config.qa.password };
      }
    } catch (e) {
      // Ignore
    }
  }

  // 3. Check environment variables
  if (process.env.QA_EMAIL && process.env.QA_PASSWORD) {
    return { email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD };
  }
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    return { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD };
  }

  // 4. Check .env files
  const envFiles = ['.env', '.env.local', '.env.test', '.env.development'];
  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');

      const emailMatch = content.match(/^(?:QA_EMAIL|TEST_EMAIL)=(.+)$/m);
      const passwordMatch = content.match(/^(?:QA_PASSWORD|TEST_PASSWORD)=(.+)$/m);

      if (emailMatch && passwordMatch) {
        return {
          email: emailMatch[1].trim().replace(/["']/g, ''),
          password: passwordMatch[1].trim().replace(/["']/g, ''),
        };
      }
    }
  }

  // 5. Check for default/seed credentials in discovery
  if (discovery.auth?.defaultCredentials) {
    return discovery.auth.defaultCredentials;
  }

  return null;
}

/**
 * Prompt user for credentials interactively
 */
async function promptForCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('  Email: ', (email) => {
      // Hide password input (basic masking)
      process.stdout.write('  Password: ');

      let password = '';
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          stdin.setRawMode(wasRaw);
          stdin.removeListener('data', onData);
          stdin.pause();
          console.log(''); // New line after password
          rl.close();

          if (email && password) {
            resolve({ email: email.trim(), password });
          } else {
            resolve(null);
          }
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (char === '\u007F' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += char;
          process.stdout.write('*');
        }
      };

      stdin.on('data', onData);
    });
  });
}

/**
 * Prompt yes/no question
 */
async function promptYesNo(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`  ${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Generate test credentials
 */
function generateTestCredentials(discovery) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');

  return {
    email: `devloop-test-${timestamp}-${random}@test.devloop.dev`,
    password: `DevLoop_Test_${random}!`,
    name: 'DevLoop Test User',
    // Include additional fields based on discovery
    ...(discovery.auth?.credentialFields?.includes('username') ? {
      username: `devloop_test_${timestamp}`
    } : {}),
  };
}

/**
 * Save credentials for future runs
 */
function saveCredentials(credentialsFile, credentials) {
  fs.writeFileSync(credentialsFile, JSON.stringify({
    email: credentials.email,
    password: credentials.password,
    ...(credentials.username ? { username: credentials.username } : {}),
    createdAt: new Date().toISOString(),
  }, null, 2));
}

/**
 * Create a test account via register endpoint
 */
async function createTestAccount(apiUrl, authConfig, credentials) {
  try {
    const registerPath = authConfig.registerEndpoint || '/auth/register';
    const url = `${apiUrl}${registerPath}`;

    // Build registration body based on discovered credential fields
    const body = {
      email: credentials.email,
      password: credentials.password,
    };

    // Add additional fields if required
    if (authConfig.credentialFields) {
      for (const field of authConfig.credentialFields) {
        if (field === 'name' || field === 'full_name' || field === 'fullName') {
          body[field] = credentials.name || 'DevLoop Test User';
        } else if (field === 'username') {
          body[field] = credentials.username || credentials.email.split('@')[0];
        } else if (field === 'password_confirmation' || field === 'confirmPassword') {
          body[field] = credentials.password;
        }
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok || response.status === 201) {
      return true;
    }

    // Check if account already exists (common error)
    if (response.status === 400 || response.status === 409 || response.status === 422) {
      const data = await response.json().catch(() => ({}));
      const errorMsg = JSON.stringify(data).toLowerCase();
      if (errorMsg.includes('exists') || errorMsg.includes('duplicate') || errorMsg.includes('already')) {
        // Account exists, that's fine
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Auto-login and get auth token
 */
async function autoLogin(apiUrl, authConfig, credentials) {
  try {
    const loginPath = authConfig.loginEndpoint || '/auth/login';
    const url = `${apiUrl}${loginPath}`;

    // Build login body
    const body = {};

    // Detect email/username field name
    const emailField = authConfig.emailField || 'email';
    const passwordField = authConfig.passwordField || 'password';

    body[emailField] = credentials.email;
    body[passwordField] = credentials.password;

    // Add username if required
    if (authConfig.credentialFields?.includes('username') && credentials.username) {
      body.username = credentials.username;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();

      // Extract token from various possible locations
      const token =
        data.access_token ||
        data.accessToken ||
        data.token ||
        data.jwt ||
        data.data?.access_token ||
        data.data?.token ||
        data.auth?.token;

      return token || null;
    }

    return null;
  } catch (err) {
    return null;
  }
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

/**
 * Run a single test
 */
async function runTest(test, { baseUrl, apiUrl, config, context, discovery }) {
  const spin = spinner(`Testing ${test.name}...`).start();

  const result = {
    ...test,
    passed: false,
    error: null,
    statusCode: null,
    responseTime: null,
    savedData: null,
    failedSteps: [],
  };

  try {
    // Resolve variables in test
    const resolved = resolveTestVariables(test, context);

    if (test.type === 'crud_flow') {
      // Run CRUD flow (multi-step test)
      result.steps = [];
      let flowPassed = true;

      for (const step of test.steps) {
        const stepResult = await runApiStep(step, { apiUrl, config, context });
        result.steps.push(stepResult);

        if (!stepResult.passed) {
          flowPassed = false;
          result.failedSteps.push({ name: step.name, error: stepResult.error });
        }

        // Save created entity
        if (stepResult.passed && step.saveAs && stepResult.data) {
          context[step.saveAs] = stepResult.data;
          result.savedData = stepResult.data;
        }
      }

      result.passed = flowPassed;
    } else if (test.type === 'api' || test.type === 'auth') {
      // Single API test
      const apiResult = await runApiTest(resolved, { apiUrl, config, context });
      Object.assign(result, apiResult);

      if (test.saveAs && result.data) {
        result.savedData = result.data;
      }
    } else if (test.type === 'ui' || test.type === 'ui_flow' || test.type === 'ui_form' || test.type === 'ui_navigation') {
      // UI test
      const uiResult = await runUiTest(resolved, { baseUrl, context });
      Object.assign(result, uiResult);
    }

    if (result.passed) {
      spin.succeed(`${test.name}: ${chalk.green('PASSED')}${result.responseTime ? chalk.gray(` (${result.responseTime}ms)`) : ''}`);
    } else {
      spin.fail(`${test.name}: ${chalk.red('FAILED')}${result.error ? chalk.gray(` - ${formatErrorMessage(result.error, result.statusCode)}`) : ''}`);
    }
  } catch (err) {
    result.error = err.message;
    spin.fail(`${test.name}: ${chalk.red('ERROR')} - ${err.message}`);
  }

  return result;
}

/**
 * Format error message for better readability
 */
function formatErrorMessage(error, statusCode) {
  if (statusCode === 405) {
    return 'Method not allowed - check API base path';
  }
  if (statusCode === 404) {
    return 'Endpoint not found - check URL';
  }
  if (statusCode === 401) {
    return 'Authentication required';
  }
  if (statusCode === 403) {
    return 'Access forbidden';
  }
  if (statusCode === 500) {
    return 'Server error - check backend logs';
  }
  if (error?.includes('fetch failed') || error?.includes('ECONNREFUSED')) {
    return 'Server not reachable';
  }
  return error;
}

/**
 * Run a single API step in a CRUD flow
 */
async function runApiStep(step, { apiUrl, config, context }) {
  const result = {
    name: step.name,
    method: step.method,
    path: step.path,
    passed: false,
    statusCode: null,
    responseTime: null,
    error: null,
    data: null,
  };

  try {
    // Resolve path parameters
    let resolvedPath = step.path;
    if (step.pathParams) {
      for (const [key, value] of Object.entries(step.pathParams)) {
        let resolvedValue = value;

        // Resolve variable references like {{entity.id}}
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const varPath = value.slice(2, -2).split('.');
          resolvedValue = varPath.reduce((obj, key) => obj?.[key], context);
        }

        if (resolvedValue) {
          resolvedPath = resolvedPath
            .replace(`{${key}}`, resolvedValue)
            .replace(`:${key}`, resolvedValue)
            .replace(`{id}`, resolvedValue)
            .replace(`:id`, resolvedValue);
        }
      }
    }

    // Replace any remaining path parameters with test values
    resolvedPath = resolvedPath
      .replace(/\{[^}]+\}/g, 'test-id')
      .replace(/:[a-zA-Z_]+/g, 'test-id');

    const url = `${apiUrl}${resolvedPath}`;

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add auth header if required
    if (step.auth && context.auth?.token) {
      headers['Authorization'] = `Bearer ${context.auth.token}`;
    }

    const fetchOptions = {
      method: step.method,
      headers,
    };

    if (step.body && ['POST', 'PUT', 'PATCH'].includes(step.method)) {
      fetchOptions.body = JSON.stringify(step.body);
    }

    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;

    // Parse response
    try {
      result.data = await response.json();
    } catch {
      result.data = null;
    }

    // Check expected status
    const expectedStatus = step.expect?.status;
    if (expectedStatus) {
      const validStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
      if (validStatuses.includes(response.status)) {
        result.passed = true;
      } else {
        result.error = `Expected ${validStatuses.join(' or ')}, got ${response.status}`;
      }
    } else {
      // Default: 2xx is success
      result.passed = response.status >= 200 && response.status < 300;
      if (!result.passed) {
        result.error = `HTTP ${response.status}`;
      }
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Run a single API test
 */
async function runApiTest(test, { apiUrl, config, context }) {
  const result = {
    passed: false,
    statusCode: null,
    responseTime: null,
    error: null,
    data: null,
  };

  try {
    // Resolve path
    let testPath = test.resolvedPath || test.path;

    // Replace any unresolved path parameters with test values
    testPath = testPath
      .replace(/\{[^}]+\}/g, 'test-id')
      .replace(/:[a-zA-Z_]+/g, 'test-id');

    const url = `${apiUrl}${testPath}`;

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add auth header if required
    if (test.auth && context.auth?.token) {
      headers['Authorization'] = `Bearer ${context.auth.token}`;
    }

    const fetchOptions = {
      method: test.method || 'GET',
      headers,
    };

    if (test.body && ['POST', 'PUT', 'PATCH'].includes(test.method)) {
      fetchOptions.body = JSON.stringify(test.body);
    }

    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;

    // Parse response
    try {
      result.data = await response.json();
    } catch {
      result.data = null;
    }

    // Check expected status
    const expectedStatus = test.expect?.status;
    if (expectedStatus) {
      const validStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
      if (validStatuses.includes(response.status)) {
        result.passed = true;
      } else {
        result.error = `Expected ${validStatuses.join(' or ')}, got ${response.status}`;
      }
    } else {
      // Default: consider 2xx, 3xx, and 401/403 as acceptable (auth required is expected)
      if (response.status < 500 && response.status !== 404 && response.status !== 405) {
        result.passed = true;
      } else {
        result.error = `HTTP ${response.status}`;
      }
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Run a UI test (HTTP check - Playwright integration can be added)
 */
async function runUiTest(test, { baseUrl, context }) {
  const result = {
    passed: false,
    statusCode: null,
    responseTime: null,
    error: null,
  };

  try {
    const routePath = test.route || test.steps?.[0]?.url || '/';
    const url = `${baseUrl}${routePath}`;

    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevLoop-QA/1.0',
      },
    });

    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;

    // UI pages: 200, 304, 401, 403 are all acceptable
    if (response.status === 200 || response.status === 304 || response.status === 401 || response.status === 403) {
      result.passed = true;
    } else {
      result.error = `HTTP ${response.status}`;
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

// ============================================================================
// AUTO-FIX ANALYSIS
// ============================================================================

/**
 * Analyze failures and suggest fixes
 */
async function analyzeAndFix(failures, discovery, projectRoot) {
  const fixes = [];

  for (const { test, phase } of failures) {
    const fix = analyzeFailure(test, phase, discovery, projectRoot);
    if (fix) {
      fixes.push(fix);
    }
  }

  return fixes;
}

/**
 * Analyze a single failure and suggest fix
 */
function analyzeFailure(test, phase, discovery, projectRoot) {
  const fix = {
    test: test.name,
    phase,
    type: null,
    description: null,
    file: null,
    suggestion: null,
  };

  // 405 - Method not allowed (likely wrong API base path)
  if (test.statusCode === 405) {
    fix.type = 'wrong_api_path';
    fix.description = `Method not allowed for ${test.method || 'GET'} ${test.path || test.route}`;
    fix.suggestion = 'Check API base path. May need /api/v1 prefix. Set api_url in .devloop/config.json';
    return fix;
  }

  // 404 - Route not found
  if (test.statusCode === 404) {
    fix.type = 'missing_route';
    fix.description = `Route ${test.path || test.route} not found`;

    // Try to find the relevant file
    if (test.path && discovery.framework?.backend === 'fastapi') {
      fix.suggestion = `Add route handler for ${test.method || 'GET'} ${test.path}`;
      fix.file = 'Check routes in app/api/ or app/routers/';
    } else if (test.route && discovery.framework?.frontend) {
      fix.suggestion = `Add page/route for ${test.route}`;
      fix.file = discovery.framework.frontend.includes('next')
        ? `pages${test.route}.tsx or app${test.route}/page.tsx`
        : `src/routes${test.route} or router config`;
    }
    return fix;
  }

  // 500 - Server error
  if (test.statusCode === 500) {
    fix.type = 'server_error';
    fix.description = `Server error on ${test.path || test.route}`;
    fix.suggestion = 'Check backend logs for stack trace. Common causes: missing dependency, database error, null reference';
    return fix;
  }

  // 401/403 without auth token
  if ((test.statusCode === 401 || test.statusCode === 403) && test.auth) {
    fix.type = 'auth_required';
    fix.description = `Authentication failed for ${test.name}`;
    fix.suggestion = 'Ensure test credentials are valid and authentication is working';
    return fix;
  }

  // Connection error
  if (test.error?.includes('fetch failed') || test.error?.includes('ECONNREFUSED') || test.error?.includes('ETIMEDOUT')) {
    fix.type = 'connection_error';
    fix.description = `Cannot connect to server for ${test.name}`;
    fix.suggestion = 'Ensure the server is running and the URL is correct';
    return fix;
  }

  // Generic error
  if (test.error) {
    fix.type = 'unknown';
    fix.description = `Error in ${test.name}: ${test.error}`;
    fix.suggestion = 'Review the test and endpoint implementation';
    return fix;
  }

  return null;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if test matches flow filter
 */
function testMatchesFlow(test, flow) {
  const flowLower = flow.toLowerCase();
  return (
    test.name?.toLowerCase().includes(flowLower) ||
    test.entity?.toLowerCase().includes(flowLower) ||
    test.path?.toLowerCase().includes(flowLower) ||
    test.route?.toLowerCase().includes(flowLower)
  );
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, discovery, generatedTests) {
  const passRate = results.total > 0 ? Math.round((results.passed / Math.max(results.total - results.skipped, 1)) * 100) : 0;

  let report = `# QA Test Report

**Generated:** ${results.timestamp}
**Framework:** ${discovery.framework?.frontend || 'unknown'} + ${discovery.framework?.backend || 'unknown'}
**Frontend URL:** ${results.baseUrl || 'Not configured'}
**API URL:** ${results.apiUrl || 'Not configured'}
**Authentication:** ${results.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}
${results.credentials ? `**Test User:** ${results.credentials.email}` : ''}

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${results.total} |
| Passed | ${results.passed} |
| Failed | ${results.failed} |
| Skipped | ${results.skipped} |
| **Pass Rate** | ${passRate}% |

---

## Discovery Summary

| Category | Count |
|----------|-------|
| API Endpoints | ${discovery.summary?.api?.endpoints || 0} |
| Data Models | ${discovery.summary?.models?.entities || 0} |
| UI Routes | ${discovery.summary?.ui?.routes || 0} |
| Protected Routes | ${discovery.summary?.ui?.protectedRoutes || 0} |

---

## Test Results by Phase

`;

  for (const phase of results.phases) {
    report += `### ${phase.name}\n\n`;
    report += `Passed: ${phase.passed} | Failed: ${phase.failed}\n\n`;

    const failedTests = phase.tests.filter(t => !t.passed && !t.skipped);
    const passedTests = phase.tests.filter(t => t.passed);
    const skippedTests = phase.tests.filter(t => t.skipped);

    if (failedTests.length > 0) {
      report += `**Failed:**\n`;
      for (const test of failedTests) {
        report += `- ❌ ${test.name}`;
        if (test.error) report += ` - ${formatErrorMessage(test.error, test.statusCode)}`;
        if (test.statusCode) report += ` (${test.statusCode})`;
        report += '\n';

        if (test.failedSteps?.length > 0) {
          for (const step of test.failedSteps) {
            report += `  - Step: ${step.name} - ${step.error}\n`;
          }
        }
      }
      report += '\n';
    }

    if (passedTests.length > 0) {
      report += `**Passed:**\n`;
      for (const test of passedTests) {
        report += `- ✅ ${test.name}`;
        if (test.responseTime) report += ` (${test.responseTime}ms)`;
        report += '\n';
      }
      report += '\n';
    }

    if (skippedTests.length > 0) {
      report += `**Skipped:** ${skippedTests.length} tests (${skippedTests[0]?.reason || 'no URL'})\n\n`;
    }
  }

  report += `---

## Recommendations

`;

  if (results.failures.length > 0) {
    report += `### Fixes Needed\n\n`;
    for (const { test, phase } of results.failures.slice(0, 15)) {
      report += `1. **${test.name}** [${phase}]\n`;
      if (test.statusCode === 405) {
        report += `   - Method not allowed. Check API base path (may need /api/v1 prefix).\n`;
      } else if (test.statusCode === 404) {
        report += `   - Route not found. Check that the endpoint exists.\n`;
      } else if (test.statusCode === 500) {
        report += `   - Server error. Check backend logs.\n`;
      } else if (test.statusCode === 401 || test.statusCode === 403) {
        report += `   - Authentication required. Ensure credentials are configured.\n`;
      } else if (test.error?.includes('fetch failed') || test.error?.includes('ECONNREFUSED')) {
        report += `   - Server not reachable. Ensure the server is running.\n`;
      } else {
        report += `   - ${test.error || 'Unknown error'}\n`;
      }
    }
    report += '\n';
  } else {
    report += `All tests passed! Consider:\n\n`;
    report += `- Adding more specific test assertions\n`;
    report += `- Testing edge cases and error scenarios\n`;
    report += `- Adding visual regression tests with Playwright\n`;
  }

  report += `
---

## Test Configuration

\`\`\`json
${JSON.stringify(generatedTests.config, null, 2)}
\`\`\`

---

*Generated by DevLoop QA - Autonomous Test Runner*
`;

  return report;
}
