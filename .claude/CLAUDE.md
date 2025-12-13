# DevLoop Development Instructions

## Architecture Overview

See [architecture.md](./architecture.md) for the complete three-layer architecture:
- **Extraction Layer** (framework-specific): FastAPI, Django, NestJS, Express extractors
- **Universal Spec Format** (framework-agnostic): Standardized YAML spec
- **Test Runner** (framework-agnostic): HTTP test execution

## Project Structure

```
devloop/
├── packages/
│   ├── devloop-cli/        # Main CLI tool (npm package)
│   └── create-devloop/     # npx create-devloop scaffolder
├── api/                    # Backend API (Fly.io: devloop-api)
└── landing/                # Marketing site (Fly.io: devloop-landing)
```

## CLI Commands

```bash
# Initialize a project
devloop init

# Generate spec from feature description
devloop spec generate "Feature Name"

# Run tests (read-only by default)
devloop test

# Run tests including write operations
devloop test --allow-writes

# Dry run - preview tests
devloop test --dry-run
```

## Configuration Files

When a user runs `devloop init`, it creates:
- `.devloop/config.json` - Framework detection metadata
- `.devloop/config.yaml` - Test configuration (auth roles, variables)
- `.devloop/specs/` - Generated spec files

## Key Source Files

### CLI Core
- `packages/devloop-cli/src/commands/init.js` - Init command
- `packages/devloop-cli/src/commands/spec/generate.js` - Spec generation
- `packages/devloop-cli/src/commands/test.js` - Test runner

### Spec System
- `packages/devloop-cli/src/core/spec/universal-spec.js` - Spec validation
- `packages/devloop-cli/src/core/spec/runners/runner.js` - HTTP test execution
- `packages/devloop-cli/src/core/spec/generators/comprehensive-generator.js` - AI spec generation

## Deployment

```bash
# Deploy API
cd api && fly deploy --app devloop-api --ha=false

# Deploy Landing
cd landing && fly deploy --app devloop-landing --ha=false

# Publish CLI to npm
cd packages/create-devloop && npm publish
```

## Development Workflow

1. Make code changes
2. Test locally with `node bin/devloop.js` in the CLI package
3. Test against a real project (e.g., freelancer-shield)
4. Deploy when ready

## Database

- Fly Postgres: `devloop-db`
- Access: `fly postgres connect -a devloop-db --database devloop_api`

---

*This file is read by Claude CLI automatically. Keep it updated.*
