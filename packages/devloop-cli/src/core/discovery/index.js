import { detectFramework, getExtractor } from '../../extractors/index.js';
import { extractSchema } from './schema-extractor.js';
import { scanRoutes } from './route-scanner.js';

/**
 * Main discovery function - analyzes a project and returns discovery.json
 *
 * Uses the new extractors system for framework detection and API extraction,
 * while keeping the route scanner for UI route discovery.
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
  // Step 1: Detect framework using the new extractor system
  const detectedFramework = await detectFramework(projectRoot);
  discovery.framework = {
    backend: detectedFramework || 'unknown',
    frontend: 'unknown', // Will be detected by route scanner if present
    database: 'unknown',
  };

  // Get extractor for the detected framework
  const extractor = await getExtractor(projectRoot, detectedFramework);

  console.log('  Discovering auth patterns...');
  // Step 2: Discover auth patterns using the extractor
  if (extractor) {
    const routes = await extractor.discoverRoutes();
    const authTypes = new Set();
    for (const route of routes) {
      if (route.authType) {
        authTypes.add(route.authType);
      }
    }
    discovery.auth = {
      type: authTypes.size > 0 ? Array.from(authTypes).join(', ') : 'none',
      loginEndpoint: routes.find((r) => r.path.includes('login'))?.path || null,
      registerEndpoint: routes.find((r) => r.path.includes('register'))?.path || null,
      oauthProviders: [],
    };
  } else {
    discovery.auth = {
      type: 'unknown',
      loginEndpoint: null,
      registerEndpoint: null,
      oauthProviders: [],
    };
  }

  console.log('  Extracting API schema...');
  // Step 3: Extract API schema using schema-extractor (which delegates to extractors)
  discovery.api = await extractSchema(projectRoot, discovery.framework);

  console.log('  Parsing models...');
  // Step 4: Parse database models using the extractor
  if (extractor) {
    const schemas = await extractor.extractSchemas();
    discovery.models = {
      entities: Object.keys(schemas).map((name) => ({
        name,
        file: schemas[name].file,
        fields: [
          ...schemas[name].requiredFields.map((f) => ({ ...f, required: true })),
          ...schemas[name].optionalFields.map((f) => ({ ...f, required: false })),
        ],
      })),
      relationships: [],
      enums: [],
    };
  } else {
    discovery.models = {
      entities: [],
      relationships: [],
      enums: [],
    };
  }

  console.log('  Scanning UI routes...');
  // Step 5: Scan UI routes (using route-scanner for frontend routes)
  discovery.ui = await scanRoutes(projectRoot, discovery.framework);

  // Detect frontend framework from UI routes
  if (discovery.ui?.framework) {
    discovery.framework.frontend = discovery.ui.framework;
  }

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
      protectedRoutes: discovery.ui?.routes?.filter((r) => r.auth)?.length || 0,
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
  console.log(
    `  Database: ${Array.isArray(s.framework.database) ? s.framework.database.join(', ') : s.framework.database}`
  );

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

// Re-export from extractors for backwards compatibility
export { detectFramework, getExtractor } from '../../extractors/index.js';
export { extractSchema } from './schema-extractor.js';
export { scanRoutes } from './route-scanner.js';

export default {
  discoverProject,
  printDiscoverySummary,
};
