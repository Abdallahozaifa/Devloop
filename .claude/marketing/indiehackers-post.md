# Indie Hackers Post

## Title
I built an AI QA tool because I kept shipping bugs to production - looking for feedback

---

## Post Body (copy below)

Hey IH!

I've been building DevLoop for the past few months and just launched it. Would love your feedback.

### The Problem I Was Trying to Solve

I run a few side projects, and I have a confession: I almost never test before deploying.

Manual testing is:
1. Boring
2. Time-consuming
3. Easy to skip when you're excited to ship

The result? I kept getting DMs like "hey, the checkout is broken" or "the dashboard won't load on mobile."

### What DevLoop Does

It's automated QA for indie hackers. One command to set up:

```
npx create-devloop
```

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
- Auth: Magic links (no passwords)
- Payments: Stripe

### Pricing

- Solo: $19/mo (1 project)
- Pro: $39/mo (5 projects)
- Team: $79/mo (unlimited)

I wanted it cheaper than a coffee a day but still sustainable.

### What I'm Looking For

1. **Would you pay for automated QA?** Or is this something you'd only use if free?

2. **What features are missing?** I'm thinking about adding:
   - End-to-end test recording
   - Performance benchmarks
   - Database backup verification

3. **Feedback on the landing page?** Does it explain the value clearly?

### Link

https://devloop-landing.fly.dev

The npm package is public: `npx create-devloop`

### Revenue/Stats (keeping it real)

- Launched today
- 0 paying customers (yet)
- This is day 1

Thanks for reading! Happy to answer any questions about the tech, business model, or anything else.

---

## Tags
`#launch` `#feedback` `#developer-tools` `#saas`
