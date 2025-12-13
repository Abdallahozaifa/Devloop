import puppeteer from 'puppeteer';

/**
 * UI Runner for DevLoop Specs
 * Runs UI-type specs that test what users actually see in the browser:
 * - Page loads without errors
 * - Network requests succeed (no 404s, 500s)
 * - Console errors detection
 * - Element visibility checks
 * - Text content verification
 */

export function isUISpec(spec) {
  return spec.type === 'ui';
}

export async function runUISpec(spec, context) {
  const results = {
    name: spec.name,
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0
  };

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const test of spec.tests || []) {
      if (test.skip) {
        results.skipped++;
        results.tests.push({ ...test, status: 'skipped', passed: false });
        continue;
      }

      const result = await runUITest(test, browser, context);
      results.tests.push(result);

      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  } catch (e) {
    results.tests.push({
      name: 'Browser launch',
      passed: false,
      errors: [`Failed to launch browser: ${e.message}`]
    });
    results.failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

async function runUITest(test, browser, context) {
  const result = {
    name: test.name,
    passed: false,
    errors: [],
    networkErrors: [],
    consoleErrors: [],
    response: null
  };

  const page = await browser.newPage();

  try {
    // Track network errors (the key feature!)
    const networkErrors = [];
    const networkRequests = [];

    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText || 'Unknown error',
        resourceType: request.resourceType()
      });
    });

    page.on('response', response => {
      const status = response.status();
      const url = response.url();

      networkRequests.push({ url, status });

      // Track failed responses (4xx, 5xx) for API calls
      if (status >= 400 && url.includes('/api/')) {
        networkErrors.push({
          url,
          status,
          failure: `HTTP ${status}`,
          resourceType: 'api'
        });
      }
    });

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign errors
        if (!text.includes('favicon') && !text.includes('net::ERR_BLOCKED_BY_CLIENT')) {
          consoleErrors.push(text);
        }
      }
    });

    // Set headers if specified
    if (test.headers) {
      await page.setExtraHTTPHeaders(test.headers);
    }

    // Build the URL
    let url = test.url;
    if (!url.startsWith('http')) {
      const baseUrl = context.baseUrl || context.apiUrl || 'http://localhost:3000';
      url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }

    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: test.waitUntil || 'networkidle2',
      timeout: test.timeout || 30000
    });

    result.response = {
      status: response.status(),
      url: response.url()
    };

    // Wait for additional time if specified
    if (test.waitFor) {
      await page.waitForTimeout(test.waitFor);
    }

    // Run checks
    const expect = test.expect || {};

    // Check page status
    if (expect.status) {
      const expectedStatuses = Array.isArray(expect.status) ? expect.status : [expect.status];
      if (!expectedStatuses.includes(response.status())) {
        result.errors.push(`Expected status ${expectedStatuses.join('/')}, got ${response.status()}`);
      }
    }

    // Check for no network errors (THE KEY CHECK!)
    if (expect.noNetworkErrors !== false) {
      // Filter based on allowedFailures
      const allowedPatterns = expect.allowedFailures || [];
      const realErrors = networkErrors.filter(err => {
        return !allowedPatterns.some(pattern => {
          if (typeof pattern === 'string') {
            return err.url.includes(pattern);
          }
          return new RegExp(pattern).test(err.url);
        });
      });

      if (realErrors.length > 0) {
        for (const err of realErrors) {
          result.errors.push(`Network error: ${err.failure} for ${err.url}`);
        }
        result.networkErrors = realErrors;
      }
    }

    // Check for no console errors
    if (expect.noConsoleErrors !== false) {
      const allowedErrors = expect.allowedConsoleErrors || [];
      const realConsoleErrors = consoleErrors.filter(err => {
        return !allowedErrors.some(pattern => err.includes(pattern));
      });

      if (realConsoleErrors.length > 0) {
        for (const err of realConsoleErrors) {
          result.errors.push(`Console error: ${err}`);
        }
        result.consoleErrors = realConsoleErrors;
      }
    }

    // Check that element exists
    if (expect.elementExists) {
      const selectors = Array.isArray(expect.elementExists) ? expect.elementExists : [expect.elementExists];
      for (const selector of selectors) {
        const element = await page.$(selector);
        if (!element) {
          result.errors.push(`Element not found: ${selector}`);
        }
      }
    }

    // Check that element does NOT exist (for error states)
    if (expect.elementNotExists) {
      const selectors = Array.isArray(expect.elementNotExists) ? expect.elementNotExists : [expect.elementNotExists];
      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) {
          result.errors.push(`Element should not exist but found: ${selector}`);
        }
      }
    }

    // Check text content
    if (expect.textContains) {
      const content = await page.content();
      const texts = Array.isArray(expect.textContains) ? expect.textContains : [expect.textContains];
      for (const text of texts) {
        if (!content.includes(text)) {
          result.errors.push(`Text not found on page: "${text}"`);
        }
      }
    }

    // Check text NOT present (for error messages)
    if (expect.textNotContains) {
      const content = await page.content();
      const texts = Array.isArray(expect.textNotContains) ? expect.textNotContains : [expect.textNotContains];
      for (const text of texts) {
        if (content.includes(text)) {
          result.errors.push(`Unwanted text found on page: "${text}"`);
        }
      }
    }

    // Check page title
    if (expect.title) {
      const title = await page.title();
      if (expect.title.exact && title !== expect.title.exact) {
        result.errors.push(`Expected title "${expect.title.exact}", got "${title}"`);
      }
      if (expect.title.contains && !title.includes(expect.title.contains)) {
        result.errors.push(`Title should contain "${expect.title.contains}", got "${title}"`);
      }
    }

    // Check that API calls succeeded
    if (expect.apiCallsSucceed) {
      const patterns = Array.isArray(expect.apiCallsSucceed) ? expect.apiCallsSucceed : [expect.apiCallsSucceed];
      for (const pattern of patterns) {
        const matchingRequests = networkRequests.filter(r => r.url.includes(pattern));
        if (matchingRequests.length === 0) {
          result.errors.push(`No API call matching "${pattern}" was made`);
        } else {
          const failedCalls = matchingRequests.filter(r => r.status >= 400);
          for (const failed of failedCalls) {
            result.errors.push(`API call to ${failed.url} returned ${failed.status}`);
          }
        }
      }
    }

    result.passed = result.errors.length === 0;

  } catch (e) {
    result.errors.push(e.message);
    result.passed = false;
  } finally {
    await page.close();
  }

  return result;
}

export { runUITest };
