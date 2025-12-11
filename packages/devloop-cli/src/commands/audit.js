import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getProjectRoot, CONFIG_DIR, detectFramework as detectFrameworkLegacy } from '../core/config.js';
import { discoverProject, printDiscoverySummary } from '../core/discovery/index.js';
import { generateTests, getTestStats } from '../core/test-generator/index.js';
import { success, error, info, warn, spinner, printBanner } from '../utils/ui.js';
import chalk from 'chalk';

export async function auditCommand(options) {
  printBanner();

  const projectRoot = getProjectRoot();
  const frameworkLegacy = detectFrameworkLegacy(projectRoot);

  info(`Auditing project: ${projectRoot}`);
  info(`Detected: ${frameworkLegacy.type} (${frameworkLegacy.language})`);

  const spin = spinner('Running deep discovery...').start();

  try {
    // Run new discovery system
    spin.text = 'Discovering project structure...';
    const discovery = await discoverProject(projectRoot);

    spin.text = 'Generating test suite...';
    const generatedTests = await generateTests(discovery);

    spin.succeed('Discovery complete');

    // Save discovery.json
    const configDir = path.join(projectRoot, CONFIG_DIR);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(configDir, 'discovery.json'),
      JSON.stringify(discovery, null, 2)
    );

    // Save generated-tests.json
    fs.writeFileSync(
      path.join(configDir, 'generated-tests.json'),
      JSON.stringify(generatedTests, null, 2)
    );

    // Also run legacy audit for backward compatibility
    const legacyAudit = await runLegacyAudit(projectRoot, frameworkLegacy);

    // Save legacy features.json and features.md
    fs.writeFileSync(
      path.join(configDir, 'features.json'),
      JSON.stringify(legacyAudit, null, 2)
    );

    const report = generateReport(legacyAudit, discovery, generatedTests);
    fs.writeFileSync(path.join(configDir, 'features.md'), report);

    // Display summary
    console.log('');
    console.log(chalk.bold.white('Discovery Summary'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log('');

    // Framework
    console.log(chalk.cyan('Framework:'));
    console.log(`  Frontend:  ${discovery.framework?.frontend || 'none'}`);
    console.log(`  Backend:   ${discovery.framework?.backend || 'none'}`);
    console.log(`  Database:  ${Array.isArray(discovery.framework?.database) ? discovery.framework.database.join(', ') : discovery.framework?.database || 'none'}`);
    console.log('');

    // Auth
    console.log(chalk.cyan('Authentication:'));
    console.log(`  Type:      ${discovery.auth?.type || 'none'}`);
    console.log(`  Login:     ${discovery.auth?.loginEndpoint || 'not found'}`);
    console.log(`  OAuth:     ${discovery.auth?.oauthProviders?.length || 0} providers`);
    console.log('');

    // API
    console.log(chalk.cyan('API:'));
    console.log(`  Endpoints: ${discovery.api?.endpoints?.length || 0}`);
    console.log(`  Schemas:   ${Object.keys(discovery.api?.schemas || {}).length}`);
    console.log(`  Base Path: ${discovery.api?.basePath || '/api'}`);
    console.log('');

    // Models
    console.log(chalk.cyan('Models:'));
    console.log(`  Entities:      ${discovery.models?.entities?.length || 0}`);
    console.log(`  Relationships: ${discovery.models?.relationships?.length || 0}`);
    console.log(`  Enums:         ${discovery.models?.enums?.length || 0}`);
    console.log('');

    // UI Routes
    console.log(chalk.cyan('UI Routes:'));
    console.log(`  Total:     ${discovery.ui?.routes?.length || 0}`);
    console.log(`  Protected: ${discovery.ui?.routes?.filter(r => r.auth)?.length || 0}`);
    console.log(`  Layouts:   ${discovery.ui?.layouts?.length || 0}`);
    console.log('');

    // Generated Tests
    const stats = getTestStats(generatedTests);
    console.log(chalk.cyan('Generated Tests:'));
    console.log(`  Auth Tests:  ${stats.byType.auth}`);
    console.log(`  API Tests:   ${stats.byType.api}`);
    console.log(`  UI Tests:    ${stats.byType.ui}`);
    console.log(`  Flow Tests:  ${stats.byType.flows}`);
    console.log(`  ${chalk.bold(`Total:       ${stats.total}`)}`);
    console.log('');

    // Legacy features
    console.log(chalk.cyan('Features (Legacy):'));
    const statusCounts = { complete: 0, partial: 0, missing: 0 };
    legacyAudit.features.forEach(f => statusCounts[f.status]++);
    console.log(`  Complete:  ${chalk.green(statusCounts.complete)}`);
    console.log(`  Partial:   ${chalk.yellow(statusCounts.partial)}`);
    console.log(`  Missing:   ${chalk.red(statusCounts.missing)}`);
    console.log('');

    console.log(chalk.gray('─'.repeat(60)));
    success(`Discovery saved to ${CONFIG_DIR}/discovery.json`);
    success(`Tests saved to ${CONFIG_DIR}/generated-tests.json`);
    success(`Report saved to ${CONFIG_DIR}/features.md`);
    console.log('');
    info('Run "devloop qa" to execute generated tests');
    info('Run "devloop qa --generate" to regenerate tests');

  } catch (err) {
    spin.fail('Audit failed');
    error(err.message);
    if (options.verbose) {
      console.error(err.stack);
    }
  }
}

async function runLegacyAudit(projectRoot, framework) {
  const audit = {
    projectRoot,
    framework,
    timestamp: new Date().toISOString(),
    frontend: { pages: [], components: [], routes: [] },
    backend: { endpoints: [], models: [] },
    features: [],
  };

  // Discover frontend
  audit.frontend = await discoverFrontend(projectRoot, framework);

  // Discover backend
  audit.backend = await discoverBackend(projectRoot, framework);

  // Build feature matrix
  audit.features = buildFeatureMatrix(audit.frontend, audit.backend);

  return audit;
}

async function discoverFrontend(projectRoot, framework) {
  const result = { pages: [], components: [], routes: [] };

  // Common frontend paths
  const frontendPaths = [
    'src/pages',
    'src/app',
    'apps/web/src/pages',
    'apps/web/src/app',
    'frontend/src/pages',
    'packages/web/src/pages',
    'pages',
  ];

  const componentPaths = [
    'src/components',
    'apps/web/src/components',
    'frontend/src/components',
    'packages/web/src/components',
    'components',
  ];

  // Find pages
  for (const pagePath of frontendPaths) {
    const fullPath = path.join(projectRoot, pagePath);
    if (fs.existsSync(fullPath)) {
      const files = await glob('**/*.{tsx,jsx,ts,js}', {
        cwd: fullPath,
        ignore: ['**/*.test.*', '**/*.spec.*', '**/index.*'],
      });

      for (const file of files) {
        const name = path.basename(file, path.extname(file));
        const route = fileToRoute(file);
        result.pages.push({
          name,
          file: path.join(pagePath, file),
          route,
          type: detectPageType(name),
        });
      }
      break;
    }
  }

  // Find components
  for (const compPath of componentPaths) {
    const fullPath = path.join(projectRoot, compPath);
    if (fs.existsSync(fullPath)) {
      const files = await glob('**/*.{tsx,jsx,ts,js}', {
        cwd: fullPath,
        ignore: ['**/*.test.*', '**/*.spec.*', '**/index.*'],
      });

      for (const file of files) {
        const name = path.basename(file, path.extname(file));
        result.components.push({
          name,
          file: path.join(compPath, file),
          type: detectComponentType(name),
        });
      }
      break;
    }
  }

  // Extract routes from router config
  const routerFiles = [
    'src/App.tsx', 'src/App.jsx',
    'src/router.tsx', 'src/router.ts',
    'apps/web/src/App.tsx',
    'apps/web/src/main.tsx',
  ];

  for (const routerFile of routerFiles) {
    const fullPath = path.join(projectRoot, routerFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const routes = extractRoutes(content);
      result.routes.push(...routes);
      break;
    }
  }

  return result;
}

async function discoverBackend(projectRoot, framework) {
  const result = { endpoints: [], models: [] };

  // Python/FastAPI paths
  const apiPaths = [
    'app/api',
    'api/app/api',
    'backend/app/api',
    'src/api',
  ];

  const modelPaths = [
    'app/models',
    'api/app/models',
    'backend/app/models',
    'src/models',
  ];

  // Find API endpoints
  for (const apiPath of apiPaths) {
    const fullPath = path.join(projectRoot, apiPath);
    if (fs.existsSync(fullPath)) {
      const files = await glob('**/*.py', {
        cwd: fullPath,
        ignore: ['**/__pycache__/**', '**/test_*', '**/*_test.py'],
      });

      for (const file of files) {
        const filePath = path.join(fullPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const endpoints = extractPythonEndpoints(content, file);
        result.endpoints.push(...endpoints);
      }
      break;
    }
  }

  // Also check for Express/Node.js endpoints
  const expressApiPaths = [
    'src/routes',
    'routes',
    'api/routes',
    'server/routes',
  ];

  for (const apiPath of expressApiPaths) {
    const fullPath = path.join(projectRoot, apiPath);
    if (fs.existsSync(fullPath)) {
      const files = await glob('**/*.{js,ts}', {
        cwd: fullPath,
        ignore: ['**/*.test.*', '**/*.spec.*'],
      });

      for (const file of files) {
        const filePath = path.join(fullPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const endpoints = extractExpressEndpoints(content, file);
        result.endpoints.push(...endpoints);
      }
      break;
    }
  }

  // Find models
  for (const modelPath of modelPaths) {
    const fullPath = path.join(projectRoot, modelPath);
    if (fs.existsSync(fullPath)) {
      const files = await glob('**/*.py', {
        cwd: fullPath,
        ignore: ['**/__pycache__/**', '__init__.py'],
      });

      for (const file of files) {
        const name = path.basename(file, '.py');
        if (name !== '__init__') {
          result.models.push({
            name: toPascalCase(name),
            file: path.join(modelPath, file),
          });
        }
      }
      break;
    }
  }

  return result;
}

function extractPythonEndpoints(content, file) {
  const endpoints = [];

  // Match FastAPI/Flask decorators
  const decoratorRegex = /@(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/gi;
  let match;

  while ((match = decoratorRegex.exec(content)) !== null) {
    endpoints.push({
      method: match[1].toUpperCase(),
      path: match[2],
      file,
    });
  }

  return endpoints;
}

function extractExpressEndpoints(content, file) {
  const endpoints = [];

  // Match Express routes
  const routeRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    endpoints.push({
      method: match[1].toUpperCase(),
      path: match[2],
      file,
    });
  }

  return endpoints;
}

function extractRoutes(content) {
  const routes = [];

  // React Router v6 style
  const routeRegex = /<Route[^>]*path=["']([^"']+)["'][^>]*(?:element=\{<(\w+)|component=\{(\w+))/gi;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      path: match[1],
      component: match[2] || match[3],
    });
  }

  // Object-based routes
  const objectRouteRegex = /path:\s*["']([^"']+)["'][^}]*(?:element|component):\s*(?:<(\w+)|(\w+))/gi;
  while ((match = objectRouteRegex.exec(content)) !== null) {
    routes.push({
      path: match[1],
      component: match[2] || match[3],
    });
  }

  return routes;
}

function fileToRoute(file) {
  return '/' + file
    .replace(/\.(tsx|jsx|ts|js)$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/index$/, '')
    .replace(/\/$/, '');
}

function detectPageType(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('login') || nameLower.includes('auth') || nameLower.includes('register')) return 'auth';
  if (nameLower.includes('dashboard')) return 'dashboard';
  if (nameLower.includes('settings') || nameLower.includes('profile')) return 'settings';
  if (nameLower.includes('list') || nameLower.includes('table')) return 'list';
  if (nameLower.includes('detail') || nameLower.includes('view')) return 'detail';
  if (nameLower.includes('edit') || nameLower.includes('form')) return 'form';
  if (nameLower.includes('new') || nameLower.includes('create')) return 'create';
  return 'page';
}

function detectComponentType(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('modal')) return 'modal';
  if (nameLower.includes('form')) return 'form';
  if (nameLower.includes('card')) return 'card';
  if (nameLower.includes('list')) return 'list';
  if (nameLower.includes('button')) return 'button';
  if (nameLower.includes('input')) return 'input';
  if (nameLower.includes('table')) return 'table';
  if (nameLower.includes('nav')) return 'navigation';
  return 'component';
}

function buildFeatureMatrix(frontend, backend) {
  const features = [];
  const featureMap = new Map();

  // Group pages by feature
  for (const page of frontend.pages) {
    const featureName = inferFeatureName(page.name);
    if (!featureMap.has(featureName)) {
      featureMap.set(featureName, { frontend: [], backend: [] });
    }
    featureMap.get(featureName).frontend.push(page);
  }

  // Match backend endpoints to features
  for (const endpoint of backend.endpoints) {
    const featureName = inferFeatureFromEndpoint(endpoint.path);
    if (!featureMap.has(featureName)) {
      featureMap.set(featureName, { frontend: [], backend: [] });
    }
    featureMap.get(featureName).backend.push(endpoint);
  }

  // Build feature list
  for (const [name, data] of featureMap) {
    const hasFrontend = data.frontend.length > 0;
    const hasBackend = data.backend.length > 0;

    features.push({
      name,
      frontend: hasFrontend ? data.frontend.map(p => p.file).join(', ') : null,
      backend: hasBackend ? data.backend.map(e => `${e.method} ${e.path}`).join(', ') : null,
      status: hasFrontend && hasBackend ? 'complete' :
              hasFrontend || hasBackend ? 'partial' : 'missing',
      pages: data.frontend,
      endpoints: data.backend,
    });
  }

  return features.sort((a, b) => a.name.localeCompare(b.name));
}

function inferFeatureName(pageName) {
  const name = pageName
    .replace(/Page$/, '')
    .replace(/Detail$/, '')
    .replace(/List$/, '')
    .replace(/Edit$/, '')
    .replace(/New$/, '')
    .replace(/Create$/, '');

  return name.charAt(0).toUpperCase() + name.slice(1);
}

function inferFeatureFromEndpoint(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return 'Root';

  // Skip version prefix
  let index = 0;
  if (parts[0].match(/^v\d+$/)) index = 1;
  if (parts[0] === 'api') index = Math.max(index, 1);
  if (parts[index]?.match(/^v\d+$/)) index++;

  const name = parts[index] || 'Root';
  return toPascalCase(name.replace(/-/g, '_'));
}

function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function generateReport(audit, discovery, generatedTests) {
  const stats = getTestStats(generatedTests);

  let report = `# Project Audit Report

**Generated:** ${audit.timestamp}
**Project:** ${audit.projectRoot}

---

## Framework Discovery

| Component | Detected |
|-----------|----------|
| Frontend | ${discovery.framework?.frontend || 'none'} |
| Backend | ${discovery.framework?.backend || 'none'} |
| Database | ${Array.isArray(discovery.framework?.database) ? discovery.framework.database.join(', ') : discovery.framework?.database || 'none'} |
| Package Manager | ${discovery.framework?.packageManager || 'none'} |
| Monorepo | ${discovery.framework?.monorepo ? 'Yes' : 'No'} |

---

## Authentication

| Property | Value |
|----------|-------|
| Type | ${discovery.auth?.type || 'none'} |
| Login Endpoint | ${discovery.auth?.loginEndpoint || 'not found'} |
| Register Endpoint | ${discovery.auth?.registerEndpoint || 'not found'} |
| OAuth Providers | ${discovery.auth?.oauthProviders?.join(', ') || 'none'} |
| Credential Fields | ${discovery.auth?.credentialFields?.join(', ') || 'none'} |

---

## API Summary

| Metric | Count |
|--------|-------|
| Total Endpoints | ${discovery.api?.endpoints?.length || 0} |
| Schemas | ${Object.keys(discovery.api?.schemas || {}).length} |
| Base Path | ${discovery.api?.basePath || '/api'} |

### Endpoints by Method

`;

  // Count endpoints by method
  const methodCounts = {};
  for (const endpoint of discovery.api?.endpoints || []) {
    methodCounts[endpoint.method] = (methodCounts[endpoint.method] || 0) + 1;
  }
  for (const [method, count] of Object.entries(methodCounts)) {
    report += `- **${method}**: ${count}\n`;
  }

  report += `
---

## Data Models

| Metric | Count |
|--------|-------|
| Entities | ${discovery.models?.entities?.length || 0} |
| Relationships | ${discovery.models?.relationships?.length || 0} |
| Enums | ${discovery.models?.enums?.length || 0} |

### Entities

`;

  for (const entity of discovery.models?.entities || []) {
    report += `- **${entity.name}** (${entity.fields?.length || 0} fields)\n`;
  }

  report += `
---

## UI Routes

| Metric | Count |
|--------|-------|
| Total Routes | ${discovery.ui?.routes?.length || 0} |
| Protected Routes | ${discovery.ui?.routes?.filter(r => r.auth)?.length || 0} |
| Layouts | ${discovery.ui?.layouts?.length || 0} |

---

## Generated Tests Summary

| Test Type | Count |
|-----------|-------|
| Auth Tests | ${stats.byType.auth} |
| API Tests | ${stats.byType.api} |
| UI Tests | ${stats.byType.ui} |
| Flow Tests | ${stats.byType.flows} |
| **Total** | **${stats.total}** |

---

## Legacy Feature Matrix

| Feature | Frontend | Backend | Status |
|---------|----------|---------|--------|
`;

  for (const feature of audit.features) {
    const status = feature.status === 'complete' ? '✅ Complete' :
                   feature.status === 'partial' ? '⚠️ Partial' : '❌ Missing';
    const frontend = feature.frontend ? '✓' : '-';
    const backend = feature.backend ? '✓' : '-';
    report += `| ${feature.name} | ${frontend} | ${backend} | ${status} |\n`;
  }

  report += `
---

## API Endpoints

| Method | Path | File |
|--------|------|------|
`;

  for (const endpoint of discovery.api?.endpoints?.slice(0, 50) || []) {
    report += `| ${endpoint.method} | ${endpoint.path} | ${endpoint.file || '-'} |\n`;
  }

  if ((discovery.api?.endpoints?.length || 0) > 50) {
    report += `| ... | ... | ... |\n`;
    report += `\n*Showing first 50 of ${discovery.api?.endpoints?.length} endpoints*\n`;
  }

  report += `
---

## Next Steps

1. Run \`devloop qa\` to execute all generated tests
2. Run \`devloop qa --api-only\` for API tests only
3. Run \`devloop qa --ui-only\` for UI tests only
4. Check \`discovery.json\` for full discovery data
5. Check \`generated-tests.json\` for test definitions

---

*Generated by DevLoop CLI*
`;

  return report;
}
