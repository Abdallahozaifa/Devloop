# DevLoop

**The last mile of AI coding.**

AI writes your code. DevLoop ships it. Describe what you want in plain English, get it working in production.

## Pricing

| Plan | Price | Projects |
|------|-------|----------|
| Solo | $19/mo | 1 project |
| Pro | $39/mo | 5 projects |
| Team | $79/mo | Unlimited |

All plans include:
- Unlimited builds
- Full development loop (build → test → deploy → verify)
- Dashboard access

**[Get Started](https://devloop.dev)**

## What is DevLoop?

DevLoop completes what AI coding tools like Copilot and Cursor start. While they help you write code, DevLoop actually ships it.

**The Autonomous Development Loop:**
1. **Describe** - Tell DevLoop what you want in plain English
2. **Build** - AI understands your codebase and generates the implementation
3. **Test** - Automatically writes and runs tests
4. **Deploy** - Ships to production
5. **Verify** - Confirms everything works in production
6. **Fix** - If anything breaks, DevLoop debugs and fixes it

## Quick Start

```bash
# In your project directory
npx create-devloop

# Enter your license key (get one at devloop.dev)
# DL-XXXX-XXXX-XXXX

# Describe what you want to build
devloop build 'add stripe checkout'

# Or run the full loop
./scripts/devloop.sh build 'add user authentication'
```

## What Gets Created

```
your-project/
├── .devloop/
│   ├── config.md         # Project conventions for AI
│   ├── features.md       # Feature list
│   ├── task.md           # Current task description
│   └── builds/           # Build results and logs
├── scripts/
│   ├── devloop.sh        # Main orchestrator
│   ├── build.sh          # Build command
│   ├── test.sh           # Test runner
│   ├── deploy.sh         # Deployment
│   └── verify.sh         # Production verification
└── .devloop.json         # DevLoop configuration
```

## Commands

### Build Commands

```bash
devloop build 'add stripe checkout'      # Build a feature
devloop build 'fix login bug'            # Fix a bug
devloop build 'add dark mode toggle'     # Add UI feature
```

### Direct Scripts

```bash
./scripts/devloop.sh build 'description'  # Full build loop
./scripts/devloop.sh test                 # Run tests
./scripts/devloop.sh deploy               # Deploy to production
./scripts/devloop.sh verify               # Verify production
./scripts/devloop.sh status               # Check project status
```

## How DevLoop Works

### 1. Understands Your Codebase
DevLoop scans your project to understand:
- Your tech stack (React, Node, Python, etc.)
- Your code patterns and conventions
- Existing features and architecture

### 2. Generates Complete Features
When you describe what you want:
- Plans the implementation
- Writes production-ready code
- Creates necessary components, routes, and APIs

### 3. Tests Everything
Automatically:
- Writes unit and integration tests
- Runs your existing test suite
- Validates the implementation works

### 4. Ships to Production
DevLoop handles deployment:
- Commits changes to your repo
- Creates PRs for review (optional)
- Deploys to your production environment

### 5. Verifies It Works
After deployment:
- Runs smoke tests against production
- Validates endpoints are responding
- Captures screenshots of UI changes
- Alerts you if anything is broken

### 6. Fixes What Breaks
If verification fails:
- Analyzes the failure
- Generates a fix
- Re-runs the loop until it works

## Dashboard

Your license includes access to the DevLoop dashboard at [devloop.dev/dashboard](https://devloop.dev/dashboard):

- View build history
- Manage projects
- Track success/failure rates
- Configure notifications
- Manage billing

## CI/CD Integration

DevLoop works in CI/CD pipelines. Set your license key as an environment variable:

```yaml
# GitHub Actions
env:
  DEVLOOP_LICENSE_KEY: ${{ secrets.DEVLOOP_LICENSE_KEY }}

steps:
  - name: Run DevLoop
    run: devloop build 'deploy latest changes'
```

## Supported Stacks

DevLoop adapts to your project structure. It works with:

- **Node.js/React/Next.js** - Detects `package.json`
- **Python/FastAPI/Django** - Detects `requirements.txt`
- **Go** - Detects `go.mod`
- **Rust** - Detects `Cargo.toml`
- **Generic** - Works with any project

## Example Workflow

```bash
# 1. Set up DevLoop in your project
npx create-devloop

# 2. Enter your license key
# DL-XXXX-XXXX-XXXX

# 3. Configure your project
vim .devloop/config.md

# 4. Describe what you want
devloop build 'add user profile page with avatar upload'

# 5. Watch DevLoop work
# > Understanding codebase...
# > Planning implementation...
# > Generating components...
# > Writing tests...
# > Running tests... 5/5 passed
# > Deploying to production...
# > Verifying... all checks passed
# > Feature shipped in 47s

# 6. Check the result
open https://yourapp.com/profile
```

## Support

- **Dashboard**: [devloop.dev/dashboard](https://devloop.dev/dashboard)
- **Documentation**: [devloop.dev/docs](https://devloop.dev/docs)
- **Email**: support@devloop.dev

## License

Proprietary. See [devloop.dev/terms](https://devloop.dev/terms) for license terms.
