#!/usr/bin/env node
/**
 * DevLoop Marketing Post Automation
 *
 * This script opens browsers and fills in forms for each platform.
 * You need to be logged in already or handle authentication manually.
 *
 * Usage:
 *   npm install playwright
 *   node post-to-platforms.js [platform]
 *
 * Platforms: hackernews, reddit-saas, reddit-webdev, reddit-sideproject, twitter, indiehackers
 * Run without args to post to all platforms sequentially
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Post content
const POSTS = {
  hackernews: {
    url: 'https://news.ycombinator.com/submit',
    title: 'Show HN: DevLoop – Automated QA for solo developers (API tests + AI screenshots)',
    link: 'https://devloop-landing.fly.dev',
    firstComment: `Hey HN!

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

Happy to discuss implementation details.`
  },

  'reddit-saas': {
    url: 'https://www.reddit.com/r/SaaS/submit?type=TEXT',
    title: 'I built an AI QA tool for solo SaaS founders - $19/mo instead of enterprise pricing',
    body: `Hey r/SaaS,

I kept shipping bugs to production because manual testing is boring. So I built DevLoop.

**What it does:**

- One command setup: \`npx create-devloop\`
- Tests all your API endpoints automatically
- Screenshots your UI at 3 viewports
- AI detects broken layouts
- Monitors production health
- Sends Slack alerts when something breaks

**Why I built it:**

Every QA tool I found was either:
- Way too complex (Selenium configs for days)
- Way too expensive ($500+/mo for enterprise)
- Built for teams of 50+, not solo founders

I wanted something that takes 2 minutes to set up and just works.

**Pricing:**

- Solo: $19/mo (1 project)
- Pro: $39/mo (5 projects)
- Team: $79/mo (unlimited)

**Link:** https://devloop-landing.fly.dev

**Questions:**

1. Do you test before deploying? What would make you start?
2. What features would make this a must-have?
3. Is $19/mo reasonable for solo founders?

Happy to answer questions!`
  },

  'reddit-webdev': {
    url: 'https://www.reddit.com/r/webdev/submit?type=TEXT',
    title: 'I made an automated testing tool that actually works for small projects',
    body: `Built a QA tool because every existing solution was either too complex or too expensive.

**The Problem:**

- Selenium = config hell
- Cypress = great but expensive at scale
- Enterprise tools = $500+/mo and overkill

I just wanted something that tests my stuff without writing test scripts.

**What DevLoop Does:**

\`\`\`bash
npx create-devloop
./scripts/qa.sh all
\`\`\`

That's the entire setup. It:

1. Discovers your API endpoints and tests them
2. Captures screenshots at desktop/tablet/mobile
3. Uses AI to detect broken layouts
4. Monitors production health
5. Sends Slack alerts on failures

**Tech Stack:**

- CLI: Node.js
- Backend: FastAPI + PostgreSQL
- Screenshots: Headless Chrome
- AI: Claude for vision analysis

**Works with any stack** - Next.js, Rails, Django, FastAPI, Express.

**Pricing:** $19/mo solo, $39/mo for 5 projects

**Link:** https://devloop-landing.fly.dev

Looking for feedback:

- Is "zero-config testing" useful, or do you prefer writing your own tests?
- What's missing from your current testing workflow?`
  },

  'reddit-sideproject': {
    url: 'https://www.reddit.com/r/SideProject/submit?type=TEXT',
    title: '[Launch] DevLoop - Automated QA for side projects',
    body: `Hey everyone!

Just launched my side project: DevLoop - automated QA for developers.

**What it does:**

Run \`npx create-devloop\` in your project, and you get:
- Automated API testing (hits all endpoints)
- UI screenshots at multiple viewports
- AI-powered layout analysis
- Production health monitoring
- Slack alerts when things break

**Why I built it:**

I have a few side projects and I never tested them properly. Users would find bugs before I did. This automates the boring parts of QA.

**Tech stack:**
- Backend: FastAPI + PostgreSQL
- Frontend: React + Tailwind
- Hosted: Fly.io
- Payments: Stripe

**Pricing:** $19/mo for 1 project

**Link:** https://devloop-landing.fly.dev

Would love any feedback on the landing page or the concept!`
  },

  twitter: {
    url: 'https://twitter.com/compose/tweet',
    tweets: [
      `I just launched DevLoop - AI-powered QA for indie hackers.

No more shipping bugs to production.

Here's what it does and why I built it:

https://devloop-landing.fly.dev

🧵`,
      `The problem:

Manual testing is boring. We all skip it.

Then users find the bugs we missed.

I got tired of "hey your checkout is broken" DMs.`,
      `So I built DevLoop.

One command to set up automated QA:

npx create-devloop

That's it. 2 minutes and you're done.`,
      `What it tests:

API Smoke Tests:
• Hits every endpoint
• Checks status codes
• Validates responses
• Measures timing`,
      `UI Screenshot Testing:
• Captures at 3 viewports (desktop, tablet, mobile)
• AI vision detects broken layouts
• Visual regression detection
• No Selenium required`,
      `Production Monitoring:
• Health checks every 5 min
• Response time tracking
• Instant Slack alerts when down
• Know before your users do`,
      `CI/CD Integration:
• GitHub Actions workflow included
• Runs on every push and PR
• Blocks broken code from merging
• Zero config required`,
      `Pricing (indie hacker friendly):

Solo: $19/mo (1 project)
Pro: $39/mo (5 projects)
Team: $79/mo (unlimited)

Less than your daily coffee.`,
      `Built for developers who:

• Ship fast
• Work solo or small teams
• Can't afford $500/mo enterprise tools
• Want to sleep better at night`,
      `Try it now:

npx create-devloop

https://devloop-landing.fly.dev

What features would make this a must-have for you?`
    ]
  },

  indiehackers: {
    url: 'https://www.indiehackers.com/group/product-launches',
    title: 'I built an AI QA tool because I kept shipping bugs to production - $19/mo',
    body: `Hey IH!

I've been building DevLoop and just launched it. Would love your feedback.

### The Problem I Was Solving

I run a few side projects, and I have a confession: I almost never tested before deploying.

Manual testing is:
1. Boring
2. Time-consuming
3. Easy to skip when you're excited to ship

The result? I kept getting DMs like "hey, the checkout is broken" or "the dashboard won't load on mobile."

### What DevLoop Does

Automated QA for indie hackers. One command to set up:

\`\`\`
npx create-devloop
\`\`\`

Then it:
- **Tests all your API endpoints** - hits every route, checks responses
- **Screenshots your UI** at desktop, tablet, and mobile sizes
- **Uses AI to spot broken layouts** - no more "it looked fine on my machine"
- **Monitors production** - health checks every 5 minutes
- **Sends Slack alerts** when something breaks

### The Stack

- Backend: FastAPI (Python)
- Frontend: React
- Hosted on: Fly.io
- Auth: Magic links
- Payments: Stripe

### Pricing

- Solo: $19/mo (1 project)
- Pro: $39/mo (5 projects)
- Team: $79/mo (unlimited)

Less than a coffee a day.

### What I'm Looking For

1. **Would you pay for automated QA?** Or only use if free?

2. **What features are missing?** Thinking about:
   - End-to-end test recording
   - Performance benchmarks
   - Database backup verification

3. **Feedback on the landing page?**

### Link

https://devloop-landing.fly.dev

npm: \`npx create-devloop\`

### Stats (keeping it real)

- Just launched
- 0 paying customers yet
- This is day 1

Thanks for reading! Happy to answer questions.`
  }
};

async function postToHackerNews(browser) {
  console.log('\n📰 Opening Hacker News...');
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(POSTS.hackernews.url);

  // Fill in the form
  await page.fill('input[name="title"]', POSTS.hackernews.title);
  await page.fill('input[name="url"]', POSTS.hackernews.link);

  console.log('✅ HN form filled. Review and click Submit manually.');
  console.log('📝 After submitting, post this as your first comment:');
  console.log('---');
  console.log(POSTS.hackernews.firstComment.substring(0, 200) + '...');
  console.log('---');

  // Wait for user to submit
  await page.waitForTimeout(60000); // Wait 60 seconds
  return context;
}

async function postToReddit(browser, subreddit) {
  const post = POSTS[`reddit-${subreddit}`];
  console.log(`\n🔴 Opening Reddit r/${subreddit}...`);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(post.url);
  await page.waitForTimeout(3000);

  // Try to fill the title
  try {
    // New Reddit UI
    const titleInput = await page.$('textarea[placeholder*="Title"], input[placeholder*="Title"], [data-testid="post-title"]');
    if (titleInput) {
      await titleInput.fill(post.title);
    }

    // Try to find body textarea
    const bodyInput = await page.$('textarea[placeholder*="Text"], div[contenteditable="true"], [data-testid="post-body"]');
    if (bodyInput) {
      await bodyInput.fill(post.body);
    }
  } catch (e) {
    console.log('Could not auto-fill Reddit form. Please fill manually.');
  }

  console.log(`✅ Reddit r/${subreddit} opened.`);
  console.log('📋 Title:', post.title);
  console.log('Review and click Post manually.');

  await page.waitForTimeout(60000);
  return context;
}

async function postToTwitter(browser) {
  console.log('\n🐦 Opening Twitter...');
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(POSTS.twitter.url);
  await page.waitForTimeout(3000);

  console.log('✅ Twitter opened.');
  console.log('\n📝 Tweet thread to post (copy each one):');
  console.log('=========================================');

  POSTS.twitter.tweets.forEach((tweet, i) => {
    console.log(`\n--- Tweet ${i + 1} ---`);
    console.log(tweet);
  });

  console.log('\n=========================================');
  console.log('Post each tweet, then reply to create the thread.');

  await page.waitForTimeout(120000); // 2 minutes for thread
  return context;
}

async function postToIndieHackers(browser) {
  console.log('\n🚀 Opening Indie Hackers...');
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(POSTS.indiehackers.url);
  await page.waitForTimeout(3000);

  console.log('✅ Indie Hackers opened.');
  console.log('📋 Title:', POSTS.indiehackers.title);
  console.log('\n📝 Body to paste:');
  console.log('=========================================');
  console.log(POSTS.indiehackers.body);
  console.log('=========================================');

  await page.waitForTimeout(60000);
  return context;
}

async function main() {
  const platform = process.argv[2];

  console.log('🚀 DevLoop Marketing Post Automation');
  console.log('====================================');
  console.log('This will open browsers for each platform.');
  console.log('Make sure you are logged into each site!');
  console.log('');

  // Launch browser in non-headless mode so user can see and interact
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100 // Slow down for visibility
  });

  const contexts = [];

  try {
    if (!platform || platform === 'hackernews') {
      contexts.push(await postToHackerNews(browser));
    }

    if (!platform || platform === 'reddit-saas') {
      contexts.push(await postToReddit(browser, 'saas'));
    }

    if (!platform || platform === 'reddit-webdev') {
      contexts.push(await postToReddit(browser, 'webdev'));
    }

    if (!platform || platform === 'reddit-sideproject') {
      contexts.push(await postToReddit(browser, 'sideproject'));
    }

    if (!platform || platform === 'twitter') {
      contexts.push(await postToTwitter(browser));
    }

    if (!platform || platform === 'indiehackers') {
      contexts.push(await postToIndieHackers(browser));
    }

    console.log('\n✅ All platforms opened!');
    console.log('Complete posting in each browser window.');
    console.log('Press Ctrl+C when done to close all browsers.');

    // Keep running until user kills
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
