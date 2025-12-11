# create-devloop

**The last mile of AI coding.** Describe what you want, DevLoop ships it.

```bash
npx create-devloop
```

## What is DevLoop?

DevLoop completes what AI coding tools like Copilot and Cursor start. While they help you write code, DevLoop actually ships it.

- **Describe** what you want in plain English
- **Build** - AI understands your codebase and generates complete features
- **Test** - Automatically writes and runs tests
- **Deploy** - Ships to production
- **Verify** - Confirms everything works in production
- **Fix** - If anything breaks, DevLoop debugs and fixes it

Built for developers who ship fast and want AI to handle the full development loop.

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

### 3. Build Something

```bash
# Describe what you want
devloop build 'add stripe checkout'

# Or use the scripts
./scripts/devloop.sh build 'add user authentication'
```

## What Gets Created

```
your-project/
├── .devloop/
│   ├── config.md             # Project config & conventions
│   ├── features.md           # Feature documentation
│   ├── task.md               # Current task (for AI)
│   └── builds/               # Build results & logs
├── scripts/
│   ├── devloop.sh            # Main orchestrator
│   ├── build.sh              # Build features
│   ├── test.sh               # Run tests
│   ├── deploy.sh             # Deploy to production
│   └── verify.sh             # Verify production
└── .devloop.json             # DevLoop configuration
```

## Commands

### Build Features

```bash
devloop build 'add stripe checkout'       # Build a feature
devloop build 'fix login bug'             # Fix a bug
devloop build 'add dark mode toggle'      # Add UI feature
devloop build 'refactor auth to use JWT'  # Refactor code
```

### Scripts

```bash
./scripts/devloop.sh build 'description'  # Full build loop
./scripts/devloop.sh test                 # Run tests
./scripts/devloop.sh deploy               # Deploy to production
./scripts/devloop.sh verify               # Verify production
./scripts/devloop.sh status               # Show project status
```

## How It Works

### 1. Understands Your Codebase

DevLoop scans your project to understand:
- Your tech stack (React, Node, Python, etc.)
- Your code patterns and conventions
- Existing features and architecture

### 2. Generates Complete Features

When you describe what you want:
```bash
devloop build 'add user profile page with avatar upload'
```

DevLoop:
- Plans the implementation
- Writes production-ready code
- Creates necessary components, routes, and APIs
- Writes tests

### 3. Ships to Production

```bash
# DevLoop output:
> Understanding codebase...
> Planning implementation...
> Generating components...
> Writing tests...
> Running tests... 5/5 passed
> Deploying to production...
> Verifying... all checks passed
> Feature shipped in 47s
```

### 4. Verifies It Works

After deployment, DevLoop:
- Runs smoke tests against production
- Validates endpoints are responding
- Captures screenshots of UI changes
- Alerts you if anything is broken

### 5. Fixes What Breaks

If verification fails:
- Analyzes the failure
- Generates a fix
- Re-runs the loop until it works

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEVLOOP_LICENSE_KEY` | Your license key | (required) |
| `DEVLOOP_API_URL` | API base URL | `http://localhost:3000/api` |
| `DEVLOOP_APP_URL` | App base URL | `http://localhost:3000` |

## CI/CD Integration

### GitHub Actions

```yaml
name: DevLoop
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run DevLoop
        env:
          DEVLOOP_LICENSE_KEY: ${{ secrets.DEVLOOP_LICENSE_KEY }}
        run: devloop build 'deploy latest changes'
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

## Dashboard Features

Your DevLoop dashboard at [devloop.dev/dashboard](https://devloop-landing.fly.dev/dashboard) includes:

### Build History
- View all builds and their status
- See what was built and when
- Track success/failure rates

### Scheduled Builds
Run builds automatically on a schedule:
- **Hourly** - Every hour at :00
- **Daily** - Every day at 2 AM UTC
- **Weekly** - Every Monday at 2 AM UTC

### GitHub Integration
One-click GitHub workflow setup:
1. Open project settings in dashboard
2. Click "Copy GitHub Action"
3. Add workflow to your repo
4. Add `DEVLOOP_LICENSE_KEY` secret
5. Builds run on every push/PR

### Slack Notifications
Get instant alerts:
- Configure webhook URL per project
- Choose to notify on success/failure
- Rich notifications with build summary

## Pricing

- **Solo** ($19/mo) - 1 project, 5 builds/day
- **Pro** ($39/mo) - 5 projects, 30 builds/day
- **Team** ($79/mo) - Unlimited projects, 50 builds/day

[View pricing](https://devloop-landing.fly.dev/#pricing)

## vs Copilot/Cursor

| Feature | Copilot/Cursor | DevLoop |
|---------|----------------|---------|
| Code completion | Yes | - |
| Understands codebase | Partial | Full |
| Generates features | - | Yes |
| Writes tests | - | Yes |
| Deploys | - | Yes |
| Verifies production | - | Yes |
| Auto-fixes | - | Yes |

**Copilot and Cursor help you write code. DevLoop ships it.**

## Support

- **Dashboard**: [devloop.dev/dashboard](https://devloop-landing.fly.dev/dashboard)
- **Issues**: [GitHub Issues](https://github.com/devloop/devloop/issues)

## Requirements

- Node.js 18+
- curl (for API calls)

## License

MIT
