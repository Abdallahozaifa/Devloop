# Packages Directory Tree

```
packages/
└── devloop-cli/
    ├── bin/
    │   └── devloop.js
    ├── fixtures/
    │   └── eval-project/
    │       ├── index.js
    │       └── package.json
    ├── node_modules/          (excluded from tree)
    ├── package-lock.json
    ├── package.json
    ├── README.md
    ├── src/
    │   ├── commands/
    │   │   ├── audit.js
    │   │   ├── build.js
    │   │   ├── deploy.js
    │   │   ├── doctor.js
    │   │   ├── eval/
    │   │   │   ├── index.js
    │   │   │   ├── init.js
    │   │   │   ├── report.js
    │   │   │   └── run.js
    │   │   ├── fix.js
    │   │   ├── fixtures.js
    │   │   ├── index.js
    │   │   ├── init.js
    │   │   ├── lint.js
    │   │   ├── qa.js
    │   │   ├── spec.js
    │   │   ├── status.js
    │   │   ├── test.js
    │   │   └── validate.js
    │   ├── core/
    │   │   ├── auto-fixer.js
    │   │   ├── codebase-reader.js
    │   │   ├── config-loader.js
    │   │   ├── config-validator.js
    │   │   ├── config.js
    │   │   ├── discovery/
    │   │   │   ├── index.js
    │   │   │   ├── route-scanner.js
    │   │   │   └── schema-extractor.js
    │   │   ├── error-messages.js
    │   │   ├── eval/
    │   │   │   ├── reporter.js
    │   │   │   └── structures.js
    │   │   ├── evaluator.js
    │   │   ├── fixtures/
    │   │   │   └── runner.js
    │   │   ├── generator.js
    │   │   ├── generators/
    │   │   │   ├── express.js
    │   │   │   ├── fastapi.js
    │   │   │   ├── framework-registry.js
    │   │   │   └── react.js
    │   │   ├── hardcode-linter.js
    │   │   ├── license.js
    │   │   ├── live-tester.js
    │   │   ├── pattern-matcher.js
    │   │   ├── security.js
    │   │   ├── spec/
    │   │   │   ├── backend-analyzer.js
    │   │   │   ├── comprehensive-spec-format.js
    │   │   │   ├── generators/
    │   │   │   │   ├── ai-generator.js
    │   │   │   │   ├── comprehensive-generator.js
    │   │   │   │   ├── generator.js
    │   │   │   │   ├── index.js
    │   │   │   │   ├── programmatic-generator.js
    │   │   │   │   ├── shape-contract-generator.js
    │   │   │   │   └── universal-generator.js
    │   │   │   ├── parser.js
    │   │   │   ├── reporter.js
    │   │   │   ├── runners/
    │   │   │   │   ├── config-runner.js
    │   │   │   │   ├── index.js
    │   │   │   │   ├── runner.js
    │   │   │   │   └── ui-runner.js
    │   │   │   └── universal-spec.js
    │   │   ├── test-generator/
    │   │   │   ├── crud-generator.js
    │   │   │   ├── data-faker.js
    │   │   │   ├── index.js
    │   │   │   └── ui-generator.js
    │   │   └── variable-resolver.js
    │   ├── data/
    │   │   ├── design-system.json
    │   │   ├── learned-patterns.json
    │   │   └── patterns.json
    │   ├── extractors/
    │   │   ├── base.js
    │   │   ├── detect.js
    │   │   ├── fastapi.js
    │   │   └── index.js
    │   └── utils/
    │       └── ui.js
    └── test/
        ├── doctor.test.js
        ├── eval-integration.test.js
        ├── eval.test.js
        └── test-spec.test.js
```

## Summary

- **1 package**: `devloop-cli`
- **Main directories**:
  - `bin/` - CLI entry point
  - `src/` - Source code
    - `commands/` - CLI commands (17 files)
    - `core/` - Core functionality (30+ files)
    - `data/` - JSON data files
    - `extractors/` - Code extractors
    - `utils/` - Utility functions
  - `fixtures/` - Test fixtures
  - `test/` - Test files

