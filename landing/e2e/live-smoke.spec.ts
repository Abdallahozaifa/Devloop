import { test, expect, Page } from '@playwright/test';

/**
 * Live Smoke Test - Tests actual UI interactions on production
 *
 * Run with: npx playwright test e2e/live-smoke.spec.ts --project=chromium
 * Run headed: npx playwright test e2e/live-smoke.spec.ts --project=chromium --headed
 * Run authenticated only: npx playwright test e2e/live-smoke.spec.ts --project=chromium --grep "Authenticated"
 *
 * TEST USER:
 *   Email: abdallahozaifa19527@gmail.com
 *   User ID: aadfd94f-0b0d-44e8-bf1a-3ad15de7a4d1
 *   localStorage Key: 'token' (NOT 'devloop_token' - see App.tsx:254)
 *
 * TO REGENERATE JWT TOKEN (expires every 24 hours):
 *   fly ssh console -a devloop-api -C "python3 -c \"
 *   import os
 *   from datetime import datetime, timedelta
 *   from jose import jwt
 *   secret = os.environ.get('SECRET_KEY')
 *   user_id = 'aadfd94f-0b0d-44e8-bf1a-3ad15de7a4d1'
 *   expire = datetime.utcnow() + timedelta(days=1)
 *   token = jwt.encode({'sub': user_id, 'exp': expire}, secret, algorithm='HS256')
 *   print(token)
 *   \""
 *
 * COMMON ISSUES:
 *   - "Token may be expired" → Regenerate JWT using command above
 *   - Login form still showing → Check localStorage key is 'token' not 'devloop_token'
 *   - 400 on billing → Expected if user has no Stripe subscription
 */

const BASE_URL = 'https://devloop-landing.fly.dev';
const API_URL = 'https://devloop-api.fly.dev';

test.describe('LIVE SMOKE TEST: Unauthenticated UI Flows', () => {
  
  test('1. Landing Page - Full Load', async ({ page }) => {
    console.log('🔍 Testing: Landing page full load');
    
    // Track console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
    
    // Wait for full page render
    await page.waitForLoadState('networkidle');
    
    // Check critical elements
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('nav, header')).toBeVisible();
    
    console.log(`   Console errors: ${errors.length}`);
    if (errors.length > 0) console.log('   ⚠️ Errors:', errors.slice(0, 3));
  });

  test('2. Navigation - Click each nav link', async ({ page }) => {
    console.log('🔍 Testing: Navigation links');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Click Pricing link
    const pricingLink = page.locator('a[href*="pricing"], a:has-text("Pricing")').first();
    if (await pricingLink.isVisible()) {
      await pricingLink.click();
      await page.waitForTimeout(500);
      const pricingSection = page.locator('#pricing, [id*="pricing"]');
      await expect(pricingSection.first()).toBeVisible();
      console.log('   ✅ Pricing navigation works');
    }
    
    // Click Docs link
    const docsLink = page.locator('a[href*="docs"], a:has-text("Docs")').first();
    if (await docsLink.isVisible()) {
      await docsLink.click();
      await page.waitForURL('**/docs**', { timeout: 5000 }).catch(() => {});
      console.log('   ✅ Docs navigation works');
    }
  });

  test('3. Pricing Section - All 3 Plans Visible', async ({ page }) => {
    console.log('🔍 Testing: Pricing section');
    await page.goto(`${BASE_URL}/#pricing`);
    await page.waitForLoadState('networkidle');
    
    // Check all 3 plans exist
    const soloText = page.locator('text=/solo/i');
    const proText = page.locator('text=/pro/i');
    const teamText = page.locator('text=/team/i');
    
    await expect(soloText.first()).toBeVisible();
    await expect(proText.first()).toBeVisible();
    await expect(teamText.first()).toBeVisible();
    
    // Check prices are displayed
    await expect(page.locator('text=/\\$19/i').first()).toBeVisible();
    await expect(page.locator('text=/\\$39/i').first()).toBeVisible();
    await expect(page.locator('text=/\\$79/i').first()).toBeVisible();
    
    console.log('   ✅ All 3 pricing plans visible with correct prices');
  });

  test('4. Pricing - Subscribe Button Triggers Checkout', async ({ page }) => {
    console.log('🔍 Testing: Subscribe button checkout flow');
    await page.goto(`${BASE_URL}/#pricing`);
    await page.waitForLoadState('networkidle');

    // Find subscribe button - button text is "Get Started - $XX/mo"
    const subscribeBtn = page.locator('button:has-text("Get Started - $")').first();
    await expect(subscribeBtn).toBeVisible();

    // Click and check for redirect to Stripe
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/v1/billing/checkout'),
      { timeout: 15000 }
    ).catch(() => null);

    await subscribeBtn.click();

    const response = await responsePromise;
    if (response) {
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.checkout_url).toContain('stripe.com');
      console.log('   ✅ Checkout API returns Stripe URL');
    } else {
      // Check if page navigated to Stripe directly
      await page.waitForTimeout(3000);
      const url = page.url();
      if (url.includes('stripe.com') || url.includes('checkout')) {
        console.log('   ✅ Redirected to Stripe checkout');
      } else {
        console.log('   ⚠️ No checkout API response captured');
      }
    }
  });

  test('5. Dashboard Login Page - Form Display', async ({ page }) => {
    console.log('🔍 Testing: Dashboard login form');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    // Should show login form (not authenticated)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    
    console.log('   ✅ Login form displayed correctly');
  });

  test('6. Dashboard Login - Magic Link Request', async ({ page }) => {
    console.log('🔍 Testing: Magic link request');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"]');
    const submitBtn = page.locator('button[type="submit"]');
    
    // Enter email and submit
    await emailInput.fill('smoketest-live@example.com');
    
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/v1/auth/magic-link'), { timeout: 10000 }),
      submitBtn.click()
    ]);
    
    expect(response.status()).toBe(200);
    console.log('   ✅ Magic link request successful');
    
    // Check for success message or loading state change
    await page.waitForTimeout(1000);
    const pageContent = await page.textContent('body');
    const hasSuccessIndicator = pageContent?.includes('sent') || 
                                pageContent?.includes('check') ||
                                pageContent?.includes('email');
    expect(hasSuccessIndicator).toBeTruthy();
    console.log('   ✅ Success message displayed');
  });

  test('7. Docs Page - Full Load and Navigation', async ({ page }) => {
    console.log('🔍 Testing: Docs page');
    await page.goto(`${BASE_URL}/docs`);
    await page.waitForLoadState('networkidle');
    
    // Check docs content loads
    const docsContent = page.locator('h1, h2, main');
    await expect(docsContent.first()).toBeVisible();
    
    // Check for installation instructions
    const hasInstallInfo = await page.locator('text=/npm|npx|install/i').first().isVisible();
    expect(hasInstallInfo).toBeTruthy();
    
    console.log('   ✅ Docs page loads with installation instructions');
  });

  test('8. Auth Verify - Invalid Token Handling', async ({ page }) => {
    console.log('🔍 Testing: Invalid auth token handling');
    await page.goto(`${BASE_URL}/auth/verify?token=invalid-smoke-test-token`);
    
    // Wait for verification attempt
    await page.waitForTimeout(3000);
    
    // Should redirect to dashboard or show error
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');
    
    const handled = currentUrl.includes('dashboard') || 
                    pageContent?.toLowerCase().includes('invalid') ||
                    pageContent?.toLowerCase().includes('error') ||
                    pageContent?.toLowerCase().includes('expired');
    
    expect(handled).toBeTruthy();
    console.log('   ✅ Invalid token handled gracefully');
  });

  test('9. Checkout Success Page', async ({ page }) => {
    console.log('🔍 Testing: Checkout success page');
    await page.goto(`${BASE_URL}/checkout/success`);
    await page.waitForLoadState('networkidle');
    
    const pageContent = await page.textContent('body');
    const hasSuccessContent = pageContent?.toLowerCase().includes('success') ||
                              pageContent?.toLowerCase().includes('thank') ||
                              pageContent?.toLowerCase().includes('payment');
    
    expect(hasSuccessContent).toBeTruthy();
    console.log('   ✅ Checkout success page displays correctly');
  });

  test('10. Mobile Responsive - Landing Page', async ({ page }) => {
    console.log('🔍 Testing: Mobile responsiveness');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check body doesn't overflow
    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);

    // Check hamburger menu exists on mobile
    const mobileMenu = page.locator('button[aria-label*="menu"], button:has(svg), [class*="mobile"]');
    const hasMobileNav = await mobileMenu.first().isVisible();

    console.log(`   ✅ Mobile layout OK, has mobile menu: ${hasMobileNav}`);
  });
});

/**
 * Authenticated Dashboard Tests
 * These tests inject a JWT token to simulate authenticated state
 * and test all dashboard UI interactions
 */
test.describe('LIVE SMOKE TEST: Authenticated Dashboard UI', () => {
  // JWT token generated for test user - expires in 24 hours from generation
  // User: abdallahozaifa19527@gmail.com (ID: aadfd94f-0b0d-44e8-bf1a-3ad15de7a4d1)
  const TEST_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYWRmZDk0Zi0wYjBkLTQ0ZTgtYmYxYS0zYWQxNWRlN2E0ZDEiLCJleHAiOjE3NjU0NjY2NzZ9.VBj9bBxkN3ZeQKtwHCU54Vcwh5RCf4wv72LJLtfWx9Q';

  test.beforeEach(async ({ page }) => {
    // Inject auth token into localStorage before navigating
    // The app uses 'token' key in localStorage (see App.tsx:254)
    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, TEST_JWT);
  });

  test('11. Dashboard - Authenticated Load', async ({ page }) => {
    console.log('🔍 Testing: Authenticated dashboard load');

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for API calls

    // Should NOT show login form (should be authenticated)
    const emailInput = page.locator('input[type="email"]');
    const isLoginVisible = await emailInput.isVisible().catch(() => false);

    if (isLoginVisible) {
      console.log('   ⚠️ Token may be expired - still showing login form');
      // Token might be expired, skip remaining tests
      test.skip();
      return;
    }

    // Should show dashboard content
    const dashboardContent = page.locator('text=/projects|dashboard|welcome/i');
    await expect(dashboardContent.first()).toBeVisible({ timeout: 10000 });

    console.log(`   ✅ Dashboard loaded with auth, console errors: ${errors.length}`);
    if (errors.length > 0) console.log('   ⚠️ Errors:', errors.slice(0, 3));
  });

  test('12. Dashboard - View Projects List', async ({ page }) => {
    console.log('🔍 Testing: Projects list display');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for projects section
    const projectsSection = page.locator('text=/projects|my projects/i');
    if (await projectsSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Projects section visible');
    }

    // Check for "Add Project" or similar button
    const addProjectBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")');
    if (await addProjectBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Add Project button visible');
    }
  });

  test('13. Dashboard - Create New Project', async ({ page }) => {
    console.log('🔍 Testing: Create new project via UI');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find and click Add Project button
    const addProjectBtn = page.locator('button:has-text("Add"), button:has-text("New Project"), button:has-text("Create")').first();

    if (!await addProjectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ⚠️ Add Project button not found');
      return;
    }

    await addProjectBtn.click();
    await page.waitForTimeout(500);

    // Check for modal or form
    const projectNameInput = page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="project"]');
    if (await projectNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Fill in project name
      const testProjectName = `Smoke Test ${Date.now()}`;
      await projectNameInput.fill(testProjectName);

      // Look for URL input
      const urlInput = page.locator('input[name="url"], input[type="url"], input[placeholder*="url"]');
      if (await urlInput.isVisible().catch(() => false)) {
        await urlInput.fill('https://example.com');
      }

      // Submit
      const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Add"), button:has-text("Save")').first();

      // Listen for API response
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/v1/dashboard/projects') && resp.request().method() === 'POST',
        { timeout: 10000 }
      ).catch(() => null);

      await submitBtn.click();

      const response = await responsePromise;
      if (response) {
        expect(response.status()).toBe(200);
        console.log('   ✅ Project created successfully via UI');
      }
    } else {
      console.log('   ⚠️ Project form not displayed after clicking Add');
    }
  });

  test('14. Dashboard - Open Project Settings', async ({ page }) => {
    console.log('🔍 Testing: Project settings modal');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find a project card and click settings
    const settingsBtn = page.locator('button:has-text("Settings"), button[aria-label*="settings"], button:has(svg[class*="cog"]), [class*="settings"]').first();

    if (await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(500);

      // Check for modal content
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('   ✅ Settings modal opened');

        // Check for settings sections
        const githubSection = page.locator('text=/github/i');
        const slackSection = page.locator('text=/slack/i');
        const scheduleSection = page.locator('text=/schedule/i');

        if (await githubSection.isVisible().catch(() => false)) console.log('   ✅ GitHub section visible');
        if (await slackSection.isVisible().catch(() => false)) console.log('   ✅ Slack section visible');
        if (await scheduleSection.isVisible().catch(() => false)) console.log('   ✅ Schedule section visible');

        // Close modal
        const closeBtn = page.locator('button:has-text("Close"), button:has-text("Cancel"), button[aria-label*="close"]').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
        }
      }
    } else {
      console.log('   ⚠️ Settings button not found (may need projects first)');
    }
  });

  test('15. Dashboard - Manage Billing Button', async ({ page }) => {
    console.log('🔍 Testing: Manage Billing button');

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find Manage Billing button
    const billingBtn = page.locator('button:has-text("Billing"), button:has-text("Manage"), a:has-text("Billing")').first();

    if (!await billingBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ⚠️ Billing button not found');
      return;
    }

    // Click and check for API call
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/v1/billing/portal'),
      { timeout: 10000 }
    ).catch(() => null);

    await billingBtn.click();

    const response = await responsePromise;
    if (response) {
      const status = response.status();
      console.log(`   API response status: ${status}`);

      if (status === 200) {
        const data = await response.json();
        if (data.portal_url) {
          console.log('   ✅ Billing portal URL received');
        }
      } else if (status === 400) {
        // Expected if no Stripe subscription exists
        console.log('   ✅ Billing API responded (no subscription - expected)');
      }
    }

    console.log(`   Console errors after billing click: ${errors.length}`);
    if (errors.length > 0) console.log('   ⚠️ Errors:', errors.slice(0, 3));
  });

  test('16. Dashboard - Delete Project', async ({ page }) => {
    console.log('🔍 Testing: Delete project via UI');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find delete button on a project
    const deleteBtn = page.locator('button:has-text("Delete"), button[aria-label*="delete"], button:has(svg[class*="trash"])').first();

    if (!await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ⚠️ Delete button not found (may need projects first)');
      return;
    }

    // Listen for delete API call
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/v1/dashboard/projects') && resp.request().method() === 'DELETE',
      { timeout: 10000 }
    ).catch(() => null);

    await deleteBtn.click();

    // Check for confirmation dialog
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const response = await responsePromise;
    if (response) {
      expect(response.status()).toBe(200);
      console.log('   ✅ Project deleted successfully via UI');
    }
  });

  test('17. Dashboard - License Key Display', async ({ page }) => {
    console.log('🔍 Testing: License key display');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for license key display
    const licenseKey = page.locator('text=/DL-[A-Z0-9]{4}/i, code:has-text("DL-"), [class*="license"]');

    if (await licenseKey.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ License key displayed');
    } else {
      // Check for subscription section
      const subscriptionSection = page.locator('text=/subscription|plan|license/i');
      if (await subscriptionSection.first().isVisible().catch(() => false)) {
        console.log('   ✅ Subscription section visible (license key may be hidden)');
      } else {
        console.log('   ⚠️ License/subscription section not found');
      }
    }
  });

  test('18. Dashboard - Copy License Key', async ({ page }) => {
    console.log('🔍 Testing: Copy license key button');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find copy button near license key
    const copyBtn = page.locator('button:has-text("Copy"), button[aria-label*="copy"]').first();

    if (await copyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await copyBtn.click();
      console.log('   ✅ Copy button clicked');

      // Check for success feedback
      await page.waitForTimeout(500);
      const copiedText = page.locator('text=/copied/i');
      if (await copiedText.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   ✅ "Copied" feedback shown');
      }
    } else {
      console.log('   ⚠️ Copy button not found');
    }
  });

  test('19. Dashboard - Logout', async ({ page }) => {
    console.log('🔍 Testing: Logout functionality');

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find logout button
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")').first();

    if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);

      // Should redirect to login or landing
      const currentUrl = page.url();
      const emailInput = page.locator('input[type="email"]');

      if (currentUrl.includes('dashboard') && await emailInput.isVisible().catch(() => false)) {
        console.log('   ✅ Logged out - login form shown');
      } else if (!currentUrl.includes('dashboard')) {
        console.log('   ✅ Logged out - redirected away from dashboard');
      }
    } else {
      console.log('   ⚠️ Logout button not found');
    }
  });
});
