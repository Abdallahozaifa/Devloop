# DevLoop

AI-powered spec testing for APIs and UIs.

## Install

```bash
npm install -g create-devloop
```

## Quick Start

```bash
# Initialize specs folder
devloop spec init

# Write specs in plain English
devloop spec "guests can access /health"
devloop spec "guests cannot access /api/projects"
devloop spec "authenticated users can access /api/projects"

# Run tests
devloop test --api-url https://your-api.com
```

## Features

### API Testing
Test REST API endpoints with role-based access control.

### UI Testing (New in 2.1)
Puppeteer-based live UI testing for production environments:
- Page load verification
- Console error detection
- Network error monitoring
- Element visibility checks

### Contract Specs (New in 2.1)
Configuration checks with `type: config`:
- `url_resolves` - Verify endpoints are accessible
- `no_pattern` - Ensure patterns don't exist in codebase
- `pattern_exists` - Verify patterns ARE present in codebase (New in 2.2)
- File glob pattern matching

### Backend-First Generation (New in 2.1)
Generate complete specs from your backend code:
```bash
devloop spec generate --complete
```

### Detailed Spec Validation (New in 2.1)
Rich assertion options:
- `bodyHas` - Check for required fields in response
- `bodyNot` - Ensure sensitive fields are not exposed
- `headers` - Validate response headers

## AI Generation

Let Claude generate specs for your entire API:

```bash
export ANTHROPIC_API_KEY=your-key
devloop spec generate -y
devloop test --api-url https://your-api.com
```

## Spec Types

### API Specs (`type: api`)

```yaml
name: API Tests
type: api

roles:
  guest: {}
  user:
    credentials:
      email: test@example.com
      password: password123
    loginEndpoint: /api/v1/auth/login

tests:
  - name: Health is public
    as: guest
    method: GET
    path: /health
    expect:
      status: 200

  - name: Projects require auth
    as: guest
    method: GET
    path: /api/projects
    expect:
      status: 401

  - name: Users can list projects
    as: user
    method: GET
    path: /api/projects
    expect:
      status: 200
      bodyHas:
        - projects
```

### UI Specs (`type: ui`)

```yaml
name: Portal UI Tests
type: ui

tests:
  - name: Homepage loads successfully
    url: https://your-app.com/
    waitUntil: networkidle2
    expect:
      status: 200
      noConsoleErrors: true
      noNetworkErrors: true

  - name: Health check page responds
    url: https://your-app.com/api/v1/health
    waitUntil: networkidle2
    expect:
      status: 200
```

### Config Specs (`type: config`)

```yaml
name: Configuration Checks
type: config

tests:
  - name: Production API is reachable
    check: url_resolves
    url: https://your-api.com/health
    expect:
      status: [200, 405]

  - name: No hardcoded URLs in frontend
    check: no_pattern
    in: src/**/*.{ts,tsx}
    pattern: https://hardcoded-url\.com
    exclude:
      - '*.test.ts'
    message: Use environment variables instead

  - name: No exposed secrets
    check: no_pattern
    in: app/**/*.py
    pattern: api_key\s*=\s*['"][^'"]+['"]
    message: Never hardcode API keys

  - name: Frontend uses correct API endpoint
    check: pattern_exists
    in: src/**/*.ts
    pattern: /api/v1/projects
    message: Frontend must call /api/v1/projects endpoint
```

## Commands

```bash
devloop spec init              # Initialize specs folder
devloop spec "description"     # Add spec in plain English
devloop spec generate          # AI-generate specs
devloop spec generate --complete  # Generate with full backend analysis
devloop spec list              # List spec files
devloop test --api-url <url>   # Run tests
devloop test                   # Run tests (uses DEVLOOP_API_URL env)
```

## Environment Variables

```bash
DEVLOOP_API_URL=https://your-api.com  # Default API URL for tests
ANTHROPIC_API_KEY=your-key            # Required for AI spec generation
```

## Safety Features (New in 2.3)

### Read-Only Mode (Default)
By default, `devloop test` runs in read-only mode - only GET requests are executed. This prevents accidental data modification in production.

```bash
devloop test                     # Read-only (GET only)
devloop test --allow-writes      # Enable POST/PUT/DELETE tests
```

### Dry Run Mode
Preview what will be tested without making any requests:

```bash
devloop test --dry-run
```

### Hardcoding Enforcement
The `devloop doctor` command scans the DevLoop source code for forbidden hardcoded literals to enforce best practices.

```bash
# Run the doctor to check the codebase
npm run doctor
```

## Evaluation Harness (`devloop eval`)

DevLoop includes a deterministic evaluation harness to measure how spec completeness affects AI agent success.

### `devloop eval init`
Initializes the evaluation directory structure (`.devloop/eval/`) with folders for tasks, specs, runs, and reports.

```bash
devloop eval init
```

### `devloop eval run`
Runs an evaluation suite against a target model. It iterates through tasks and spec variants (vague, basic, comprehensive), running an agent loop for each to try and solve the task.

```bash
devloop eval run --suite <name> --model <model_name> --max-iterations 10
```

### `devloop eval report`
Generates a human-readable (`report.md`) and machine-readable (`report.json`) report from a completed run.

```bash
devloop eval report --run <run_id>
```

## Commands

```bash
devloop init                     # Initialize DevLoop in your project
devloop doctor                   # Scan DevLoop source for hardcoded strings
devloop spec init                # Initialize specs folder
devloop spec "description"       # Add spec in plain English
devloop spec generate            # AI-generate specs
devloop spec generate --complete # Generate with full backend analysis
devloop spec list                # List spec files
devloop test                     # Run tests (uses DEVLOOP_API_URL env)
devloop test --api-url <url>     # Run tests against a specific URL
devloop test --dry-run           # Preview test plan without requests
devloop test --allow-writes      # Enable POST/PUT/DELETE tests
devloop test --skip-ui           # Skip UI tests
devloop test --json              # JSON output for CI/CD
devloop eval init                # Initialize the evaluation harness
devloop eval run                 # Run an evaluation suite
devloop eval report              # Generate an evaluation report
```

## Environment Variables

```bash
DEVLOOP_API_URL=https://your-api.com  # Default API URL for tests
ANTHROPIC_API_KEY=your-key            # Required for AI spec generation
DEVLOOP_LICENSE_KEY=your-key          # License key for full features
```

## Changelog

### 2.3.0
- **Read-Only Mode by Default**: Only GET requests run unless `--allow-writes` is specified
- **Dry Run Mode**: `--dry-run` flag to preview test plan without making requests
- **Secrets Redaction**: Passwords, tokens, and API keys are never logged
- **Clear Error Messages**: Actionable error messages with fixes and hints
- **Skip Flags**: `--skip-ui` and `--skip-contracts` for selective testing
- **Idempotent Init**: `devloop init` is now safe to run multiple times
- **Universal Spec Architecture**: Framework-agnostic specs with automatic code generation

### 2.2.0
- **Pattern Exists Check**: New `pattern_exists` check for config specs to verify patterns ARE present in codebase
- **JSON Output**: `devloop test --json` flag for CI/CD integration with machine-readable output
- **Enhanced Reporting**: Rich test result display with totals, pass rates, grouped failures, and action items

### 2.1.0
- **UI Testing**: Puppeteer-based live UI testing with console/network error detection
- **Contract Specs**: New `type: config` for codebase pattern checks
- **Backend-First Generation**: `--complete` flag for comprehensive spec generation
- **Detailed Validation**: `bodyHas`, `bodyNot`, and header assertions

### 2.0.0
- Initial release with API testing and AI generation

## License

MIT
