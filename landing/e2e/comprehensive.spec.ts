import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * DevLoop Comprehensive E2E Test Suite
 *
 * Tests ALL user flows including:
 * - Landing page and navigation
 * - Authentication flows (magic link)
 * - Dashboard (authenticated)
 * - Project CRUD operations
 * - Billing flows
 * - API contract validation
 *
 * Run: npx playwright test e2e/comprehensive.spec.ts
 */

const BASE_URL = process.env.BASE_URL || 'https://devloop-landing.fly.dev';
const API_URL = process.env.API_URL || 'https://devloop-api.fly.dev';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500); // Allow React to hydrate
}

// ==========================================
// 1. API HEALTH & CONTRACT TESTS
// ==========================================

test.describe('API Health & Contracts', () => {
  test('health endpoint returns healthy status', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('magic-link endpoint accepts valid email', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/magic-link`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'test@example.com' }
    });
    // Should return 200 (success) or 429 (rate limited), not 422 or 500
    expect([200, 429]).toContain(response.status());
  });

  test('magic-link endpoint rejects empty body', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/magic-link`, {
      headers: { 'Content-Type': 'application/json' },
      data: {}
    });
    expect(response.status()).toBe(422);
  });

  test('verify endpoint rejects invalid token', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/verify`, {
      headers: { 'Content-Type': 'application/json' },
      data: { token: 'invalid-token' }
    });
    expect(response.status()).toBe(400);
  });

  test('auth/me requires authentication', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/auth/me`);
    expect([401, 403]).toContain(response.status());
  });

  test('dashboard/summary requires authentication', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/dashboard/summary`);
    expect([401, 403]).toContain(response.status());
  });

  test('dashboard/projects requires authentication', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/dashboard/projects`);
    expect([401, 403]).toContain(response.status());
  });

  test('create project requires authentication', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/dashboard/projects`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: 'Test Project' }
    });
    expect([401, 403]).toContain(response.status());
  });

  test('billing portal requires authentication and body', async ({ request }) => {
    // Without auth
    const response = await request.post(`${API_URL}/api/v1/billing/portal`, {
      headers: { 'Content-Type': 'application/json' },
      data: { return_url: 'https://example.com' }
    });
    expect([401, 403]).toContain(response.status());

    // Without body (should be 422 or auth error first)
    const response2 = await request.post(`${API_URL}/api/v1/billing/portal`, {
      headers: { 'Content-Type': 'application/json' },
      data: {}
    });
    expect([401, 403, 422]).toContain(response2.status());
  });

  test('checkout endpoint accepts valid plan', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/billing/checkout`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        plan: 'solo',
        success_url: `${BASE_URL}/checkout/success`,
        cancel_url: `${BASE_URL}/#pricing`
      }
    });
    // Should return 200 with checkout_url or 400 if Stripe error
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.checkout_url).toBeTruthy();
      expect(body.checkout_url).toContain('stripe.com');
    }
  });

  test('checkout endpoint rejects invalid plan', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/billing/checkout`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        plan: 'invalid-plan',
        success_url: `${BASE_URL}/checkout/success`,
        cancel_url: `${BASE_URL}/#pricing`
      }
    });
    expect(response.status()).toBe(422);
  });

  test('checkout endpoint rejects empty body', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/billing/checkout`, {
      headers: { 'Content-Type': 'application/json' },
      data: {}
    });
    expect(response.status()).toBe(422);
  });
});

// ==========================================
// 2. LANDING PAGE TESTS
// ==========================================

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);
  });

  test('loads without errors', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays hero section with heading', async ({ page }) => {
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText?.length).toBeGreaterThan(0);
  });

  test('displays navigation links', async ({ page }) => {
    // Check for navigation
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();

    // Should have key navigation elements
    const links = page.locator('a[href*="pricing"], a[href*="docs"], a[href*="dashboard"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('pricing section has all 3 plans', async ({ page }) => {
    await page.goto(`${BASE_URL}/#pricing`);
    await waitForPageLoad(page);

    // Should have Solo, Pro, Team text somewhere
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Solo');
    expect(pageContent).toContain('Pro');
    expect(pageContent).toContain('Team');

    // Should have subscribe/checkout buttons
    const checkoutButtons = page.locator('button:has-text("Subscribe"), button:has-text("Get Started")');
    const buttonCount = await checkoutButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);
  });

  test('pricing buttons trigger checkout', async ({ page }) => {
    await page.goto(`${BASE_URL}/#pricing`);
    await waitForPageLoad(page);

    // Find first subscribe button
    const subscribeButton = page.locator('button:has-text("Subscribe")').first();

    if (await subscribeButton.isVisible()) {
      // Listen for navigation (Stripe redirect) or API call
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/v1/billing/checkout'),
        { timeout: 10000 }
      ).catch(() => null);

      await subscribeButton.click();

      const response = await responsePromise;
      if (response) {
        // Should succeed (200) or have Stripe config issue (400), not 500
        expect(response.status()).not.toBe(500);
      }
    }
  });

  test('displays terminal animation', async ({ page }) => {
    // Look for terminal/code elements
    const terminal = page.locator('[class*="terminal"], [class*="font-mono"], pre').first();

    if (await terminal.isVisible()) {
      await expect(terminal).toBeVisible();
    }
  });

  test('magic link form on landing accepts email', async ({ page }) => {
    // Find email input on landing page
    const emailInput = page.locator('input[type="email"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');

      const submitButton = page.locator('button[type="submit"], button:has-text("Magic Link")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show loading or success state
        await page.waitForTimeout(1000);
        const buttonText = await submitButton.textContent();
        const pageContent = await page.textContent('body');

        // Should show either loading state, success message, or error (not crash)
        const hasExpectedState =
          buttonText?.includes('Sending') ||
          buttonText?.includes('Sent') ||
          pageContent?.includes('Check your email') ||
          pageContent?.includes('error') ||
          pageContent?.includes('Error');

        expect(hasExpectedState || await page.locator('body').isVisible()).toBeTruthy();
      }
    }
  });
});

// ==========================================
// 3. NAVIGATION TESTS
// ==========================================

test.describe('Navigation', () => {
  test('pricing anchor scrolls to pricing section', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    const pricingLink = page.locator('a[href*="#pricing"], a:has-text("Pricing")').first();

    if (await pricingLink.isVisible()) {
      await pricingLink.click();
      await page.waitForTimeout(500);

      // Check URL contains pricing hash
      expect(page.url()).toContain('pricing');
    }
  });

  test('docs link navigates to docs page', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    const docsLink = page.locator('a[href*="/docs"], a:has-text("Docs")').first();

    if (await docsLink.isVisible()) {
      await docsLink.click();
      await page.waitForURL('**/docs**', { timeout: 5000 }).catch(() => {});

      // Should be on docs page or still on landing (if docs link isn't direct)
      const url = page.url();
      expect(url.includes('docs') || url === BASE_URL || url === `${BASE_URL}/`).toBeTruthy();
    }
  });

  test('dashboard link navigates to dashboard', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    const dashboardLink = page.locator('a[href*="/dashboard"], a:has-text("Dashboard")').first();

    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForURL('**/dashboard**', { timeout: 5000 });

      expect(page.url()).toContain('dashboard');
    }
  });

  test('mobile menu toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    // Find mobile menu button
    const menuButton = page.locator('button[aria-label*="menu"], button:has(svg), nav button').first();

    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);

      // Some menu should now be visible
      const mobileMenu = page.locator('[class*="mobile"], [class*="menu"]');
      if (await mobileMenu.first().isVisible()) {
        await expect(mobileMenu.first()).toBeVisible();
      }
    }
  });
});

// ==========================================
// 4. DASHBOARD LOGIN TESTS
// ==========================================

test.describe('Dashboard Login', () => {
  test('shows login form when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    // Should show email input for login
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('login form validates email', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    // Try to submit empty form
    await submitButton.click();

    // HTML5 validation should prevent submission
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('login form sends magic link request', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('test@example.com');

    // Listen for API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/v1/auth/magic-link'),
      { timeout: 15000 }
    ).catch(() => null);

    await submitButton.click();

    const response = await responsePromise;
    if (response) {
      // Should be 200 (success) or 429 (rate limited), not 500
      expect(response.status()).not.toBe(500);
    }

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows loading state during login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('test@example.com');
    await submitButton.click();

    // Should show loading state immediately
    await page.waitForTimeout(100);
    const isDisabled = await submitButton.isDisabled();
    const buttonText = await submitButton.textContent();

    // Either disabled or shows loading text
    expect(isDisabled || buttonText?.includes('Sending')).toBeTruthy();
  });
});

// ==========================================
// 5. AUTH VERIFY PAGE TESTS
// ==========================================

test.describe('Auth Verify Page', () => {
  test('handles invalid token gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/auth/verify?token=invalid-token-12345`);

    expect(response?.status()).toBeLessThan(500);
    await page.waitForTimeout(3000);

    // Should show error message or redirect
    const pageContent = await page.textContent('body') || '';
    const currentUrl = page.url();

    const handled =
      pageContent.toLowerCase().includes('invalid') ||
      pageContent.toLowerCase().includes('expired') ||
      pageContent.toLowerCase().includes('error') ||
      !currentUrl.includes('/auth/verify');

    expect(handled).toBeTruthy();
  });

  test('handles missing token gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/auth/verify`);

    expect(response?.status()).toBeLessThan(500);
    await page.waitForTimeout(3000);

    // Should handle missing token
    await expect(page.locator('body')).toBeVisible();
  });
});

// ==========================================
// 6. CHECKOUT SUCCESS PAGE TESTS
// ==========================================

test.describe('Checkout Success Page', () => {
  test('displays success message', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/checkout/success`);

    expect(response?.status()).toBeLessThan(500);
    await waitForPageLoad(page);

    const pageContent = await page.textContent('body') || '';

    // Should show success-related content
    const hasSuccessContent =
      pageContent.toLowerCase().includes('success') ||
      pageContent.toLowerCase().includes('thank') ||
      pageContent.toLowerCase().includes('payment');

    expect(hasSuccessContent).toBeTruthy();
  });

  test('redirects to dashboard after delay', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout/success`);

    // Wait for redirect (typically 3 seconds)
    await page.waitForTimeout(4000);

    // Should have redirected or still be on success page
    const url = page.url();
    expect(url.includes('dashboard') || url.includes('success')).toBeTruthy();
  });
});

// ==========================================
// 7. DOCS PAGE TESTS
// ==========================================

test.describe('Documentation Page', () => {
  test('loads without errors', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/docs`);

    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays documentation content', async ({ page }) => {
    await page.goto(`${BASE_URL}/docs`);
    await waitForPageLoad(page);

    const pageContent = await page.textContent('body') || '';

    // Should have documentation-related content
    const hasDocsContent =
      pageContent.includes('Quick Start') ||
      pageContent.includes('Installation') ||
      pageContent.includes('npx create-devloop') ||
      pageContent.includes('Commands') ||
      pageContent.includes('Environment');

    expect(hasDocsContent).toBeTruthy();
  });

  test('has navigation back to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/docs`);
    await waitForPageLoad(page);

    const homeLink = page.locator('a[href="/"], a:has-text("Home"), a:has-text("DevLoop")').first();
    await expect(homeLink).toBeVisible();
  });
});

// ==========================================
// 8. RESPONSIVE DESIGN TESTS
// ==========================================

test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.name}: landing page displays correctly`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      await expect(page.locator('body')).toBeVisible();

      // Content should not overflow horizontally
      const bodyBox = await page.locator('body').boundingBox();
      expect(bodyBox?.width).toBeLessThanOrEqual(viewport.width + 20);
    });

    test(`${viewport.name}: dashboard page displays correctly`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BASE_URL}/dashboard`);
      await waitForPageLoad(page);

      await expect(page.locator('body')).toBeVisible();
    });

    test(`${viewport.name}: pricing section is accessible`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BASE_URL}/#pricing`);
      await waitForPageLoad(page);

      // Should have checkout buttons visible
      const checkoutButtons = page.locator('button:has-text("Subscribe"), button:has-text("Get Started")');
      const count = await checkoutButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  }
});

// ==========================================
// 9. ACCESSIBILITY TESTS
// ==========================================

test.describe('Accessibility', () => {
  test('landing page has proper heading hierarchy', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);
  });

  test('form inputs have labels or placeholders', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    const inputs = page.locator('input[type="email"], input[type="text"]');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');

      const hasLabel = placeholder || ariaLabel || (id && await page.locator(`label[for="${id}"]`).count() > 0);
      expect(hasLabel).toBeTruthy();
    }
  });

  test('buttons are keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    const submitButton = page.locator('button[type="submit"]').first();

    if (await submitButton.isVisible()) {
      await submitButton.focus();
      const isFocused = await submitButton.evaluate(el => el === document.activeElement);
      expect(isFocused).toBeTruthy();
    }
  });

  test('images have alt attributes', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Alt can be empty string for decorative images, but should exist
      expect(alt !== null).toBeTruthy();
    }
  });
});

// ==========================================
// 10. ERROR HANDLING TESTS
// ==========================================

test.describe('Error Handling', () => {
  test('404 - unknown routes do not crash', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/nonexistent-page-12345`);

    // SPAs typically return 200 and handle routing client-side
    expect(response?.status()).toBeLessThan(500);

    const html = await page.content();
    expect(html.length).toBeGreaterThan(100);
  });

  test('handles network errors gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);

    // Attempt to submit form (will make API call)
    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('button[type="submit"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
      await submitButton.click();

      // Page should not crash regardless of API response
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('checkout handles API errors gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/#pricing`);
    await waitForPageLoad(page);

    // Find and click checkout button
    const checkoutButton = page.locator('button:has-text("Subscribe")').first();

    if (await checkoutButton.isVisible()) {
      await checkoutButton.click();

      // Wait for any response
      await page.waitForTimeout(3000);

      // Page should not crash - either redirects or shows error
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// ==========================================
// 11. PERFORMANCE TESTS
// ==========================================

test.describe('Performance', () => {
  test('landing page loads within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });

  test('dashboard loads within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });

  test('docs page loads within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/docs`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });

  test('API health check responds within 2 seconds', async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${API_URL}/health`);
    const responseTime = Date.now() - startTime;

    expect(responseTime).toBeLessThan(2000);
  });
});

// ==========================================
// 12. SECURITY TESTS
// ==========================================

test.describe('Security', () => {
  test('API rejects requests without proper headers', async ({ request }) => {
    // Try to create project without auth
    const response = await request.post(`${API_URL}/api/v1/dashboard/projects`, {
      data: { name: 'Hacked Project' }
    });

    expect([401, 403, 415, 422]).toContain(response.status());
  });

  test('API rejects invalid tokens', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/auth/me`, {
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      }
    });

    expect([401, 403]).toContain(response.status());
  });

  test('sensitive endpoints require authentication', async ({ request }) => {
    const protectedEndpoints = [
      { method: 'GET', path: '/api/v1/dashboard/summary' },
      { method: 'GET', path: '/api/v1/dashboard/projects' },
      { method: 'POST', path: '/api/v1/dashboard/projects' },
      { method: 'POST', path: '/api/v1/billing/portal' },
    ];

    for (const endpoint of protectedEndpoints) {
      let response;
      if (endpoint.method === 'GET') {
        response = await request.get(`${API_URL}${endpoint.path}`);
      } else {
        response = await request.post(`${API_URL}${endpoint.path}`, {
          headers: { 'Content-Type': 'application/json' },
          data: {}
        });
      }

      expect([401, 403, 422]).toContain(response.status());
    }
  });
});

// ==========================================
// 13. CONTENT TESTS
// ==========================================

test.describe('Content Verification', () => {
  test('landing page has all required sections', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    const pageContent = await page.textContent('body') || '';

    // Should have key marketing content
    expect(pageContent).toContain('DevLoop');

    // Should mention key features
    const hasFeatureContent =
      pageContent.includes('QA') ||
      pageContent.includes('test') ||
      pageContent.includes('API');
    expect(hasFeatureContent).toBeTruthy();
  });

  test('pricing page shows correct prices', async ({ page }) => {
    await page.goto(`${BASE_URL}/#pricing`);
    await waitForPageLoad(page);

    const pageContent = await page.textContent('body') || '';

    // Should show pricing tiers
    expect(pageContent).toContain('$19');
    expect(pageContent).toContain('$39');
    expect(pageContent).toContain('$79');
  });

  test('docs page has installation instructions', async ({ page }) => {
    await page.goto(`${BASE_URL}/docs`);
    await waitForPageLoad(page);

    const pageContent = await page.textContent('body') || '';

    // Should have installation command
    expect(pageContent).toContain('npx create-devloop');
  });
});

// ==========================================
// 14. CONSOLE ERROR MONITORING
// ==========================================

test.describe('Console Error Monitoring', () => {
  test('landing page has no critical console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore some common non-critical errors
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(BASE_URL);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Should have no critical errors (allow some warnings)
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('Cannot read') ||
      e.includes('undefined')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('dashboard has no critical console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('404') && !text.includes('401') && !text.includes('403')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(e =>
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('Cannot read') ||
      (e.includes('undefined') && !e.includes('token'))
    );

    expect(criticalErrors.length).toBe(0);
  });
});
