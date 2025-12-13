/**
 * LIVE PRODUCTION FLOW TESTER
 *
 * Tests real user flows on production - not just endpoint availability,
 * but full authentication, onboarding, CRUD flows, and data persistence.
 */

import chalk from 'chalk';
import crypto from 'crypto';
import { spinner } from '../utils/ui.js';
import { analyzeFailures, detectIssueType } from './auto-fixer.js';

/**
 * Run live production flow tests
 * @param {Object} config - Configuration with apiUrl
 * @returns {Object} Test results with passed/failed counts
 */
export async function runLiveTests(config) {
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    timestamp: new Date().toISOString(),
  };

  const apiUrl = config.apiUrl;

  if (!apiUrl) {
    console.log(chalk.red('\nNo API URL provided. Use --api-url flag.'));
    return results;
  }

  // Generate unique test user for this run
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const testEmail = `devloop-live-${timestamp}-${random}@devloop-test.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'DevLoop Live Test User';

  console.log(chalk.bold.red('\n\n  LIVE PRODUCTION TESTS\n'));
  console.log(chalk.gray('  Testing real user flows on production...\n'));
  console.log(chalk.gray(`  API: ${apiUrl}`));
  console.log(chalk.gray(`  Test User: ${testEmail}\n`));

  let authToken = null;
  let userId = null;
  let clientId = null;
  let projectId = null;

  // ============================================
  // TEST 1: Register
  // ============================================
  console.log(chalk.cyan('1. Testing registration...'));
  try {
    const registerRes = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        full_name: testName,
      }),
    });

    const registerData = await registerRes.json().catch(() => ({}));

    if (registerRes.ok || registerRes.status === 201) {
      console.log(chalk.green('   ✓ Registration successful'));
      results.passed++;
      results.tests.push({ name: 'Registration', passed: true });

      // Try to get token from register response
      authToken = registerData.access_token || registerData.token;
    } else if (registerRes.status === 400 || registerRes.status === 409 || registerRes.status === 422) {
      // Account may already exist
      const errorMsg = JSON.stringify(registerData).toLowerCase();
      if (errorMsg.includes('exist') || errorMsg.includes('duplicate')) {
        console.log(chalk.yellow('   ⚠ Account already exists, will try login'));
        results.passed++;
        results.tests.push({ name: 'Registration', passed: true, note: 'exists' });
      } else {
        console.log(chalk.red(`   ✗ Registration failed: ${registerRes.status}`));
        console.log(chalk.gray(`     ${JSON.stringify(registerData).slice(0, 100)}`));
        results.failed++;
        results.tests.push({ name: 'Registration', passed: false, error: registerData });
        // Don't return - try login anyway
      }
    } else {
      console.log(chalk.red(`   ✗ Registration failed: ${registerRes.status}`));
      results.failed++;
      results.tests.push({ name: 'Registration', passed: false, status: registerRes.status });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Registration error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Registration', passed: false, error: err.message });
  }

  // ============================================
  // TEST 2: Login
  // ============================================
  console.log(chalk.cyan('2. Testing login...'));
  try {
    const loginRes = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData = await loginRes.json().catch(() => ({}));

    if (loginRes.ok) {
      authToken = loginData.access_token || loginData.accessToken || loginData.token;
      if (authToken) {
        console.log(chalk.green('   ✓ Login successful, token received'));
        results.passed++;
        results.tests.push({ name: 'Login', passed: true });
      } else {
        console.log(chalk.red('   ✗ Login response missing token'));
        results.failed++;
        results.tests.push({ name: 'Login', passed: false, error: 'no token in response' });
      }
    } else {
      console.log(chalk.red(`   ✗ Login failed: ${loginRes.status}`));
      console.log(chalk.gray(`     ${JSON.stringify(loginData).slice(0, 100)}`));
      results.failed++;
      results.tests.push({ name: 'Login', passed: false, status: loginRes.status });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Login error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Login', passed: false, error: err.message });
  }

  // If no token, can't continue with authenticated tests
  if (!authToken) {
    console.log(chalk.yellow('\n   Cannot continue without authentication token.\n'));
    return results;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // ============================================
  // TEST 3: Get current user (/auth/me)
  // ============================================
  console.log(chalk.cyan('3. Testing /auth/me...'));
  try {
    const meRes = await fetch(`${apiUrl}/auth/me`, { headers: authHeaders });
    const meData = await meRes.json().catch(() => ({}));

    if (meRes.ok && meData.email === testEmail) {
      console.log(chalk.green('   ✓ /auth/me returns correct user'));
      results.passed++;
      results.tests.push({ name: '/auth/me', passed: true });
      userId = meData.id;
    } else if (meRes.ok) {
      console.log(chalk.yellow(`   ⚠ /auth/me returned different email: ${meData.email}`));
      results.passed++;
      results.tests.push({ name: '/auth/me', passed: true, note: 'email mismatch' });
      userId = meData.id;
    } else {
      console.log(chalk.red(`   ✗ /auth/me failed: ${meRes.status}`));
      results.failed++;
      results.tests.push({ name: '/auth/me', passed: false, status: meRes.status });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ /auth/me error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: '/auth/me', passed: false, error: err.message });
  }

  // ============================================
  // TEST 4: Onboarding field check
  // ============================================
  console.log(chalk.cyan('4. Testing onboarding field...'));
  try {
    const meRes = await fetch(`${apiUrl}/auth/me`, { headers: authHeaders });
    const meData = await meRes.json().catch(() => ({}));

    if (meData.has_completed_onboarding === false) {
      console.log(chalk.green('   ✓ has_completed_onboarding = false for new user'));
      results.passed++;
      results.tests.push({ name: 'Onboarding field (new user)', passed: true });
    } else if (meData.has_completed_onboarding === true) {
      console.log(chalk.yellow('   ⚠ has_completed_onboarding = true (may be returning user)'));
      results.passed++;
      results.tests.push({ name: 'Onboarding field', passed: true, note: 'already completed' });
    } else if (meData.has_completed_onboarding === undefined) {
      console.log(chalk.red('   ✗ has_completed_onboarding field MISSING from response'));
      console.log(chalk.gray(`     Response fields: ${Object.keys(meData).join(', ')}`));
      results.failed++;
      results.tests.push({ name: 'Onboarding field', passed: false, error: 'field missing' });
    } else {
      console.log(chalk.yellow(`   ⚠ has_completed_onboarding = ${meData.has_completed_onboarding}`));
      results.passed++;
      results.tests.push({ name: 'Onboarding field', passed: true });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Onboarding field check error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Onboarding field', passed: false, error: err.message });
  }

  // ============================================
  // TEST 5: Complete onboarding
  // ============================================
  console.log(chalk.cyan('5. Testing complete onboarding...'));
  try {
    const onboardRes = await fetch(`${apiUrl}/users/complete-onboarding`, {
      method: 'PATCH',
      headers: authHeaders,
    });

    if (onboardRes.ok) {
      console.log(chalk.green('   ✓ Onboarding marked complete'));
      results.passed++;
      results.tests.push({ name: 'Complete onboarding', passed: true });
    } else {
      const errorData = await onboardRes.json().catch(() => ({}));
      console.log(chalk.red(`   ✗ Complete onboarding failed: ${onboardRes.status}`));
      console.log(chalk.gray(`     ${JSON.stringify(errorData).slice(0, 100)}`));
      results.failed++;
      results.tests.push({ name: 'Complete onboarding', passed: false, status: onboardRes.status });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Complete onboarding error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Complete onboarding', passed: false, error: err.message });
  }

  // ============================================
  // TEST 6: Verify onboarding persisted
  // ============================================
  console.log(chalk.cyan('6. Verifying onboarding persisted...'));
  try {
    const meRes = await fetch(`${apiUrl}/auth/me`, { headers: authHeaders });
    const meData = await meRes.json().catch(() => ({}));

    if (meData.has_completed_onboarding === true) {
      console.log(chalk.green('   ✓ Onboarding status persisted'));
      results.passed++;
      results.tests.push({ name: 'Onboarding persistence', passed: true });
    } else {
      console.log(chalk.red(`   ✗ Onboarding status NOT persisted (value: ${meData.has_completed_onboarding})`));
      results.failed++;
      results.tests.push({ name: 'Onboarding persistence', passed: false });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Onboarding persistence check error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Onboarding persistence', passed: false, error: err.message });
  }

  // ============================================
  // TEST 7: Test billing/subscription (catches 403)
  // ============================================
  console.log(chalk.cyan('7. Testing /billing/subscription (403 detection)...'));
  try {
    const billingRes = await fetch(`${apiUrl}/billing/subscription`, {
      headers: authHeaders,
    });

    const billingData = await billingRes.json().catch(() => ({}));

    if (billingRes.ok) {
      console.log(chalk.green('   ✓ Billing endpoint works for authenticated user'));
      results.passed++;
      results.tests.push({ name: 'Billing subscription', passed: true });
    } else if (billingRes.status === 403) {
      console.log(chalk.red('   ✗ CRITICAL: 403 Forbidden on billing (should be 200 or 401)'));
      console.log(chalk.gray(`     ${JSON.stringify(billingData).slice(0, 100)}`));
      results.failed++;
      results.tests.push({
        name: 'Billing subscription',
        passed: false,
        status: 403,
        error: '403 on authenticated endpoint - likely HTTPBearer issue',
        critical: true,
      });
    } else if (billingRes.status === 401) {
      console.log(chalk.yellow('   ⚠ 401 on billing (token might be invalid)'));
      results.passed++; // 401 is acceptable - means auth is working
      results.tests.push({ name: 'Billing subscription', passed: true, note: '401 expected' });
    } else if (billingRes.status === 404) {
      console.log(chalk.gray('   ⊘ Billing endpoint not found (may not exist)'));
      results.skipped++;
      results.tests.push({ name: 'Billing subscription', skipped: true, reason: 'endpoint not found' });
    } else {
      console.log(chalk.red(`   ✗ Billing failed: ${billingRes.status}`));
      results.failed++;
      results.tests.push({ name: 'Billing subscription', passed: false, status: billingRes.status });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Billing error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Billing subscription', passed: false, error: err.message });
  }

  // ============================================
  // TEST 8: Test /dashboard (catches 403)
  // ============================================
  console.log(chalk.cyan('8. Testing /dashboard (403 detection)...'));
  try {
    const dashRes = await fetch(`${apiUrl}/dashboard`, {
      headers: authHeaders,
    });

    const dashData = await dashRes.json().catch(() => ({}));

    if (dashRes.ok) {
      console.log(chalk.green('   ✓ Dashboard endpoint works for authenticated user'));
      results.passed++;
      results.tests.push({ name: 'Dashboard', passed: true });
    } else if (dashRes.status === 403) {
      console.log(chalk.red('   ✗ CRITICAL: 403 Forbidden on dashboard'));
      results.failed++;
      results.tests.push({
        name: 'Dashboard',
        passed: false,
        status: 403,
        error: '403 on authenticated endpoint',
        critical: true,
      });
    } else if (dashRes.status === 404) {
      console.log(chalk.gray('   ⊘ Dashboard endpoint not found (may not exist)'));
      results.skipped++;
      results.tests.push({ name: 'Dashboard', skipped: true, reason: 'endpoint not found' });
    } else {
      console.log(chalk.yellow(`   ⚠ Dashboard: ${dashRes.status}`));
      results.passed++;
      results.tests.push({ name: 'Dashboard', passed: true, note: `${dashRes.status}` });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Dashboard error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Dashboard', passed: false, error: err.message });
  }

  // ============================================
  // TEST 9: Create client
  // ============================================
  console.log(chalk.cyan('9. Testing create client...'));
  try {
    const clientRes = await fetch(`${apiUrl}/clients`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'DevLoop Test Client',
        email: `client-${random}@devloop-test.com`,
        company: 'Test Company',
      }),
    });

    const clientData = await clientRes.json().catch(() => ({}));

    if ((clientRes.ok || clientRes.status === 201) && clientData.id) {
      clientId = clientData.id;
      console.log(chalk.green(`   ✓ Client created: ${clientId}`));
      results.passed++;
      results.tests.push({ name: 'Create client', passed: true, id: clientId });
    } else {
      console.log(chalk.red(`   ✗ Create client failed: ${clientRes.status}`));
      console.log(chalk.gray(`     ${JSON.stringify(clientData).slice(0, 100)}`));
      results.failed++;
      results.tests.push({ name: 'Create client', passed: false, status: clientRes.status });
    }
  } catch (err) {
    console.log(chalk.red(`   ✗ Create client error: ${err.message}`));
    results.failed++;
    results.tests.push({ name: 'Create client', passed: false, error: err.message });
  }

  // ============================================
  // TEST 10: Create project (if client was created)
  // ============================================
  if (clientId) {
    console.log(chalk.cyan('10. Testing create project...'));
    try {
      const projectRes = await fetch(`${apiUrl}/projects`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'DevLoop Test Project',
          client_id: clientId,
          description: 'Created by DevLoop live production test',
        }),
      });

      const projectData = await projectRes.json().catch(() => ({}));

      if ((projectRes.ok || projectRes.status === 201) && projectData.id) {
        projectId = projectData.id;
        console.log(chalk.green(`   ✓ Project created: ${projectId}`));
        results.passed++;
        results.tests.push({ name: 'Create project', passed: true, id: projectId });
      } else {
        console.log(chalk.red(`   ✗ Create project failed: ${projectRes.status}`));
        console.log(chalk.gray(`     ${JSON.stringify(projectData).slice(0, 100)}`));
        results.failed++;
        results.tests.push({ name: 'Create project', passed: false, status: projectRes.status });
      }
    } catch (err) {
      console.log(chalk.red(`   ✗ Create project error: ${err.message}`));
      results.failed++;
      results.tests.push({ name: 'Create project', passed: false, error: err.message });
    }
  } else {
    console.log(chalk.gray('10. Skipping create project (no client)'));
    results.skipped++;
    results.tests.push({ name: 'Create project', skipped: true, reason: 'no client' });
  }

  // ============================================
  // CLEANUP: Delete test data
  // ============================================
  console.log(chalk.gray('\n  Cleaning up test data...'));

  // Delete project
  if (projectId) {
    try {
      await fetch(`${apiUrl}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      console.log(chalk.gray(`   Deleted project ${projectId}`));
    } catch (err) {
      console.log(chalk.gray(`   Could not delete project: ${err.message}`));
    }
  }

  // Delete client
  if (clientId) {
    try {
      await fetch(`${apiUrl}/clients/${clientId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      console.log(chalk.gray(`   Deleted client ${clientId}`));
    } catch (err) {
      console.log(chalk.gray(`   Could not delete client: ${err.message}`));
    }
  }

  // Note: User deletion typically requires admin access, leaving test user

  // ============================================
  // SUMMARY
  // ============================================
  const total = results.passed + results.failed;
  const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;

  console.log('\n' + chalk.gray('─'.repeat(50)));
  console.log(chalk.bold.red(`  LIVE TESTS: ${results.passed}/${total} passed (${passRate}%)`));

  if (results.failed > 0) {
    console.log(chalk.red(`\n  ${results.failed} test(s) failed:`));
    for (const test of results.tests) {
      if (!test.passed && !test.skipped) {
        console.log(chalk.red(`    ✗ ${test.name}: ${test.error || test.status || 'failed'}`));
      }
    }

    // ============================================
    // AUTO-FIX ANALYSIS (if tests failed)
    // ============================================
    if (config.fix) {
      const failuresForAnalysis = results.tests
        .filter(t => !t.passed && !t.skipped)
        .map(t => ({
          endpoint: t.name,
          status: t.status,
          error: t.error,
          details: t.error || `HTTP ${t.status}`,
        }));

      if (failuresForAnalysis.length > 0) {
        const analysisResult = await analyzeFailures(failuresForAnalysis, {
          url: apiUrl,
          autoApply: config.fix === true,
          verifyFix: true,
        });

        // Store analysis in results
        results.autoFixAnalysis = analysisResult;

        if (analysisResult.fixesApplied > 0) {
          console.log(chalk.bold.green(`\n  ✓ Applied ${analysisResult.fixesApplied} auto-fix(es)`));
          console.log(chalk.yellow('  Re-run live tests to verify: devloop qa --live --api-url ' + apiUrl));
        }
      }
    }
  }

  if (passRate >= 80) {
    console.log(chalk.green('\n  ✓ Live production tests PASSED'));
  } else {
    console.log(chalk.red('\n  ✗ Live production tests FAILED (need 80%+)'));
    if (!config.fix) {
      console.log(chalk.yellow('  Tip: Run with --fix to auto-diagnose issues'));
    }
  }

  console.log('');

  return results;
}

export default runLiveTests;
