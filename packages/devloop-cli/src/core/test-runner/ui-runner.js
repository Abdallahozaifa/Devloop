/**
 * Playwright UI Test Runner
 * Runs browser-based UI tests with screenshots and console error capture
 */

import fs from 'fs';
import path from 'path';

// Check if Playwright is available
let playwright = null;
let playwrightAvailable = false;

try {
  playwright = await import('playwright');
  playwrightAvailable = true;
} catch (e) {
  // Playwright not installed - will use HTTP fallback
}

/**
 * Run UI tests with Playwright (if available) or HTTP fallback
 */
export async function runUiTests(tests, { baseUrl, context, screenshotDir }) {
  if (playwrightAvailable) {
    return runPlaywrightTests(tests, { baseUrl, context, screenshotDir });
  } else {
    return runHttpTests(tests, { baseUrl });
  }
}

/**
 * Run tests using Playwright for full browser testing
 */
async function runPlaywrightTests(tests, { baseUrl, context, screenshotDir }) {
  const results = [];

  // Ensure screenshot directory exists
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Launch browser
  const browser = await playwright.chromium.launch({
    headless: true,
  });

  try {
    // Create context with viewport sizes
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'DevLoop-QA/1.0 (Desktop)',
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'DevLoop-QA/1.0 (Mobile)',
      isMobile: true,
    });

    // Run tests
    for (const test of tests) {
      const result = {
        name: test.name,
        type: test.type,
        route: test.route || test.steps?.[0]?.url || '/',
        passed: false,
        error: null,
        responseTime: null,
        consoleErrors: [],
        screenshots: {},
      };

      try {
        const route = result.route;
        const url = `${baseUrl}${route}`;

        // Desktop test
        const desktopPage = await desktopContext.newPage();
        const desktopResult = await testPage(desktopPage, url, test, {
          viewport: 'desktop',
          screenshotDir,
        });

        result.desktop = desktopResult;
        if (desktopResult.screenshot) {
          result.screenshots.desktop = desktopResult.screenshot;
        }

        await desktopPage.close();

        // Mobile test
        const mobilePage = await mobileContext.newPage();
        const mobileResult = await testPage(mobilePage, url, test, {
          viewport: 'mobile',
          screenshotDir,
        });

        result.mobile = mobileResult;
        if (mobileResult.screenshot) {
          result.screenshots.mobile = mobileResult.screenshot;
        }

        await mobilePage.close();

        // Combine results
        result.consoleErrors = [
          ...desktopResult.consoleErrors,
          ...mobileResult.consoleErrors,
        ];

        result.responseTime = desktopResult.responseTime;
        result.passed = desktopResult.passed && mobileResult.passed;

        if (!result.passed) {
          result.error = desktopResult.error || mobileResult.error;
        }
      } catch (err) {
        result.error = err.message;
      }

      results.push(result);
    }

    await desktopContext.close();
    await mobileContext.close();
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Test a single page
 */
async function testPage(page, url, test, { viewport, screenshotDir }) {
  const result = {
    viewport,
    passed: false,
    statusCode: null,
    responseTime: null,
    error: null,
    consoleErrors: [],
    screenshot: null,
  };

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      result.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    result.consoleErrors.push(error.message);
  });

  try {
    const startTime = Date.now();

    // Navigate to page
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    result.responseTime = Date.now() - startTime;
    result.statusCode = response?.status();

    // Take screenshot
    if (screenshotDir) {
      const safeName = test.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const screenshotPath = path.join(screenshotDir, `${safeName}-${viewport}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      result.screenshot = screenshotPath;
    }

    // Check for expected elements if specified
    if (test.expect?.elements) {
      for (const selector of test.expect.elements) {
        const element = await page.$(selector);
        if (!element) {
          result.error = `Expected element not found: ${selector}`;
          return result;
        }
      }
    }

    // Check for expected text if specified
    if (test.expect?.text) {
      const pageText = await page.textContent('body');
      for (const expectedText of test.expect.text) {
        if (!pageText.includes(expectedText)) {
          result.error = `Expected text not found: ${expectedText}`;
          return result;
        }
      }
    }

    // Check status code
    if (result.statusCode === 200 || result.statusCode === 304) {
      result.passed = true;
    } else if (result.statusCode === 401 || result.statusCode === 403) {
      // Auth required - acceptable for protected routes
      result.passed = test.auth ? false : true;
      if (!result.passed) {
        result.error = 'Authentication required';
      }
    } else {
      result.error = `HTTP ${result.statusCode}`;
    }

    // Check for console errors (optional - can be strict or lenient)
    if (result.consoleErrors.length > 0 && test.strictConsole) {
      result.passed = false;
      result.error = `Console errors: ${result.consoleErrors.join(', ')}`;
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * HTTP fallback for UI tests (no browser)
 */
async function runHttpTests(tests, { baseUrl }) {
  const results = [];

  for (const test of tests) {
    const result = {
      name: test.name,
      type: test.type,
      route: test.route || test.steps?.[0]?.url || '/',
      passed: false,
      error: null,
      responseTime: null,
      consoleErrors: [],
      screenshots: {},
      note: 'HTTP-only test (install playwright for full browser testing)',
    };

    try {
      const url = `${baseUrl}${result.route}`;
      const startTime = Date.now();

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DevLoop-QA/1.0',
        },
      });

      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;

      // Check status
      if (response.status === 200 || response.status === 304) {
        result.passed = true;
      } else if (response.status === 401 || response.status === 403) {
        result.passed = !test.auth;
        if (!result.passed) {
          result.error = 'Authentication required';
        }
      } else {
        result.error = `HTTP ${response.status}`;
      }
    } catch (err) {
      result.error = err.message;
    }

    results.push(result);
  }

  return results;
}

/**
 * Run a login flow test
 */
export async function runLoginTest({ baseUrl, loginPath, credentials, context }) {
  if (!playwrightAvailable) {
    return { success: false, error: 'Playwright not available' };
  }

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const browserContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    const page = await browserContext.newPage();

    // Navigate to login page
    await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });

    // Find and fill email/username field
    const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]');
    if (emailInput) {
      await emailInput.fill(credentials.email);
    }

    // Find and fill password field
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.fill(credentials.password);
    }

    // Find and click submit button
    const submitButton = await page.$('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      await submitButton.click();
    }

    // Wait for navigation or response
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});

    // Check if login was successful (look for common indicators)
    const url = page.url();
    const loginSuccessful = !url.includes('login') && !url.includes('signin');

    // Extract auth token from localStorage/sessionStorage/cookies
    const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
    const sessionStorage = await page.evaluate(() => JSON.stringify(window.sessionStorage));
    const cookies = await browserContext.cookies();

    let token = null;

    // Check localStorage
    try {
      const localData = JSON.parse(localStorage);
      token = localData.token || localData.access_token || localData.accessToken;
    } catch (e) {}

    // Check sessionStorage
    if (!token) {
      try {
        const sessionData = JSON.parse(sessionStorage);
        token = sessionData.token || sessionData.access_token || sessionData.accessToken;
      } catch (e) {}
    }

    // Check cookies
    if (!token) {
      const authCookie = cookies.find(c =>
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('session')
      );
      if (authCookie) {
        token = authCookie.value;
      }
    }

    await browserContext.close();

    return {
      success: loginSuccessful,
      token,
      url,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Take screenshots of key pages
 */
export async function captureScreenshots(routes, { baseUrl, outputDir, viewports = ['desktop', 'mobile'] }) {
  if (!playwrightAvailable) {
    return { success: false, error: 'Playwright not available' };
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await playwright.chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of viewports) {
      const viewportConfig = viewport === 'mobile'
        ? { width: 375, height: 812, isMobile: true }
        : { width: 1920, height: 1080 };

      const context = await browser.newContext({
        viewport: viewportConfig,
        isMobile: viewport === 'mobile',
      });

      const page = await context.newPage();

      for (const route of routes) {
        const routePath = typeof route === 'string' ? route : route.path || route.route || '/';
        const url = `${baseUrl}${routePath}`;

        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

          const safeName = routePath.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'home';
          const screenshotPath = path.join(outputDir, `${safeName}-${viewport}.png`);

          await page.screenshot({ path: screenshotPath, fullPage: true });

          results.push({
            route: routePath,
            viewport,
            screenshot: screenshotPath,
            success: true,
          });
        } catch (err) {
          results.push({
            route: routePath,
            viewport,
            success: false,
            error: err.message,
          });
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  return {
    success: true,
    screenshots: results,
    outputDir,
  };
}

/**
 * Check if Playwright is available
 */
export function isPlaywrightAvailable() {
  return playwrightAvailable;
}

export default {
  runUiTests,
  runLoginTest,
  captureScreenshots,
  isPlaywrightAvailable,
};
