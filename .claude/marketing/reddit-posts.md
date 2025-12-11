# Reddit Posts

## Posting Guidelines
- Don't post to multiple subreddits on the same day
- Space posts 2-3 days apart
- Be genuine, not salesy
- Reply to every comment
- Don't use link posts (use text posts with link in body)

---

# r/SaaS Post

## Title
I built an AI QA tool for solo SaaS founders - $19/mo instead of $500/mo enterprise tools

## Body

Hey r/SaaS,

I kept shipping bugs to production because manual testing is boring. So I built DevLoop.

**What it does:**

- One command setup: `npx create-devloop`
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

**Questions for you:**

1. Do you currently test before deploying? If not, what would make you start?
2. What features would make this a must-have?
3. Is $19/mo reasonable for solo founders?

Happy to answer any questions!

---

# r/webdev Post

## Title
I made an automated testing tool that actually works for small projects

## Body

Built a QA tool because every existing solution was either way too complex or way too expensive.

**The Problem:**

- Selenium = config hell
- Cypress = great but expensive at scale
- Enterprise tools = $500+/mo and overkill

I just wanted something that tests my stuff without me writing test scripts.

**What DevLoop Does:**

```bash
npx create-devloop
./scripts/qa.sh all
```

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

**Works with any stack** - Next.js, Rails, Django, FastAPI, Express, whatever.

**Pricing:** $19/mo solo, $39/mo for 5 projects

**Link:** https://devloop-landing.fly.dev

Looking for feedback:

- Is "zero-config testing" actually useful, or do you prefer writing your own tests?
- What's missing from your current testing workflow?
- Any UX improvements for the landing page?

---

# r/indiehackers Post

## Title
How I automated QA for my side projects with one command (and why I turned it into a product)

## Body

Fellow indie hackers,

Confession: I almost never tested my apps before deploying. Too boring, too slow, always something more interesting to build.

The result? Constant "your app is broken" messages.

So I built DevLoop.

**The Setup:**

```bash
npx create-devloop
```

That's it. Creates QA scripts in your project. Now run:

```bash
./scripts/qa.sh all
```

**What happens:**

1. **API Tests** - Hits every endpoint, checks responses
2. **UI Screenshots** - Captures at 3 screen sizes
3. **AI Analysis** - Vision model checks for broken layouts
4. **Health Monitoring** - Pings production every 5 min
5. **Slack Alerts** - Know instantly when something breaks

**Why I'm charging for it:**

- Solo: $19/mo
- Pro: $39/mo (5 projects)

I considered free tier but wanted to build something sustainable. Less than a coffee a day to stop shipping bugs.

**Revenue so far:** $0 (just launched)

**The ask:**

1. Would you pay for automated QA? Or only use if free?
2. What would make this a must-have for your projects?
3. Honest feedback on the landing page?

**Link:** https://devloop-landing.fly.dev

**npm:** `npx create-devloop`

Thanks for reading. Happy to share more about the build process if anyone's interested.

---

# r/programming Post (more technical angle)

## Title
Show r/programming: I built an AI-powered smoke testing tool (CLI + dashboard)

## Body

I built DevLoop, a CLI tool for automated smoke testing.

**Problem:** I wanted automated testing without writing test code or complex configs.

**Solution:**

```bash
npx create-devloop
./scripts/qa.sh all
```

**What it does:**

- **API Testing**: Discovers endpoints, sends requests, validates responses
- **Screenshot Testing**: Headless Chrome captures at multiple viewports
- **AI Analysis**: Vision model (Claude) analyzes screenshots for layout issues
- **Monitoring**: Continuous health checks with alerting

**Technical Details:**

- CLI is vanilla Node.js (no build step, no dependencies)
- Backend: FastAPI + asyncpg + PostgreSQL
- Frontend: React + TailwindCSS + Vite
- Auth: Magic links (no passwords)
- Hosting: Fly.io (API + DB + frontend)

**What it's NOT:**

- Not E2E testing (no user flow scripts)
- Not a Selenium/Playwright replacement
- Not for unit testing

It's smoke testing - quick validation that things aren't obviously broken.

**Link:** https://devloop-landing.fly.dev

**npm:** https://www.npmjs.com/package/create-devloop

Questions:
1. Is there demand for "simple smoke testing" or do devs prefer full E2E frameworks?
2. Any architectural suggestions?
3. Would you use something like this?

---

## Posting Schedule

| Day | Subreddit | Time (EST) |
|-----|-----------|------------|
| Mon | r/SaaS | 10am |
| Wed | r/webdev | 11am |
| Fri | r/indiehackers | 10am |
| Next Mon | r/programming | 11am |
