#!/usr/bin/env node
const { chromium } = require('playwright');

const TITLE = 'Show HN: DevLoop – Automated QA for solo developers (API tests + AI screenshots)';
const URL = 'https://devloop-landing.fly.dev';
const TEXT = `Hey HN!

I built DevLoop because I was tired of shipping bugs to production.

**The problem**: Manual testing is tedious. I'd skip it, ship fast, and then get bug reports from users.

**The solution**: Automated QA that runs with one command.

    npx create-devloop
    ./scripts/qa.sh all

**What it does:**

1. API Smoke Tests - Hits every endpoint, validates responses
2. UI Screenshots - Captures at 3 viewports (1920px, 768px, 375px)
3. AI Vision Analysis - Uses vision models to detect broken layouts
4. Production Monitoring - Continuous health checks with Slack alerts
5. GitHub Actions - Runs on every PR, blocks broken code

**Tech details:**

- CLI is vanilla Node.js (no build step)
- Backend is FastAPI + PostgreSQL
- Screenshots via headless Chrome
- AI analysis via Claude API
- Deployed on Fly.io

**What it's NOT:**

- Not a Selenium replacement (no browser automation scripts)
- Not for E2E test recording (yet)
- Not enterprise-grade (intentionally simple)

**Pricing**: $19/mo for solo devs, $39/mo for 5 projects

npm: https://www.npmjs.com/package/create-devloop

I'd love feedback on:
1. Is "simple automated testing" useful, or do people need full E2E?
2. Any architectural improvements?
3. Pricing thoughts?

Happy to discuss implementation details.`;

async function main() {
  console.log('🚀 Opening HN Submit page...');
  console.log('');
  console.log('This script will:');
  console.log('1. Open browser and wait for you to log in');
  console.log('2. Once on the submit form, fill title + URL');
  console.log('3. Click submit');
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to submit page
  await page.goto('https://news.ycombinator.com/submit');

  console.log('⏳ Waiting for submit form (log in if needed)...');

  // Wait indefinitely for the title input to appear (user logs in)
  await page.waitForSelector('input[name="title"]', { timeout: 300000 });

  console.log('✅ Submit form found! Filling...');

  // Fill title
  await page.fill('input[name="title"]', TITLE);
  console.log('✅ Title filled');

  // Fill URL
  await page.fill('input[name="url"]', URL);
  console.log('✅ URL filled');

  // Fill text field
  const textField = await page.$('textarea[name="text"]');
  if (textField) {
    await page.fill('textarea[name="text"]', TEXT);
    console.log('✅ Text filled');
  } else {
    console.log('ℹ️ No text field found (URL-only submission)');
  }

  // Click submit
  console.log('⏳ Submitting...');
  await page.click('input[type="submit"]');

  console.log('✅ Submitted! Waiting for confirmation...');

  // Wait a bit to see the result
  await page.waitForTimeout(5000);

  // Check if we're on a new page (item page)
  const currentUrl = page.url();
  if (currentUrl.includes('item?id=')) {
    console.log('');
    console.log('🎉 SUCCESS! Your post is live at:');
    console.log(currentUrl);
    console.log('');
    console.log('📝 Now post your first comment!');
  } else {
    console.log('');
    console.log('⚠️ Check the browser - you may need to verify something');
  }

  // Keep browser open for user to add comment
  console.log('Browser will stay open. Press Ctrl+C when done.');
  await new Promise(() => {});
}

main().catch(console.error);
