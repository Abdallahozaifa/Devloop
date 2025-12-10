# DevLoop Project Instructions

> Claude CLI reads this file automatically on every run.

## Project Overview

DevLoop is an autonomous QA product for indie hackers. It consists of:
- **CLI Package** (`packages/create-devloop/`) - npm scaffolding tool
- **Landing Page** (`landing/`) - React + Vite + Tailwind marketing site

## Tech Stack

- Frontend: React 19, TypeScript, Tailwind CSS 4, Vite 7
- CLI: Node.js (ES modules)
- No backend (static landing page + npm package)

## Directory Structure

```
devloop/
├── packages/
│   └── create-devloop/        # npm CLI package
│       ├── bin/               # CLI entrypoint
│       │   └── create-devloop.js
│       ├── templates/         # Files to scaffold
│       │   ├── .claude/       # QA config templates
│       │   └── scripts/       # QA script templates
│       └── package.json
├── landing/                   # Marketing website
│   ├── src/
│   │   ├── App.tsx           # Main landing page component
│   │   └── index.css         # Tailwind styles
│   └── package.json
├── .claude/                   # DevLoop config for this project
├── scripts/                   # DevLoop scripts for this project
└── README.md
```

## Commands

```bash
# Landing page
cd landing && npm run dev     # Dev server (port 5173)
cd landing && npm run build   # Production build

# CLI package
cd packages/create-devloop
node bin/create-devloop.js --help  # Test CLI
npm pack                      # Create tarball for testing
```

## Development Workflow

1. Make changes to CLI templates in `packages/create-devloop/templates/`
2. Test with `node bin/create-devloop.js` in a test directory
3. Make changes to landing page in `landing/src/`
4. Test with `npm run dev`

## Conventions

### CLI Package
- Use ES modules (`"type": "module"` in package.json)
- Keep templates generic - no project-specific references
- Scripts should work on macOS and Linux

### Landing Page
- Dark theme with zinc/indigo color palette
- Mobile-first responsive design
- Tailwind CSS for all styling
- No external component libraries

## Deployment

- **Landing Page**: Deploy to Vercel/Netlify (static build)
- **CLI Package**: Publish to npm as `create-devloop`

## Key Files

- `packages/create-devloop/bin/create-devloop.js` - CLI entry point
- `packages/create-devloop/templates/scripts/qa.sh` - Main QA orchestrator
- `packages/create-devloop/templates/scripts/qa-fix.sh` - Auto-fix loop
- `landing/src/App.tsx` - Full landing page component
