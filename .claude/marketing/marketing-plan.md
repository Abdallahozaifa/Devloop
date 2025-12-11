# DevLoop Marketing Plan - 1 Week Test Campaign

## Campaign Overview

| Field | Value |
|-------|-------|
| Campaign Type | 1-WEEK VALIDATION TEST |
| Start Date | December 10, 2024 |
| End Date | December 17, 2024 |
| Total Budget | $100 (STRICT LIMIT) |
| Goal | Validate which paid channels work before scaling |

## Target Audience

- **Primary**: Solo developers, indie hackers, micro-SaaS builders
- **Secondary**: Small dev teams (2-5 people), freelance developers
- **Pain Points**: Manual QA is tedious, CI/CD is complex, bugs slip to production
- **Buying Trigger**: Just launched a project, experienced a production bug, scaling pains

## Budget Breakdown

| Platform | 7-Day Total | Daily Cap | % of Budget |
|----------|-------------|-----------|-------------|
| Twitter/X | $25 | $3.57 | 25% |
| Reddit | $25 | $3.57 | 25% |
| Google Ads | $30 | $4.29 | 30% |
| Facebook/Meta | $20 | $2.86 | 20% |
| **TOTAL** | **$100** | **$14.29** | **100%** |

## KPIs & Success Metrics

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Total Clicks | 50-100 | 150+ |
| Average CPC | $1.00-$2.00 | <$0.75 |
| CTR | 1-2% | >3% |
| Signups | 5-10 | 15+ |
| Cost Per Signup | <$20 | <$10 |
| Paid Conversions | 1-2 | 3+ |

## Decision Framework (Day 7)

After the test, evaluate each channel:

| CPA (Cost Per Acquisition) | Action |
|---------------------------|--------|
| CPA < $10 | SCALE - Increase budget 3-5x |
| CPA $10-20 | OPTIMIZE - Tweak targeting/copy, retest |
| CPA > $20 | CUT - Stop spending on this channel |
| No conversions | CUT - Unless CTR is exceptional (>3%) |

## Messaging Strategy

### Primary Value Props
1. **Speed**: "Ship faster with AI-powered QA"
2. **Automation**: "Find bugs before your users do"
3. **Solo-friendly**: "Enterprise QA for indie hackers"

### Hook Angles to Test
- Pain: "Tired of manual testing?"
- Fear: "Your production app has bugs you don't know about"
- Aspiration: "What if QA ran itself?"
- Social Proof: "Join 100+ indie hackers" (when applicable)

## Tracking Setup

### UTM Parameters
```
utm_source={platform}
utm_medium=paid
utm_campaign=week1_test
utm_content={ad_variant}
```

### Full URLs
- Twitter: `https://devloop-landing.fly.dev?utm_source=twitter&utm_medium=paid&utm_campaign=week1_test`
- Reddit: `https://devloop-landing.fly.dev?utm_source=reddit&utm_medium=paid&utm_campaign=week1_test`
- Google: `https://devloop-landing.fly.dev?utm_source=google&utm_medium=paid&utm_campaign=week1_test`
- Facebook: `https://devloop-landing.fly.dev?utm_source=facebook&utm_medium=paid&utm_campaign=week1_test`

## Daily Monitoring

Run daily:
```bash
./scripts/marketing-report.sh
```

Check:
- [ ] Total spend vs budget
- [ ] CPC by platform
- [ ] Any platform overspending?
- [ ] Conversion tracking working?

## Safety Limits

- All campaigns set to LIFETIME budget (not monthly)
- All campaigns auto-end December 17, 2024
- Daily budget caps enforced
- Alert threshold: $80 total spend
- Emergency pause: `./scripts/pause-ads.sh all`
