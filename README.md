# DevLoop

**Spec-first API testing and validation.**

DevLoop generates comprehensive test specifications from your API code and runs them automatically. Write your API, let DevLoop validate it works correctly.

## What is DevLoop?

DevLoop is a CLI tool that:
1. **Generates specs** from your codebase using AI
2. **Runs API tests** based on those specs
3. **Validates contracts** between frontend and backend
4. **Reports results** with detailed pass/fail information

## Quick Start

```bash
# Install the CLI
npm install -g devloop-cli

# Initialize in your project
devloop init

# Generate a spec for your API
devloop spec generate "User Authentication API"

# Run tests
devloop test
```

## How It Works

### 1. Initialize Your Project

```bash
devloop init
```

This creates a `.devloop/` directory with:
- `config.json` - Framework detection and settings
- `config.yaml` - Test configuration (auth, variables)
- `specs/` - Generated test specifications

### 2. Configure Authentication

Edit `.devloop/config.yaml`:

```yaml
apiUrl: http://localhost:3000

roles:
  user:
    credentials:
      email: test@example.com
      password: testpassword123
    loginEndpoint: /api/v1/auth/login

  other_user:
    credentials:
      email: other@example.com
      password: testpassword123
    loginEndpoint: /api/v1/auth/login

variables:
  # Add any variables your tests need
  # ITEM_ID: 00000000-0000-0000-0000-000000000001
```

### 3. Generate Specs

```bash
# Generate spec from feature description
devloop spec generate "Invoice Management"

# Or generate from your API routes automatically
devloop spec generate
```

Generated specs include:
- Data models with types and constraints
- API endpoints with all response codes (200, 400, 401, 403, 404, 422)
- Business rules
- API tests with authentication scenarios
- Contract checks

### 4. Run Tests

```bash
# Run all tests (read-only by default)
devloop test

# Allow write operations (POST, PUT, DELETE)
devloop test --allow-writes

# Dry run - show what would be tested
devloop test --dry-run

# Verbose output
devloop test --verbose
```

## Spec Format

Specs are framework-agnostic YAML files:

```yaml
name: User Management
version: "1.0"

models:
  User:
    fields:
      id:
        type: uuid
        generated: true
      email:
        type: string
        required: true
      created_at:
        type: datetime
        generated: true

api:
  - endpoint: POST /api/v1/users
    auth: required
    request:
      body:
        email:
          type: string
          required: true
    response:
      - status: 201
        body: User
      - status: 400
        when: invalid data
      - status: 401
        when: not authenticated

tests:
  api:
    - name: Create user requires auth
      as: guest
      request:
        method: POST
        path: /api/v1/users
        body:
          email: test@example.com
      expect:
        status: 401

    - name: Create user succeeds
      as: user
      request:
        method: POST
        path: /api/v1/users
        body:
          email: newuser@example.com
      expect:
        status: 201
        bodyHas:
          - id
          - email
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `devloop init` | Initialize DevLoop in current project |
| `devloop spec generate [feature]` | Generate spec from feature description |
| `devloop spec list` | List all specs |
| `devloop test` | Run all tests |
| `devloop test --allow-writes` | Run tests including write operations |
| `devloop test --dry-run` | Preview tests without running |

## Project Structure

```
your-project/
├── .devloop/
│   ├── config.json        # Framework/language detection
│   ├── config.yaml        # Auth and test variables
│   └── specs/
│       └── feature.spec.yaml
└── ...
```

## Supported Frameworks

DevLoop auto-detects:
- **Node.js** - Express, Fastify
- **Python** - FastAPI, Django, Flask
- **React/Vue/Angular** - Frontend frameworks
- **Generic** - Any project structure

## Development

```bash
# Clone the repo
git clone https://github.com/your-org/devloop.git

# Install dependencies
cd devloop
npm install

# Link CLI for development
cd packages/devloop-cli
npm link

# Run tests
npm test
```

## Architecture

- **packages/devloop-cli** - Main CLI tool
- **packages/create-devloop** - `npx create-devloop` scaffolder
- **api/** - Backend API (Fly.io deployment)
- **landing/** - Marketing site (devloop.dev)

## License

Proprietary. See LICENSE for details.
