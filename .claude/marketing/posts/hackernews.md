# Hacker News Show HN

**URL**: https://news.ycombinator.com/submit

---

## TITLE (80 chars max)
```
Show HN: DevLoop – Automated QA for solo developers (API tests + AI screenshots)
```

## URL TO SUBMIT
```
https://devloop-landing.fly.dev
```

---

## FIRST COMMENT (post immediately after submission)

```
Hey HN!

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

Happy to discuss implementation details.
```

---

## BEST POSTING TIME
- **Day**: Tuesday, Wednesday, or Thursday
- **Time**: 9:00 AM EST / 6:00 AM PST
- **Why**: Peak HN traffic, avoids weekend dead zone

---

## EXPECTED QUESTIONS + ANSWERS

**Q: How is this different from Cypress/Playwright?**
```
Those are E2E testing frameworks where you write test scripts. DevLoop is automated smoke testing - it discovers endpoints and pages, then tests them without writing code. Different use case: quick validation vs comprehensive test suites.
```

**Q: Why not just curl + GitHub Actions?**
```
You could! DevLoop packages common patterns (API testing, screenshots, AI analysis, Slack alerts) into one tool. Less setup, more features out of the box.
```

**Q: What's the AI actually doing?**
```
Analyzes screenshots for: broken layouts, overlapping elements, missing content, responsive issues. Not magic - catches obvious visual bugs that manual review would catch.
```

**Q: Is there a free tier?**
```
Not yet. Considering a limited free tier for single projects. What would make you try it?
```
