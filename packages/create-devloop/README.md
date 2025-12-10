# create-devloop

Autonomous QA scaffolding for any project. Find bugs, fix them, verify the fix.

```bash
npx create-devloop
```

## What is DevLoop?

DevLoop is an AI-powered QA automation toolkit that:

- **Auto-discovers** your API endpoints and UI routes
- **Tests everything** with automated scripts
- **Captures screenshots** at multiple viewports
- **Uses AI vision** to verify UI correctness
- **Auto-fixes bugs** using DevLoop AI
- **Verifies fixes** by re-running failed tests
- **Runs on schedule** - hourly, daily, or weekly automated testing
- **GitHub Actions** - one-click CI/CD integration
- **Slack alerts** - instant notifications on test failures
- **Live Production Testing** - test your production environment with health checks, API smoke tests, and UI validation

Built for indie hackers who ship fast and need confidence their code works.

## Quick Start

### 1. Get a License

Sign up at [devloop.dev](https://devloop-landing.fly.dev) and get your license key (`DL-XXXX-XXXX-XXXX`).

### 2. Install

```bash
# In your project directory
npx create-devloop

# Or with license key directly
npx create-devloop --license DL-XXXX-XXXX-XXXX
```

### 3. Configure

Edit the generated files for your project:

```bash
# Set your tech stack and conventions
.devloop/config.md

# Add test account credentials
.devloop/test-accounts.md

# Define your features and routes
.devloop/features.md
```

### 4. Run Tests

```bash
# Quick health check
./scripts/qa.sh smoke

# Full test suite
./scripts/qa.sh all

# Auto-fix failures
./scripts/qa.sh fix
```

## What Gets Created

```
your-project/
├── .devloop/
│   ├── config.md             # Project config & conventions
│   ├── features.md           # Feature documentation
│   ├── test-accounts.md      # QA credentials
│   ├── task.md               # Current task (for AI)
│   └── qa/                   # Test results & screenshots
├── scripts/
│   ├── qa.sh                 # Main QA runner
│   ├── qa-api.sh             # API endpoint tests
│   ├── qa-ui.sh              # UI screenshot tests
│   ├── qa-fix.sh             # Auto-fix loop
│   ├── quick.sh              # Shortcut commands
│   └── context.sh            # Generate codebase context
└── .devloop.json             # DevLoop configuration
```

## Commands

### QA Testing

```bash
./scripts/qa.sh smoke        # Quick health check
./scripts/qa.sh api          # API tests only
./scripts/qa.sh ui           # UI tests only
./scripts/qa.sh all          # Full test suite
./scripts/qa.sh report       # Generate report
./scripts/qa.sh fix          # Auto-fix failures
```

### Quick Commands

```bash
./scripts/quick.sh qa        # Run full QA suite
./scripts/quick.sh smoke     # Quick smoke test
./scripts/quick.sh qa-fix    # Auto-fix with AI
./scripts/quick.sh ai        # Run DevLoop AI
./scripts/quick.sh status    # Show project status
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEVLOOP_LICENSE_KEY` | Your license key | (required) |
| `DEVLOOP_API_URL` | API base URL | `http://localhost:3000/api` |
| `DEVLOOP_APP_URL` | App base URL | `http://localhost:3000` |

## How It Works

### 1. API Testing (`qa-api.sh`)

Automatically tests your API endpoints:

- Health checks
- Authentication flows
- CRUD operations
- Error handling
- Response validation

```bash
./scripts/qa-api.sh

# Output:
# API Tests
# =========
# ✓ GET /api/health - 200 OK
# ✓ POST /api/auth/login - 200 OK
# ✓ GET /api/users - 200 OK (authenticated)
# ✗ POST /api/users - 500 Internal Server Error
```

### 2. UI Testing (`qa-ui.sh`)

Captures screenshots and validates UI:

- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

```bash
./scripts/qa-ui.sh

# Output:
# UI Tests
# ========
# ✓ Homepage - 3 screenshots captured
# ✓ Login page - 3 screenshots captured
# ✓ Dashboard - 3 screenshots captured
```

### 3. AI Vision Checks

DevLoop AI analyzes screenshots:

- Checks for broken layouts
- Identifies missing elements
- Detects visual regressions
- Validates responsive design

### 4. Auto-Fix Loop (`qa-fix.sh`)

When tests fail, DevLoop AI analyzes and fixes:

```bash
./scripts/qa-fix.sh

# Output:
# Attempt 1 of 3
# Found 2 failures:
# - API: POST /api/users - 500 Internal Server Error
# - UI: Dashboard - missing sidebar
#
# Running DevLoop AI to fix issues...
# [AI makes code changes]
#
# Re-running tests...
# ✓ All failures fixed!
```

## CI/CD Integration

### GitHub Actions

```yaml
name: QA
on: [push, pull_request]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start app
        run: npm start &

      - name: Run QA
        env:
          DEVLOOP_LICENSE_KEY: ${{ secrets.DEVLOOP_LICENSE_KEY }}
          DEVLOOP_API_URL: http://localhost:3000/api
          DEVLOOP_APP_URL: http://localhost:3000
        run: ./scripts/qa.sh all
```

## Supported Stacks

DevLoop auto-detects your project type:

- **Node.js** - Express, Fastify, Nest.js
- **React** - Create React App, Vite
- **Next.js** - App Router, Pages Router
- **Vue** - Vue CLI, Nuxt
- **Python** - Flask, FastAPI, Django
- **Go** - Gin, Echo, Chi
- **Rust** - Actix, Axum, Rocket

The QA scripts are stack-agnostic - they test HTTP endpoints and capture browser screenshots.

## License Verification

Your license key is verified:

1. On first run (creates account)
2. Every 24 hours (cached locally)
3. Graceful fallback if API is unreachable

License data is stored at `~/.devloop-license`.

## Dashboard Features

Your DevLoop dashboard at [devloop-landing.fly.dev/dashboard](https://devloop-landing.fly.dev/dashboard) includes:

### Scheduled QA
Run tests automatically on a schedule:
- **Hourly** - Every hour at :00
- **Daily** - Every day at 2 AM UTC
- **Weekly** - Every Monday at 2 AM UTC

### GitHub Actions Integration
One-click GitHub workflow setup:
1. Open project settings in dashboard
2. Click "Copy GitHub Action"
3. Add workflow to your repo
4. Add `DEVLOOP_LICENSE_KEY` secret
5. Tests run on every push/PR

### Slack Notifications
Get instant alerts when tests fail:
- Configure webhook URL per project
- Choose to notify on pass/fail
- Rich notifications with test summary

## Live Production Testing

Test your production environment continuously:

### Health Checks
Monitor your production APIs with periodic health checks:
- Configurable health check endpoint (default: `/health`)
- Customizable check interval (default: 5 minutes)
- Status tracking: healthy, degraded, or down

### API Smoke Tests
Automated smoke tests against your production API:
- Tests common endpoints (`/health`, `/`, configured endpoints)
- Validates response status codes
- Measures response times
- Reports pass/fail for each endpoint

### UI Tests
Basic UI validation for your production frontend:
- Verifies page loads successfully
- Checks content type is HTML
- Validates response time is acceptable (< 5 seconds)

### Configure Production Testing

In your dashboard project settings:

1. **Enable Production Testing**
2. **Set Production URL** - Your live frontend URL (e.g., `https://myapp.com`)
3. **Set Production API URL** - Your live API URL (e.g., `https://api.myapp.com`)
4. **Configure Health Check Endpoint** - Default is `/health`
5. **Set Test Schedule** - Manual, hourly, daily, or weekly

### Run Tests Manually

Click "Run Production Tests Now" in your project settings to trigger an immediate test run.

### View Results

Click "View Results" to see detailed test history:
- Test run status (passed/failed)
- API endpoint results with response times
- UI test results
- Health check status

### Example Output

```
$ devloop production-test --full

─── Health Check ───
✓ /health               200 OK     [45ms]  healthy

─── API Smoke Tests ───
✓ GET  /health          200 OK     [12ms]
✓ GET  /                200 OK     [8ms]
✓ POST /api/auth/login  200 OK     [156ms]
API: 3/3 endpoints passed

─── UI Tests (Production) ───
✓ page_loads            passed     [1,245ms]
✓ returns_html          passed     [0ms]
✓ response_time_ok      passed     [1,245ms]
UI: 3/3 tests passed

══════════════════════════════════
✓ PRODUCTION TESTS PASSED
  Health: healthy | API: 3/3 | UI: 3/3
══════════════════════════════════
```

## Pricing

- **Solo** ($19/mo) - 1 project, scheduled QA, GitHub + Slack
- **Pro** ($39/mo) - 5 projects, visual diff, auto-generate tests
- **Team** ($79/mo) - Unlimited projects, team sharing, custom integrations

[View pricing](https://devloop-landing.fly.dev/#pricing)

## Support

- **Dashboard**: [devloop-landing.fly.dev/dashboard](https://devloop-landing.fly.dev/dashboard)
- **Issues**: [GitHub Issues](https://github.com/devloop/devloop/issues)

## Requirements

- Node.js 18+
- curl (for API tests)
- Chrome/Chromium (for UI screenshots, optional)

## License

MIT
