# DevLoop

**Ship faster. Break nothing.**

Autonomous QA that finds bugs, fixes them, and verifies the fix. Built for indie hackers who ship fast.

## Pricing

| Plan | Price | Projects |
|------|-------|----------|
| Solo | $19/mo | 1 project |
| Pro | $39/mo | 5 projects |
| Team | $79/mo | Unlimited |

All plans include:
- Unlimited QA runs
- AI Vision checks
- Auto-fix with Claude CLI
- Dashboard access

**[Get Started](https://devloop.dev)**

## What is DevLoop?

DevLoop is a QA automation toolkit that integrates with Claude CLI to provide:

- **Auto-discovery** - Automatically discovers your API endpoints and UI routes
- **API Testing** - Tests every endpoint with authentication, validates responses
- **UI Screenshots** - Captures screenshots at multiple viewports with Playwright
- **AI Vision** - Claude analyzes screenshots to verify UI looks correct
- **Auto-Fix Loop** - When tests fail, Claude CLI analyzes and fixes automatically
- **Verification** - Re-runs tests after fixes and generates detailed reports

## Quick Start

```bash
# In your project directory
npx create-devloop

# Enter your license key (get one at devloop.dev)
# DL-XXXX-XXXX-XXXX

# Run smoke test
./scripts/qa.sh smoke

# Run full QA suite
./scripts/qa.sh all

# Auto-fix any failures
./scripts/qa-fix.sh
```

## What Gets Created

```
your-project/
├── .claude/
│   ├── INSTRUCTIONS.md    # Project conventions for AI
│   ├── features.md        # Feature list for testing
│   ├── test-accounts.md   # Test credentials
│   ├── task.md            # Current task description
│   └── qa/                # QA results and screenshots
├── scripts/
│   ├── qa.sh              # Main QA orchestrator
│   ├── qa-api.sh          # API endpoint tests
│   ├── qa-ui.sh           # UI screenshot tests
│   ├── qa-fix.sh          # Auto-fix loop
│   ├── quick.sh           # Quick commands
│   ├── context.sh         # Generate codebase context
│   └── ai.sh              # Claude CLI wrapper
└── .cursorrules           # AI coding guidelines
```

## Commands

### Quick Commands

```bash
./scripts/quick.sh smoke      # Quick health check
./scripts/quick.sh qa         # Full QA suite
./scripts/quick.sh qa-api     # API tests only
./scripts/quick.sh qa-ui      # UI tests only
./scripts/quick.sh qa-fix     # Auto-fix failures
./scripts/quick.sh qa-report  # Generate report
```

### Direct Scripts

```bash
./scripts/qa.sh smoke         # Quick smoke test
./scripts/qa.sh api           # API tests
./scripts/qa.sh ui            # UI tests
./scripts/qa.sh all           # Full suite
./scripts/qa.sh report        # Generate report
./scripts/qa-fix.sh           # Auto-fix loop
```

## Configuration

### Environment Variables

```bash
# License (set automatically by create-devloop)
DEVLOOP_LICENSE_KEY=DL-XXXX-XXXX-XXXX

# Required
DEVLOOP_API_URL=https://your-api.example.com/api
DEVLOOP_APP_URL=https://your-app.example.com

# For authenticated tests
QA_EMAIL=qa@example.com
QA_PASSWORD=your-test-password

# For AI vision checks (optional)
ANTHROPIC_API_KEY=sk-ant-...
```

### Project Setup

1. **Edit `.claude/INSTRUCTIONS.md`** - Configure your tech stack and conventions
2. **Edit `.claude/features.md`** - List your routes and API endpoints
3. **Edit `.claude/test-accounts.md`** - Add test credentials

## How It Works

### 1. License Verification

The CLI verifies your license on each run:
- Checks against the DevLoop API
- Caches verification for 24 hours
- Works offline with cached verification

### 2. API Testing (`qa-api.sh`)

- Tests each endpoint defined in `features.md`
- Handles authentication automatically
- Validates response codes
- Checks protected endpoints reject unauthenticated requests

### 3. UI Testing (`qa-ui.sh`)

- Uses Playwright to capture screenshots
- Supports desktop, mobile, and tablet viewports
- Optionally uses Claude Vision to analyze screenshots
- Detects broken layouts and missing elements

### 4. Auto-Fix Loop (`qa-fix.sh`)

- Collects failures from QA results
- Creates a task for Claude CLI
- Claude analyzes failures and makes fixes
- Re-runs tests to verify
- Loops until all tests pass (max 3 attempts)

## Dashboard

Your license includes access to the DevLoop dashboard at [devloop.dev/dashboard](https://devloop.dev/dashboard):

- View your license key
- Manage projects
- Track QA run history
- See pass/fail statistics
- Manage billing

## CI/CD Integration

DevLoop works in CI/CD pipelines. Set your license key as an environment variable:

```yaml
# GitHub Actions
env:
  DEVLOOP_LICENSE_KEY: ${{ secrets.DEVLOOP_LICENSE_KEY }}

steps:
  - name: Run DevLoop QA
    run: ./scripts/qa.sh all
```

## Project Structure

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
vim .claude/INSTRUCTIONS.md
vim .claude/features.md

# 4. Set environment variables
export DEVLOOP_API_URL="http://localhost:3000/api"
export DEVLOOP_APP_URL="http://localhost:3000"

# 5. Run smoke test
./scripts/qa.sh smoke

# 6. Run full QA suite
./scripts/qa.sh all

# 7. Auto-fix any failures
./scripts/qa-fix.sh

# 8. Check the report
cat .claude/qa/qa-report-*.md
```

## Support

- **Dashboard**: [devloop.dev/dashboard](https://devloop.dev/dashboard)
- **Documentation**: [devloop.dev/docs](https://devloop.dev/docs)
- **Email**: support@devloop.dev

## License

Proprietary. See [devloop.dev/terms](https://devloop.dev/terms) for license terms.
