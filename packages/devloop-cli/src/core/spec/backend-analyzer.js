import chalk from 'chalk';
import { detectFramework, getExtractor } from '../../extractors/index.js';

/**
 * Analyzes backend code to extract API requirements (source of truth)
 * This is the foundation for backend-first spec generation.
 *
 * Delegates to framework-specific extractors from the extractors/ folder.
 */
export async function analyzeBackend(projectDir) {
  const backendInfo = {
    framework: null,
    language: null,
    endpoints: [],
    authMethods: [],
  };

  // Use the new extractor system
  const framework = await detectFramework(projectDir);

  if (!framework) {
    console.log(chalk.yellow('No supported backend framework detected.'));
    return backendInfo;
  }

  backendInfo.framework = framework;
  backendInfo.language = getLanguageForFramework(framework);

  const extractor = await getExtractor(projectDir, framework);

  if (!extractor) {
    console.log(
      chalk.yellow(`Framework '${framework}' detected but no extractor available yet.`)
    );
    return backendInfo;
  }

  // Extract routes using the framework-specific extractor
  const routes = await extractor.discoverRoutes();

  // Convert to the expected endpoint format
  backendInfo.endpoints = routes.map((route) => ({
    method: route.method,
    path: route.path,
    funcName: route.funcName,
    file: route.file,
    line: route.line,
    requiredHeaders: route.requiredHeaders || [],
    authType: route.authType,
    dependencies: route.dependencies || [],
    responseInfo: route.responseInfo || {},
    requestSchema: route.requestSchema,
  }));

  // Deduplicate endpoints
  const seen = new Set();
  backendInfo.endpoints = backendInfo.endpoints.filter((ep) => {
    const key = `${ep.method}:${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return backendInfo;
}

/**
 * Get the programming language for a framework
 */
function getLanguageForFramework(framework) {
  const languageMap = {
    fastapi: 'python',
    django: 'python',
    flask: 'python',
    starlette: 'python',
    express: 'javascript',
    fastify: 'javascript',
    koa: 'javascript',
    hapi: 'javascript',
    nestjs: 'typescript',
    hono: 'javascript',
    elysia: 'typescript',
    gin: 'go',
    echo: 'go',
    fiber: 'go',
    go: 'go',
    rails: 'ruby',
    sinatra: 'ruby',
    actix: 'rust',
    axum: 'rust',
    rocket: 'rust',
    'spring-boot': 'java',
  };
  return languageMap[framework] || null;
}

/**
 * Find and parse Pydantic schema files to extract required fields
 * This is the KEY to catching validation bugs!
 */
export async function extractPydanticSchemas(projectDir) {
  const extractor = await getExtractor(projectDir);

  if (!extractor) {
    return {};
  }

  return await extractor.extractSchemas();
}

/**
 * Extract backend requirements as structured data
 */
export function extractBackendRequirements(backendInfo) {
  const requirements = [];

  for (const endpoint of backendInfo.endpoints || []) {
    const req = {
      endpoint: endpoint.path,
      method: endpoint.method,
      file: endpoint.file,
      line: endpoint.line,
      headers: endpoint.requiredHeaders || [],
      authType: endpoint.authType,
      dependencies: endpoint.dependencies || [],
      responseInfo: endpoint.responseInfo || {},
      requestSchema: endpoint.requestSchema || null,
    };

    requirements.push(req);
  }

  return requirements;
}

/**
 * Print discovered backend requirements
 */
export function printBackendRequirements(requirements) {
  console.log(chalk.cyan('\n📡 Backend Requirements Discovered:\n'));

  const byAuth = {
    'portal-token': [],
    bearer: [],
    'api-key': [],
    none: [],
  };

  for (const req of requirements) {
    const auth = req.authType || 'none';
    if (!byAuth[auth]) byAuth[auth] = [];
    byAuth[auth].push(req);
  }

  for (const [authType, endpoints] of Object.entries(byAuth)) {
    if (endpoints.length === 0) continue;

    const authLabel =
      authType === 'none'
        ? 'Public (no auth)'
        : authType === 'portal-token'
          ? 'Portal Token (X-Portal-Token)'
          : authType === 'bearer'
            ? 'Bearer Token (Authorization)'
            : authType === 'api-key'
              ? 'API Key (X-API-Key)'
              : authType;

    console.log(chalk.white(`  ${authLabel}:`));

    for (const ep of endpoints) {
      console.log(chalk.gray(`    ${ep.method} ${ep.endpoint}`));
      if (ep.headers.length > 0) {
        const headerNames = ep.headers.map((h) => h.name).join(', ');
        console.log(chalk.gray(`      Required headers: ${headerNames}`));
      }
    }
    console.log('');
  }
}

/**
 * Find frontend paths that should be checked against backend requirements
 * (Kept for backwards compatibility)
 */
export async function findFrontendPaths(projectDir) {
  const { glob } = await import('glob');
  const frontendPaths = [];

  const patterns = [
    'apps/web/src/**/*.tsx',
    'apps/web/src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.ts',
    'frontend/**/*.tsx',
    'frontend/**/*.ts',
    'client/**/*.tsx',
    'client/**/*.ts',
  ];

  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        cwd: projectDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/dist/**'],
      });
      frontendPaths.push(...matches);
    } catch (e) {
      // Pattern didn't match
    }
  }

  return [...new Set(frontendPaths)];
}
