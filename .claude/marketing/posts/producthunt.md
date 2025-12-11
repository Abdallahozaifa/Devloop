# Product Hunt Submission

**URL**: https://www.producthunt.com/posts/new

---

## TAGLINE (60 chars max)
```
AI-powered QA automation for indie hackers
```

## SHORT DESCRIPTION (260 chars)
```
Stop shipping bugs to production. DevLoop tests your APIs, captures UI screenshots, uses AI to detect broken layouts, and alerts you on Slack. One command setup: npx create-devloop. Built for solo devs. $19/mo.
```

---

## FULL DESCRIPTION

### What is DevLoop?

DevLoop automates your entire QA workflow with one command.

**The Problem**: Manual testing is boring. We skip it. Users find bugs first.

**The Solution**: Automated testing that actually works for small projects.

### Features

**API Smoke Testing**
- Tests every endpoint automatically
- Validates response codes and schemas
- Measures response times
- Catches breaking changes before users do

**UI Screenshot Testing**
- Captures at 3 viewports (desktop, tablet, mobile)
- AI vision analysis detects broken layouts
- Visual regression detection
- No Selenium configuration required

**Production Monitoring**
- Continuous health checks
- Response time tracking
- Instant Slack alerts when down
- Know before your users do

**CI/CD Integration**
- GitHub Actions workflow included
- Runs on every push/PR
- Blocks broken code from shipping

### Setup

```bash
npx create-devloop
./scripts/qa.sh all
```

That's it. 2 minutes and you're done.

### Pricing

- **Solo**: $19/mo (1 project)
- **Pro**: $39/mo (5 projects)
- **Team**: $79/mo (unlimited)

Less than your daily coffee.

---

## FIRST MAKER COMMENT (post immediately)

```
Hey Product Hunt!

I'm excited to launch DevLoop today.

**Why I built this**: I kept shipping bugs to production because manual testing is boring. After the third "your checkout is broken" message from a user, I automated my QA.

I looked at existing tools:
- Selenium = too complex
- Cypress = expensive at scale
- Enterprise tools = $500+/mo

There was nothing simple + affordable for indie hackers. So I made it.

**What makes it different:**
- One command: `npx create-devloop`
- Works with any stack (Next.js, FastAPI, Rails, whatever)
- AI-powered visual analysis
- Actually affordable ($19/mo)

I'd love your feedback:
1. What features would make this a must-have?
2. What's missing from your current testing workflow?

Happy to answer any questions!
```

---

## SCREENSHOTS (4 required)

1. **Terminal Setup** - `npx create-devloop` output showing setup
2. **Test Results** - API and UI test results with pass/fail
3. **Dashboard** - Project settings with production testing config
4. **Slack Alert** - Notification showing test failure

---

## TOPICS
- Developer Tools
- Productivity
- Testing
- Artificial Intelligence
- SaaS

---

## LAUNCH TIMING
- **Best days**: Tuesday, Wednesday, Thursday
- **Best time**: 12:01 AM PT (full voting day)
