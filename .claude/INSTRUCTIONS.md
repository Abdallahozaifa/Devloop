# DevLoop Project Instructions

> Claude CLI reads this file automatically on every run.

## Project Overview

DevLoop is an autonomous QA product for indie hackers. It consists of:
- **API Backend** (`api/`) - FastAPI Python backend with auth, billing, dashboard
- **CLI Package** (`packages/create-devloop/`) - npm scaffolding tool
- **Landing Page** (`landing/`) - React + Vite + Tailwind marketing site

## Tech Stack

### Backend (api/)
- FastAPI + Python 3.12
- SQLAlchemy + asyncpg (PostgreSQL)
- Stripe for billing
- Magic link authentication via email
- pydantic-settings for configuration

### Frontend (landing/)
- React 19, TypeScript, Tailwind CSS 4, Vite 7
- Single page app with client-side routing

### CLI (packages/create-devloop/)
- Node.js (ES modules)
- License key verification against API

## Directory Structure

```
devloop/
├── api/                       # FastAPI backend
│   ├── app/
│   │   ├── api/v1/           # API routes
│   │   │   ├── auth.py       # Magic link auth
│   │   │   ├── billing.py    # Stripe integration
│   │   │   ├── dashboard.py  # User dashboard
│   │   │   └── license.py    # License verification
│   │   ├── core/
│   │   │   ├── config.py     # Settings (env vars)
│   │   │   ├── database.py   # DB connection
│   │   │   └── security.py   # JWT tokens
│   │   └── models/           # SQLAlchemy models
│   ├── fly.toml              # Fly.io deployment config
│   └── Dockerfile
├── packages/
│   └── create-devloop/        # npm CLI package (v0.1.0)
│       ├── bin/create-devloop.js
│       ├── templates/         # Files to scaffold
│       └── package.json
├── landing/                   # Marketing website
│   ├── src/
│   │   ├── App.tsx           # Full app (landing + dashboard + docs)
│   │   └── index.css         # Tailwind + animations
│   ├── fly.toml              # Fly.io deployment config
│   └── Dockerfile
├── .claude/                   # DevLoop config for this project
└── README.md
```

## Production URLs

- **Landing Page**: https://devloop-landing.fly.dev
- **API**: https://devloop-api.fly.dev
- **npm Package**: `npx create-devloop` (v0.1.0)

## Commands

```bash
# Landing page
cd landing && npm run dev     # Dev server (port 5173)
cd landing && npm run build   # Production build
cd landing && fly deploy      # Deploy to Fly.io

# API
cd api && uvicorn app.main:app --reload  # Dev server (port 8000)
cd api && fly deploy          # Deploy to Fly.io

# CLI package
cd packages/create-devloop
node bin/create-devloop.js --help  # Test CLI
npm publish                   # Publish to npm
```

## Deployment (Fly.io)

### Landing Page (devloop-landing)
- Static nginx serving Vite build
- Region: iad (primary)

### API (devloop-api)
- FastAPI on port 8000
- Region: iad (primary)
- Secrets to set:
  ```bash
  fly secrets set DATABASE_URL="..." -a devloop-api
  fly secrets set STRIPE_SECRET_KEY="..." -a devloop-api
  fly secrets set STRIPE_WEBHOOK_SECRET="..." -a devloop-api
  fly secrets set SECRET_KEY="..." -a devloop-api
  fly secrets set SMTP_USER="..." -a devloop-api
  fly secrets set SMTP_PASSWORD="..." -a devloop-api
  ```

### Database (devloop-db)
- Fly Postgres
- Connect: `fly postgres connect -a devloop-db`

## Important Learnings

### CORS Configuration
- **Issue**: pydantic-settings 2.x can't parse `List[str]` from env vars directly
- **Solution**: Use `CORS_ORIGINS: str` and parse with `get_cors_origins()` method
- **Location**: `api/app/core/config.py`
- **Fly secrets override fly.toml env vars** - be careful with precedence

### Stripe Integration
- Products: Solo ($19), Pro ($39), Team ($79)
- Price IDs are stored in Fly secrets
- Checkout creates user + subscription in webhook handler

### License Keys
- Format: `DL-XXXX-XXXX-XXXX`
- Generated on subscription creation
- Verified via `/api/v1/license/verify` endpoint
- Cached locally for 24 hours in CLI

## Conventions

### API (Python)
- Use async/await for all DB operations
- pydantic for request/response validation
- Environment variables for all secrets
- Structured logging

### Landing Page (React)
- Dark theme with zinc/indigo/purple/pink gradient
- Mobile-first responsive design (sm:, md:, lg: breakpoints)
- CSS animations in index.css
- Tailwind CSS for all styling
- No external component libraries

### CLI Package
- Use ES modules (`"type": "module"`)
- Keep templates generic
- Scripts should work on macOS and Linux

## Key Files

- `api/app/main.py` - FastAPI app entry point
- `api/app/core/config.py` - All settings and CORS config
- `api/app/api/v1/billing.py` - Stripe checkout and webhooks
- `api/app/api/v1/endpoints/dashboard.py` - Dashboard endpoints (projects, settings, GitHub workflow)
- `api/app/services/slack.py` - Slack notification service
- `api/scripts/cron-qa.py` - Scheduled QA cron job
- `landing/src/App.tsx` - Full landing page + dashboard + docs
- `landing/src/index.css` - Tailwind + custom animations
- `packages/create-devloop/bin/create-devloop.js` - CLI entry point

## New Features (December 2024)

### Scheduled QA
- Projects can have QA schedule: none, hourly, daily, weekly
- `QASchedule` enum in `api/app/models/project.py`
- `next_scheduled_run` field tracks when next run is due
- `api/scripts/cron-qa.py` handles scheduled runs
- Dashboard has schedule dropdown in project settings

### GitHub Integration
- GitHub repo field in project settings
- `/projects/{id}/github-workflow` endpoint generates workflow YAML
- Dashboard has "Copy GitHub Action" button with full workflow and instructions

### Slack Alerts
- Slack webhook URL in project settings
- Notify on pass/fail toggleable per project
- `api/app/services/slack.py` sends formatted Block Kit messages
- `/projects/{id}/test-slack` endpoint for testing webhook
- Dashboard has "Test Slack Notification" button

### Project Settings Modal
- Full settings modal in dashboard for each project
- Sections: Basic Info, Scheduled QA, GitHub Integration, Slack Notifications
- Can update/delete projects

## Testing

### Test Commands
```bash
# Landing page E2E tests (Playwright)
cd landing && npm test                    # Run all tests
cd landing && npm run test:chromium       # Chromium only
cd landing && npm run test:headed         # Watch tests run
cd landing && npm run test:ui             # Interactive UI

# API smoke tests
cd api && python scripts/smoke_test.py --base-url https://devloop-api.fly.dev
```

### Test Files
- `landing/e2e/devloop.spec.ts` - Core E2E tests (32 tests)
- `landing/e2e/comprehensive.spec.ts` - Comprehensive E2E suite (62 tests)
- `landing/playwright.config.ts` - Playwright config
- `api/scripts/smoke_test.py` - API endpoint smoke tests

**Total: 94 E2E tests covering:**
- API health & contract validation (12 tests)
- Landing page UI (8 tests)
- Navigation flows (4 tests)
- Dashboard login (4 tests)
- Auth verification (2 tests)
- Checkout flows (2 tests)
- Documentation page (3 tests)
- Responsive design - mobile/tablet/desktop (9 tests)
- Accessibility (4 tests)
- Error handling (4 tests)
- Performance (4 tests)
- Security (3 tests)
- Content verification (3 tests)
- Console error monitoring (2 tests)

## Lessons Learned (Production Issues)

### Database SSL on Fly.io Internal Network
- **Issue**: asyncpg SSL handshake fails on Fly.io internal network (.internal hostnames)
- **Root Cause**: Fly Postgres internal connections don't need SSL, but asyncpg tries it by default
- **Solution**: Use `sslmode=disable` in DATABASE_URL for internal connections
- **Example**: `postgres://user:pass@devloop-db.internal:5432/db?sslmode=disable`
- **Symptom**: 500 errors that look like CORS errors in browser console

### Frontend/Backend API Contract Mismatches
- **Issue**: Frontend not sending required request body fields causes 422 errors
- **Example**: `/api/v1/billing/portal` requires `{ return_url: string }` but frontend sent empty body
- **Root Cause**: No API contract validation tests
- **Solution**: Always include `Content-Type: application/json` header AND proper JSON body
- **Prevention**: Add E2E tests that validate API request schemas

### CORS Errors Masking Server Errors
- **Issue**: Browser shows "CORS error" but actual issue is 500 Internal Server Error
- **Why**: Browsers don't expose error details for failed CORS preflight
- **Debug**: Use `curl` to test endpoints directly, check API logs on Fly.io
- **Example**: `fly logs -a devloop-api` shows actual server errors

### React Hooks Order in useEffect
- **Issue**: `Can't read property of undefined` in useEffect
- **Root Cause**: Accessing state that depends on async data before it loads
- **Solution**: Add null checks or conditional rendering before accessing nested properties
- **Pattern**: `if (!data) return; const value = data.nested.property;`

### Enum Case Sensitivity (PostgreSQL + SQLAlchemy)
- **Issue**: SQLAlchemy `Enum(QASchedule)` uses enum NAME (uppercase: `NONE`) not VALUE (lowercase: `none`)
- **Root Cause**: By default, SQLAlchemy sends the enum attribute name, not its value, to PostgreSQL
- **Symptom**: 500 error on INSERT with "invalid input value for enum" in logs
- **Solution**: Use `values_callable` parameter in SQLAlchemy Enum:
  ```python
  qa_schedule: Mapped[QASchedule] = mapped_column(
      Enum(QASchedule, values_callable=lambda x: [e.value for e in x]),
      default=QASchedule.NONE,
      nullable=False
  )
  ```
- **Prevention**: Always test database INSERT operations in E2E tests, not just API contract validation

### Fly.io Database Health Issues
- **Issue**: All API endpoints returning 500 errors
- **Root Cause**: Fly Postgres database health checks failing (ROLE: error)
- **Symptom**: `asyncpg.exceptions.ConnectionDoesNotExistError` in logs
- **Debug**:
  ```bash
  fly status -a devloop-db           # Check database machine status
  fly checks list -a devloop-db      # View health check status
  ```
- **Solution**:
  ```bash
  fly machines restart <machine-id> -a devloop-db  # Restart database
  fly machines start <machine-id> -a devloop-api   # Restart API after DB is healthy
  ```

### Missing Database Columns
- **Issue**: 500 errors on queries due to missing columns added in code but not in DB
- **Symptom**: `column X does not exist` in API logs
- **Solution**:
  ```bash
  # Add missing column
  echo "ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;" | \
    fly postgres connect -a devloop-db --database devloop_api
  ```
- **Prevention**: Always verify schema matches models before deploying

### Frontend Token Storage Key
- **Issue**: Playwright tests injecting token to wrong localStorage key
- **Root Cause**: Code uses `localStorage.getItem('token')`, not `devloop_token`
- **Location**: `landing/src/App.tsx:254`
- **Solution**: Always check the actual code for storage key names:
  ```typescript
  localStorage.setItem('token', jwt);  // NOT 'devloop_token'
  ```

## QA Checklist (Before Deployment)

### API Changes
- [ ] Run `python scripts/smoke_test.py` against staging/production
- [ ] Check all endpoints return expected status codes (not 500)
- [ ] Verify request body schemas match frontend expectations
- [ ] Check database migrations applied correctly

### Frontend Changes
- [ ] Run `npm run test:chromium` E2E tests
- [ ] Check browser console for errors after key interactions
- [ ] Test on mobile viewport (375px width)
- [ ] Verify all fetch() calls include proper headers and body

### Database Changes
- [ ] Test migration on staging first
- [ ] Verify enum values match Python model definitions
- [ ] Check column types match SQLAlchemy model
- [ ] Run `fly postgres connect -a devloop-db` to verify schema

## Fly.io Operations Runbook

### Quick Health Check
```bash
# Check all services status
fly status -a devloop-api
fly status -a devloop-db
fly status -a devloop-landing

# View recent logs
fly logs -a devloop-api --no-tail | head -50
fly logs -a devloop-db --no-tail | head -50

# Check health endpoints
curl -s https://devloop-api.fly.dev/health | jq
curl -s -o /dev/null -w "%{http_code}" https://devloop-landing.fly.dev
```

### Database Operations
```bash
# Connect to database interactively
fly postgres connect -a devloop-db --database devloop_api

# Run SQL query
echo "SELECT * FROM users LIMIT 5;" | fly postgres connect -a devloop-db --database devloop_api

# Check database health checks
fly checks list -a devloop-db

# View database machine status
fly machines list -a devloop-db
```

### Generate JWT for Testing (Authenticated Endpoints)
```bash
# SSH into API and generate JWT token
fly ssh console -a devloop-api -C "python3 -c \"
import os
from datetime import datetime, timedelta
from jose import jwt
secret = os.environ.get('SECRET_KEY')
user_id = 'USER_ID_HERE'  # Get from database
expire = datetime.utcnow() + timedelta(days=1)
token = jwt.encode({'sub': user_id, 'exp': expire}, secret, algorithm='HS256')
print(token)
\""

# Test with token
curl -s -H "Authorization: Bearer <token>" https://devloop-api.fly.dev/api/v1/auth/me
```

### Common Fixes

#### Fix: Database Connection Errors (500s on all endpoints)
```bash
# 1. Check database health
fly checks list -a devloop-db

# 2. If health checks failing, restart database
fly machines list -a devloop-db  # Get machine ID
fly machines restart <machine-id> -a devloop-db

# 3. Wait for database to be healthy (~30s)
fly status -a devloop-db

# 4. Restart API to reconnect
fly machines list -a devloop-api  # Get machine ID
fly machines start <machine-id> -a devloop-api
```

#### Fix: Missing Database Column
```bash
# Add missing column
echo "ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;" | \
  fly postgres connect -a devloop-db --database devloop_api

# Verify
echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'table_name';" | \
  fly postgres connect -a devloop-db --database devloop_api
```

#### Fix: API Not Responding
```bash
# Check if machine is running
fly status -a devloop-api

# If stopped, start it
fly machines list -a devloop-api
fly machines start <machine-id> -a devloop-api

# If running but not responding, restart
fly apps restart devloop-api
```

### Debugging Tips
1. **Always check logs first**: `fly logs -a devloop-api`
2. **Test endpoints with curl, not browser**: Browser hides real errors behind CORS
3. **Check database health before API**: Database issues cause cascading API failures
4. **Verify secrets are set**: `fly secrets list -a devloop-api`

## Test User for Smoke Testing

For authenticated E2E tests, use this test user:
- **Email**: `abdallahozaifa19527@gmail.com`
- **User ID**: `aadfd94f-0b0d-44e8-bf1a-3ad15de7a4d1`
- **Storage Key**: `localStorage.setItem('token', jwt)` (see `landing/src/App.tsx:254`)

Generate fresh JWT token using the command in "Generate JWT for Testing" above.

## Live Smoke Test Commands

```bash
# Run all E2E tests (Chromium only - fastest)
cd landing && npm run test:chromium

# Run live smoke tests specifically
cd landing && npx playwright test e2e/live-smoke.spec.ts --project=chromium

# Run with visible browser
cd landing && npx playwright test e2e/live-smoke.spec.ts --project=chromium --headed

# Run authenticated tests only
cd landing && npx playwright test e2e/live-smoke.spec.ts --project=chromium --grep "Authenticated"
```
