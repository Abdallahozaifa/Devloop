import { generateCrudTests, generateAuthTests } from './crud-generator.js';
import { generateUiTests, generateFormTests } from './ui-generator.js';
import { generateFakeData, generateFakeEntity, generatePathParams, generateCredentials } from './data-faker.js';

/**
 * Main test generator - creates generated-tests.json from discovery.json
 */
export async function generateTests(discovery) {
  const result = {
    meta: {
      generatedAt: new Date().toISOString(),
      framework: discovery.framework,
      version: '1.0.0',
    },
    config: generateTestConfig(discovery),
    tests: {
      auth: [],
      api: [],
      ui: [],
      flows: [],
    },
    summary: {
      totalTests: 0,
      authTests: 0,
      apiTests: 0,
      uiTests: 0,
      flowTests: 0,
    },
  };

  // Generate auth tests first (needed for other tests)
  if (discovery.auth) {
    const authTests = generateAuthTests(discovery.auth);
    result.tests.auth = authTests;
    result.summary.authTests = authTests.length;
  }

  // Generate API/CRUD tests
  const crudTests = generateCrudTests(discovery);
  const apiTests = crudTests.filter(t => t.type === 'api' || !t.type);
  const crudFlows = crudTests.filter(t => t.type === 'crud_flow');

  result.tests.api = apiTests;
  result.tests.flows.push(...crudFlows);
  result.summary.apiTests = apiTests.length;

  // Generate UI tests
  const uiTests = generateUiTests(discovery);
  const formTests = generateFormTests(discovery);

  result.tests.ui = [...uiTests, ...formTests];
  result.summary.uiTests = result.tests.ui.length;

  // Calculate flow tests
  result.summary.flowTests = result.tests.flows.length;

  // Calculate total
  result.summary.totalTests =
    result.summary.authTests +
    result.summary.apiTests +
    result.summary.uiTests +
    result.summary.flowTests;

  return result;
}

/**
 * Generate test configuration from discovery
 */
function generateTestConfig(discovery) {
  const config = {
    baseUrl: '{{BASE_URL}}',
    apiUrl: '{{API_URL}}',
    timeout: 30000,
    retries: 1,
    parallel: false,
  };

  // Configure auth if discovered
  if (discovery.auth) {
    config.auth = {
      type: discovery.auth.type || 'jwt',
      tokenHeader: discovery.auth.tokenHeader || 'Authorization: Bearer {token}',
      loginEndpoint: discovery.auth.loginEndpoint,
      credentials: {
        email: '{{TEST_EMAIL}}',
        password: '{{TEST_PASSWORD}}',
      },
    };

    if (discovery.auth.credentialFields?.length) {
      config.auth.credentialFields = discovery.auth.credentialFields;
    }
  }

  // Configure API testing
  if (discovery.api?.basePath) {
    config.apiBasePath = discovery.api.basePath;
  }

  return config;
}

/**
 * Resolve test variables at runtime
 */
export function resolveTestVariables(test, context = {}) {
  const resolved = JSON.parse(JSON.stringify(test));

  // Replace path parameters
  if (resolved.pathParams) {
    for (const [key, value] of Object.entries(resolved.pathParams)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const varName = value.slice(2, -2);
        const parts = varName.split('.');

        let resolvedValue = context;
        for (const part of parts) {
          resolvedValue = resolvedValue?.[part];
        }

        if (resolvedValue !== undefined) {
          resolved.pathParams[key] = resolvedValue;
        }
      }
    }

    // Apply path params to path
    resolved.resolvedPath = resolved.path;
    for (const [key, value] of Object.entries(resolved.pathParams)) {
      resolved.resolvedPath = resolved.resolvedPath
        .replace(`{${key}}`, value)
        .replace(`:${key}`, value);
    }
  } else {
    resolved.resolvedPath = resolved.path;
  }

  return resolved;
}

/**
 * Build test execution plan
 */
export function buildExecutionPlan(generatedTests) {
  const plan = {
    phases: [],
    dependencies: new Map(),
  };

  // Phase 1: Auth tests (login to get token)
  if (generatedTests.tests.auth?.length) {
    plan.phases.push({
      name: 'Authentication',
      tests: generatedTests.tests.auth,
      parallel: false,
    });
  }

  // Phase 2: API smoke tests (public endpoints first)
  const publicApiTests = generatedTests.tests.api.filter(t => !t.auth);
  const protectedApiTests = generatedTests.tests.api.filter(t => t.auth);

  if (publicApiTests.length) {
    plan.phases.push({
      name: 'Public API Tests',
      tests: publicApiTests,
      parallel: true,
    });
  }

  // Phase 3: Protected API tests
  if (protectedApiTests.length) {
    plan.phases.push({
      name: 'Protected API Tests',
      tests: protectedApiTests,
      parallel: true,
      requiresAuth: true,
    });
  }

  // Phase 4: CRUD flows
  if (generatedTests.tests.flows?.length) {
    plan.phases.push({
      name: 'CRUD Flows',
      tests: generatedTests.tests.flows,
      parallel: false, // Flows must run sequentially
      requiresAuth: generatedTests.tests.flows.some(f => f.requiresAuth),
    });
  }

  // Phase 5: UI tests
  const publicUiTests = generatedTests.tests.ui.filter(t => !t.auth);
  const protectedUiTests = generatedTests.tests.ui.filter(t => t.auth);

  if (publicUiTests.length) {
    plan.phases.push({
      name: 'Public UI Tests',
      tests: publicUiTests,
      parallel: true,
    });
  }

  if (protectedUiTests.length) {
    plan.phases.push({
      name: 'Protected UI Tests',
      tests: protectedUiTests,
      parallel: true,
      requiresAuth: true,
    });
  }

  return plan;
}

/**
 * Get test statistics
 */
export function getTestStats(generatedTests) {
  const stats = {
    total: generatedTests.summary.totalTests,
    byType: {
      auth: generatedTests.summary.authTests,
      api: generatedTests.summary.apiTests,
      ui: generatedTests.summary.uiTests,
      flows: generatedTests.summary.flowTests,
    },
    byAuth: {
      public: 0,
      protected: 0,
    },
    entities: new Set(),
    endpoints: new Set(),
    routes: new Set(),
  };

  // Count by auth requirement
  for (const test of [...generatedTests.tests.auth, ...generatedTests.tests.api, ...generatedTests.tests.ui]) {
    if (test.auth) {
      stats.byAuth.protected++;
    } else {
      stats.byAuth.public++;
    }

    // Track entities
    if (test.entity) {
      stats.entities.add(test.entity);
    }

    // Track endpoints
    if (test.path) {
      stats.endpoints.add(`${test.method || 'GET'} ${test.path}`);
    }

    // Track routes
    if (test.route) {
      stats.routes.add(test.route);
    }
  }

  // For flows
  for (const flow of generatedTests.tests.flows) {
    if (flow.requiresAuth) {
      stats.byAuth.protected++;
    } else {
      stats.byAuth.public++;
    }

    if (flow.entity) {
      stats.entities.add(flow.entity);
    }

    for (const step of flow.steps || []) {
      if (step.path) {
        stats.endpoints.add(`${step.method || 'GET'} ${step.path}`);
      }
    }
  }

  stats.entities = stats.entities.size;
  stats.endpoints = stats.endpoints.size;
  stats.routes = stats.routes.size;

  return stats;
}

export {
  generateFakeData,
  generateFakeEntity,
  generatePathParams,
  generateCredentials,
  generateCrudTests,
  generateAuthTests,
  generateUiTests,
  generateFormTests,
};

export default {
  generateTests,
  resolveTestVariables,
  buildExecutionPlan,
  getTestStats,
};
