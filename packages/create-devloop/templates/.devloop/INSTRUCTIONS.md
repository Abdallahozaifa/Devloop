# Project Instructions

> DevLoop reads this file automatically. Configure your project settings here.

## Tech Stack

<!-- Update this section for your project -->

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Node.js / Python / Go
- Database: PostgreSQL / MongoDB / SQLite
- Deployment: Vercel / Fly.io / Railway / AWS

## URLs

```bash
# Production
DEVLOOP_API_URL=https://your-api.example.com/api
DEVLOOP_APP_URL=https://your-app.example.com

# Local development
DEVLOOP_API_URL=http://localhost:3000/api
DEVLOOP_APP_URL=http://localhost:3000
```

## Directory Structure

```
your-project/
├── src/                    # Source code
│   ├── components/         # UI components
│   ├── pages/              # Route pages
│   ├── api/                # API routes
│   └── utils/              # Utilities
├── scripts/                # DevLoop QA scripts
├── .devloop/               # DevLoop config
│   ├── INSTRUCTIONS.md     # This file
│   ├── features.md         # Feature list for testing
│   ├── test-accounts.md    # Test credentials
│   └── qa/                 # QA results
└── tests/                  # Test files
```

## Conventions

### API Endpoints

- All routes under `/api/`
- Use REST conventions: GET, POST, PUT, PATCH, DELETE
- Return proper status codes: 200, 201, 400, 401, 404, 500

### Frontend

- Mobile-first responsive design
- Use existing UI components
- Handle loading and error states

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run test             # Run tests
npm run lint             # Lint code

# DevLoop QA
./scripts/qa.sh smoke    # Quick health check
./scripts/qa.sh api      # Test API endpoints
./scripts/qa.sh ui       # Test UI with screenshots
./scripts/qa.sh all      # Full QA suite
./scripts/qa-fix.sh      # Auto-fix failures
```

## Task Workflow

1. Read `.devloop/task.md` for current task
2. Read `.devloop/features.md` for feature context
3. Implement changes following project patterns
4. Run tests and fix errors
5. Write results to `.devloop/result.md`

## Error Handling

- If tests fail, fix and re-run (max 5 attempts)
- If type errors, fix them before proceeding
- Write any unresolved issues to `.devloop/errors.md`

## QA Testing

### Quick Commands

```bash
./scripts/quick.sh smoke       # Quick health check
./scripts/quick.sh qa-api      # Run API tests
./scripts/quick.sh qa-ui       # Run UI tests with screenshots
./scripts/quick.sh qa          # Full QA suite
./scripts/quick.sh qa-fix      # Auto-fix failures with AI
```

### Environment Variables

```bash
DEVLOOP_API_URL=https://your-api.example.com/api
DEVLOOP_APP_URL=https://your-app.example.com
QA_EMAIL=qa@example.com
QA_PASSWORD=your-test-password
DEVLOOP_API_KEY=...           # For AI vision checks
```

### QA Output Files

- `.devloop/qa/api-results.json` - API test results
- `.devloop/qa/ui-results.json` - UI test results
- `.devloop/qa/screenshots/` - UI screenshots
- `.devloop/qa/qa-report-*.md` - Generated reports
