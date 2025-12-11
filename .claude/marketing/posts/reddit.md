# Reddit Posts

---

# r/SaaS

**URL**: https://www.reddit.com/r/SaaS/submit?type=TEXT

**Karma Required**: ~10 comment karma recommended

**Best Time**: Monday-Friday, 10am-2pm EST

## TITLE
```
I built an AI QA tool for solo SaaS founders - $19/mo instead of enterprise pricing
```

## BODY
```
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

**Questions:**

1. Do you test before deploying? What would make you start?
2. What features would make this a must-have?
3. Is $19/mo reasonable for solo founders?

Happy to answer questions!
```

---

# r/webdev

**URL**: https://www.reddit.com/r/webdev/submit?type=TEXT

**Karma Required**: Usually none, but account age matters

**Best Time**: Weekday mornings EST

## TITLE
```
I made an automated testing tool that actually works for small projects
```

## BODY
```
Built a QA tool because every existing solution was either too complex or too expensive.

**The Problem:**

- Selenium = config hell
- Cypress = great but expensive at scale
- Enterprise tools = $500+/mo and overkill

I just wanted something that tests my stuff without writing test scripts.

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

**Works with any stack** - Next.js, Rails, Django, FastAPI, Express.

**Pricing:** $19/mo solo, $39/mo for 5 projects

**Link:** https://devloop-landing.fly.dev

Looking for feedback:

- Is "zero-config testing" useful, or do you prefer writing your own tests?
- What's missing from your current testing workflow?
```

---

# r/SideProject

**URL**: https://www.reddit.com/r/SideProject/submit?type=TEXT

**Karma Required**: Minimal

**Best Time**: Weekends work well here

## TITLE
```
[Launch] DevLoop - Automated QA for side projects
```

## BODY
```
Hey everyone!

Just launched my side project: DevLoop - automated QA for developers.

**What it does:**

Run `npx create-devloop` in your project, and you get:
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

Would love any feedback on the landing page or the concept!
```

---

## POSTING SCHEDULE

| Day | Subreddit | Time |
|-----|-----------|------|
| Monday | r/SaaS | 10am EST |
| Wednesday | r/webdev | 11am EST |
| Saturday | r/SideProject | 10am EST |

**Important**: Don't post to multiple subreddits on the same day. Reddit may flag as spam.
