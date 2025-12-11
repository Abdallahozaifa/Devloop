# Hacker News Show HN Post

## Title (80 chars max)
Show HN: DevLoop – Automated QA for solo developers (API tests, screenshots, AI)

## URL
https://devloop-landing.fly.dev

---

## First Comment (post immediately after submitting)

Hey HN!

I built DevLoop because I was tired of shipping bugs to production.

**The problem**: Manual testing is tedious. I'd skip it, ship fast, and then get bug reports from users. Classic indie hacker mistake.

**The solution**: Automated QA that runs with one command.

```bash
npx create-devloop
./scripts/qa.sh all
```

**What it does:**

1. **API Smoke Tests** - Hits every endpoint, validates responses, measures timing
2. **UI Screenshots** - Captures at 3 viewports (1920px, 768px, 375px)
3. **AI Vision Analysis** - Uses vision models to detect broken layouts
4. **Production Monitoring** - Continuous health checks with Slack alerts
5. **GitHub Actions** - Runs on every PR, blocks broken code

**Tech details for the curious:**

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

The npm package is public: https://www.npmjs.com/package/create-devloop

I'd love feedback on:
1. The approach - is "simple automated testing" actually useful, or do people need full E2E?
2. Technical architecture - any obvious improvements?
3. Pricing - too high/low for the value?

Happy to dive into implementation details if anyone's interested.

---

## Potential Questions & Answers

**Q: How is this different from Cypress/Playwright?**
A: Those are E2E testing frameworks where you write test scripts. DevLoop is more like automated smoke testing - it discovers your endpoints and pages, then tests them without you writing code. Different use case.

**Q: Why not just use GitHub Actions + curl?**
A: You could! DevLoop just packages the common patterns (API testing, screenshots, AI analysis, notifications) into one tool. Less setup.

**Q: What's the AI actually doing?**
A: It analyzes screenshots looking for: broken layouts, overlapping elements, missing content, responsive issues. Not magic, but catches obvious visual bugs.

**Q: Will this work with my stack?**
A: If your app has HTTP endpoints and a web UI, yes. Stack-agnostic. Tested with Next.js, FastAPI, Rails, Django, Express.

**Q: Is there a free tier?**
A: Not currently. Considering a limited free tier for single projects. What would make you try it?
