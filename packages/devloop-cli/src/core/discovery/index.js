import { detectFramework } from './framework-detector.js';
import { discoverAuth } from './auth-discoverer.js';
import { extractSchema } from './schema-extractor.js';
import { parseModels } from './model-parser.js';
import { scanRoutes } from './route-scanner.js';

/**
 * Main discovery function - analyzes a project and returns discovery.json
 */
export async function discoverProject(projectRoot) {
  const discovery = {
    meta: {
      discoveredAt: new Date().toISOString(),
      projectRoot,
      version: '1.0.0',
    },
    framework: null,
    auth: null,
    api: null,
    models: null,
    ui: null,
  };

  console.log('  Detecting framework...');
  // Step 1: Detect framework
  discovery.framework = await detectFramework(projectRoot);

  console.log('  Discovering auth patterns...');
  // Step 2: Discover auth patterns
  discovery.auth = await discoverAuth(projectRoot, discovery.framework);

  console.log('  Extracting API schema...');
  // Step 3: Extract API schema
  discovery.api = await extractSchema(projectRoot, discovery.framework);

  console.log('  Parsing models...');
  // Step 4: Parse database models
  discovery.models = await parseModels(projectRoot, discovery.framework);

  console.log('  Scanning UI routes...');
  // Step 5: Scan UI routes
  discovery.ui = await scanRoutes(projectRoot, discovery.framework);

  // Add summary statistics
  discovery.summary = generateSummary(discovery);

  return discovery;
}

/**
 * Generate summary statistics
 */
function generateSummary(discovery) {
  return {
    framework: {
      frontend: discovery.framework?.frontend || 'unknown',
      backend: discovery.framework?.backend || 'unknown',
      database: discovery.framework?.database || 'unknown',
    },
    auth: {
      type: discovery.auth?.type || 'unknown',
      hasLogin: !!discovery.auth?.loginEndpoint,
      hasRegister: !!discovery.auth?.registerEndpoint,
      oauthProviders: discovery.auth?.oauthProviders?.length || 0,
    },
    api: {
      endpoints: discovery.api?.endpoints?.length || 0,
      schemas: Object.keys(discovery.api?.schemas || {}).length,
      basePath: discovery.api?.basePath || '/api',
    },
    models: {
      entities: discovery.models?.entities?.length || 0,
      relationships: discovery.models?.relationships?.length || 0,
      enums: discovery.models?.enums?.length || 0,
    },
    ui: {
      routes: discovery.ui?.routes?.length || 0,
      layouts: discovery.ui?.layouts?.length || 0,
      protectedRoutes: discovery.ui?.routes?.filter(r => r.auth)?.length || 0,
    },
  };
}

/**
 * Quick summary for console output
 */
export function printDiscoverySummary(discovery) {
  const s = discovery.summary;

  console.log('\n--- Discovery Summary ---\n');

  console.log('Framework:');
  console.log(`  Frontend: ${s.framework.frontend}`);
  console.log(`  Backend: ${s.framework.backend}`);
  console.log(`  Database: ${Array.isArray(s.framework.database) ? s.framework.database.join(', ') : s.framework.database}`);

  console.log('\nAuthentication:');
  console.log(`  Type: ${s.auth.type}`);
  console.log(`  Login: ${s.auth.hasLogin ? 'Yes' : 'No'}`);
  console.log(`  Register: ${s.auth.hasRegister ? 'Yes' : 'No'}`);
  if (s.auth.oauthProviders > 0) {
    console.log(`  OAuth Providers: ${s.auth.oauthProviders}`);
  }

  console.log('\nAPI:');
  console.log(`  Endpoints: ${s.api.endpoints}`);
  console.log(`  Schemas: ${s.api.schemas}`);
  console.log(`  Base Path: ${s.api.basePath}`);

  console.log('\nModels:');
  console.log(`  Entities: ${s.models.entities}`);
  console.log(`  Relationships: ${s.models.relationships}`);
  console.log(`  Enums: ${s.models.enums}`);

  console.log('\nUI:');
  console.log(`  Routes: ${s.ui.routes}`);
  console.log(`  Protected Routes: ${s.ui.protectedRoutes}`);
  console.log(`  Layouts: ${s.ui.layouts}`);

  console.log('\n-------------------------\n');
}

export {
  detectFramework,
  discoverAuth,
  extractSchema,
  parseModels,
  scanRoutes,
};

export default {
  discoverProject,
  printDiscoverySummary,
};
