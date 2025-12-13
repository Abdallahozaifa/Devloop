import { generateFakeEntity, generatePathParams } from './data-faker.js';

/**
 * Generates CRUD tests for discovered entities
 */
export function generateCrudTests(discovery) {
  const tests = [];
  const { entities } = discovery.models || {};
  const { endpoints } = discovery.api || {};
  const { auth } = discovery;

  if (!entities?.length && !endpoints?.length) {
    return tests;
  }

  // Group endpoints by entity
  const endpointsByEntity = groupEndpointsByEntity(endpoints, entities);

  // Generate tests for each entity
  for (const entityName of Object.keys(endpointsByEntity)) {
    const entityEndpoints = endpointsByEntity[entityName];
    const entity = entities?.find(e => e.name.toLowerCase() === entityName.toLowerCase());

    const entityTests = generateEntityCrudTests(entityName, entityEndpoints, entity, auth);
    tests.push(...entityTests);
  }

  // Generate tests for endpoints without clear entity mapping
  const orphanEndpoints = endpoints?.filter(e => !isEntityEndpoint(e)) || [];
  for (const endpoint of orphanEndpoints) {
    const test = generateEndpointTest(endpoint, auth);
    tests.push(test);
  }

  return tests;
}

function groupEndpointsByEntity(endpoints = [], entities = []) {
  const groups = {};

  for (const endpoint of endpoints) {
    const entityName = inferEntityFromEndpoint(endpoint, entities);
    if (entityName) {
      if (!groups[entityName]) {
        groups[entityName] = [];
      }
      groups[entityName].push(endpoint);
    }
  }

  return groups;
}

function inferEntityFromEndpoint(endpoint, entities) {
  const pathParts = endpoint.path.split('/').filter(p => p && !p.startsWith('{') && !p.startsWith(':'));

  // Try to match path segment to entity name
  for (const part of pathParts) {
    // Check direct match with entities
    for (const entity of entities) {
      const entityLower = entity.name.toLowerCase();
      const partLower = part.toLowerCase();

      if (partLower === entityLower || partLower === entityLower + 's' || partLower === entityLower.replace(/y$/, 'ies')) {
        return entity.name;
      }
    }

    // Check if it's a common resource name
    const singularPart = part.replace(/s$/, '').replace(/ies$/, 'y');
    if (singularPart.length > 2) {
      return singularPart.charAt(0).toUpperCase() + singularPart.slice(1);
    }
  }

  return null;
}

function isEntityEndpoint(endpoint) {
  // Check if endpoint looks like it belongs to an entity
  const pathParts = endpoint.path.split('/').filter(p => p && !p.startsWith('{') && !p.startsWith(':'));
  return pathParts.some(p => p.length > 2 && !['api', 'v1', 'v2', 'auth', 'health', 'status'].includes(p.toLowerCase()));
}

function generateEntityCrudTests(entityName, endpoints, entity, auth) {
  const tests = [];
  const entityLower = entityName.toLowerCase();

  // Find CRUD endpoints
  const createEndpoint = endpoints.find(e => e.method === 'POST' && !e.path.includes('{'));
  const listEndpoint = endpoints.find(e => e.method === 'GET' && !e.path.includes('{'));
  const getEndpoint = endpoints.find(e => e.method === 'GET' && (e.path.includes('{') || e.path.includes(':')));
  const updateEndpoint = endpoints.find(e => (e.method === 'PUT' || e.method === 'PATCH') && (e.path.includes('{') || e.path.includes(':')));
  const deleteEndpoint = endpoints.find(e => e.method === 'DELETE' && (e.path.includes('{') || e.path.includes(':')));

  // Create a complete CRUD flow test
  // CRUD flows require auth if they have any write operations (POST/PUT/PATCH/DELETE)
  const hasWriteOps = endpoints.some(e => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method));
  const crudFlow = {
    name: `${entityName} CRUD Flow`,
    type: 'crud_flow',
    entity: entityName,
    requiresAuth: hasWriteOps || endpoints.some(e => e.auth),
    steps: [],
  };

  // Step 1: Create
  if (createEndpoint) {
    const createData = entity ? generateFakeEntity(entity) : generateGenericCreateData(entityName);
    crudFlow.steps.push({
      name: `Create ${entityName}`,
      method: createEndpoint.method,
      path: createEndpoint.path,
      auth: createEndpoint.auth,
      body: createData,
      expect: {
        status: [200, 201],
        hasId: true,
      },
      saveAs: entityLower,
    });
  }

  // Step 2: List
  if (listEndpoint) {
    crudFlow.steps.push({
      name: `List ${entityName}s`,
      method: listEndpoint.method,
      path: listEndpoint.path,
      auth: listEndpoint.auth,
      expect: {
        status: 200,
        isArray: true,
      },
    });
  }

  // Step 3: Get by ID
  if (getEndpoint) {
    crudFlow.steps.push({
      name: `Get ${entityName} by ID`,
      method: getEndpoint.method,
      path: getEndpoint.path,
      pathParams: { [`${entityLower}_id`]: `{{${entityLower}.id}}` },
      auth: getEndpoint.auth,
      dependsOn: createEndpoint ? `Create ${entityName}` : null,
      expect: {
        status: 200,
        matchesCreated: true,
      },
    });
  }

  // Step 4: Update
  if (updateEndpoint) {
    const updateData = entity
      ? { ...generateFakeEntity(entity), id: undefined }
      : generateGenericUpdateData(entityName);

    crudFlow.steps.push({
      name: `Update ${entityName}`,
      method: updateEndpoint.method,
      path: updateEndpoint.path,
      pathParams: { [`${entityLower}_id`]: `{{${entityLower}.id}}` },
      auth: updateEndpoint.auth,
      body: updateData,
      dependsOn: createEndpoint ? `Create ${entityName}` : null,
      expect: {
        status: 200,
      },
    });
  }

  // Step 5: Delete
  if (deleteEndpoint) {
    crudFlow.steps.push({
      name: `Delete ${entityName}`,
      method: deleteEndpoint.method,
      path: deleteEndpoint.path,
      pathParams: { [`${entityLower}_id`]: `{{${entityLower}.id}}` },
      auth: deleteEndpoint.auth,
      dependsOn: createEndpoint ? `Create ${entityName}` : null,
      expect: {
        status: [200, 204],
      },
    });
  }

  // Step 6: Verify deleted (404)
  if (deleteEndpoint && getEndpoint) {
    crudFlow.steps.push({
      name: `Verify ${entityName} deleted`,
      method: getEndpoint.method,
      path: getEndpoint.path,
      pathParams: { [`${entityLower}_id`]: `{{${entityLower}.id}}` },
      auth: getEndpoint.auth,
      dependsOn: `Delete ${entityName}`,
      expect: {
        status: 404,
      },
    });
  }

  if (crudFlow.steps.length > 0) {
    tests.push(crudFlow);
  }

  // Generate individual endpoint tests for non-standard endpoints
  for (const endpoint of endpoints) {
    if ([createEndpoint, listEndpoint, getEndpoint, updateEndpoint, deleteEndpoint].includes(endpoint)) {
      continue;
    }

    const test = generateEndpointTest(endpoint, auth, entity);
    tests.push(test);
  }

  return tests;
}

function generateEndpointTest(endpoint, auth, entity = null) {
  // Determine if endpoint requires auth:
  // For write operations (POST/PUT/PATCH/DELETE), ALWAYS assume auth required unless it's a public path
  // This overrides any auth: false that may have been set by discovery (which often doesn't detect auth properly)
  const publicPaths = ['/auth', '/login', '/register', '/health', '/healthz', '/ping', '/docs', '/openapi', '/status', '/public', '/webhook'];
  const isPublicPath = publicPaths.some(p => endpoint.path.toLowerCase().includes(p));

  let requiresAuth;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)) {
    // Write operations ALWAYS require auth unless explicitly public path
    requiresAuth = !isPublicPath;
  } else {
    // GET requests - use endpoint's auth flag or default to false
    requiresAuth = endpoint.auth || false;
  }

  const test = {
    name: `${endpoint.method} ${endpoint.path}`,
    type: 'api',
    method: endpoint.method,
    path: endpoint.path,
    auth: requiresAuth,
    expect: {
      status: endpoint.method === 'DELETE' ? [200, 204] : 200,
    },
  };

  // Add path parameters
  if (endpoint.parameters?.length) {
    const pathParams = endpoint.parameters.filter(p => p.in === 'path');
    if (pathParams.length) {
      test.pathParams = generatePathParams(pathParams);
    }

    const queryParams = endpoint.parameters.filter(p => p.in === 'query' && p.required);
    if (queryParams.length) {
      test.queryParams = {};
      for (const param of queryParams) {
        test.queryParams[param.name] = generateParamValue(param);
      }
    }
  }

  // Add request body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    if (endpoint.requestBody?.schema) {
      test.body = generateBodyFromSchema(endpoint.requestBody.schema);
    } else if (entity) {
      test.body = generateFakeEntity(entity);
    } else {
      test.body = generateGenericBody(endpoint);
    }
  }

  return test;
}

function generateParamValue(param) {
  switch (param.type) {
    case 'uuid':
      return '{{testId}}';
    case 'integer':
      return Math.floor(Math.random() * 100) + 1;
    case 'boolean':
      return true;
    default:
      return 'test-value';
  }
}

function generateBodyFromSchema(schema) {
  if (schema.$ref) {
    // Return placeholder, will be resolved at runtime
    return { _schemaRef: schema.$ref };
  }

  const body = {};
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      body[key] = generateValueForProperty(key, prop);
    }
  }

  return body;
}

function generateValueForProperty(name, prop) {
  const nameLower = name.toLowerCase();

  if (prop.enum) {
    return prop.enum[0];
  }

  if (nameLower.includes('email')) return 'test@devloop-test.com';
  if (nameLower.includes('password')) return 'TestPassword123!';
  if (nameLower.includes('name')) return 'Test Name';
  if (nameLower.includes('title')) return 'Test Title';
  if (nameLower.includes('description')) return 'Test description';

  switch (prop.type) {
    case 'string':
      return 'test-string';
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return 'test-value';
  }
}

function generateGenericCreateData(entityName) {
  const nameLower = entityName.toLowerCase();
  return {
    name: `Test ${entityName}`,
    description: `Test ${entityName} created by DevLoop`,
    ...(nameLower.includes('user') && { email: 'test@devloop-test.com', password: 'TestPassword123!' }),
  };
}

function generateGenericUpdateData(entityName) {
  return {
    name: `Updated ${entityName}`,
    description: `Updated ${entityName} by DevLoop`,
  };
}

function generateGenericBody(endpoint) {
  const pathParts = endpoint.path.split('/');
  const resourceName = pathParts.filter(p => p && !p.startsWith('{') && !p.startsWith(':') && !['api', 'v1', 'v2'].includes(p)).pop() || 'item';

  return {
    name: `Test ${resourceName}`,
    description: `Test ${resourceName} from DevLoop`,
  };
}

/**
 * Generate auth-related tests
 */
export function generateAuthTests(auth) {
  const tests = [];

  if (!auth?.type) {
    return tests;
  }

  // Login test
  if (auth.loginEndpoint) {
    const [method, path] = auth.loginEndpoint.split(' ');
    // Normalize path: if it's just /login or /register, prefix with /auth
    let normalizedPath = path || '/auth/login';
    if (normalizedPath === '/login') {
      normalizedPath = '/auth/login';
    }
    tests.push({
      name: 'Login',
      type: 'auth',
      method: method || 'POST',
      path: normalizedPath,
      body: generateAuthCredentials(auth.credentialFields),
      expect: {
        status: 200,
        hasToken: auth.type === 'jwt',
      },
      saveAs: 'auth',
    });
  }

  // Register test
  if (auth.registerEndpoint) {
    const [method, path] = auth.registerEndpoint.split(' ');
    // Normalize path: if it's just /login or /register, prefix with /auth
    let normalizedPath = path || '/auth/register';
    if (normalizedPath === '/register') {
      normalizedPath = '/auth/register';
    }
    tests.push({
      name: 'Register',
      type: 'auth',
      method: method || 'POST',
      path: normalizedPath,
      body: {
        ...generateAuthCredentials(auth.credentialFields),
        name: 'Test User',
      },
      expect: {
        status: [200, 201],
      },
    });
  }

  // Logout test
  if (auth.logoutEndpoint) {
    const [method, path] = auth.logoutEndpoint.split(' ');
    tests.push({
      name: 'Logout',
      type: 'auth',
      method: method || 'POST',
      path: path || '/auth/logout',
      auth: true,
      dependsOn: 'Login',
      expect: {
        status: [200, 204],
      },
    });
  }

  // Token refresh test
  if (auth.refreshEndpoint) {
    const [method, path] = auth.refreshEndpoint.split(' ');
    tests.push({
      name: 'Refresh Token',
      type: 'auth',
      method: method || 'POST',
      path: path || '/auth/refresh',
      auth: true,
      dependsOn: 'Login',
      expect: {
        status: 200,
        hasToken: true,
      },
    });
  }

  return tests;
}

function generateAuthCredentials(credentialFields = ['email', 'password']) {
  const creds = {};

  // Always include password for login/register - discovery often misses it
  const fieldsToGenerate = [...credentialFields];
  if (!fieldsToGenerate.some(f => f.toLowerCase().includes('password'))) {
    fieldsToGenerate.push('password');
  }

  for (const field of fieldsToGenerate) {
    const fieldLower = field.toLowerCase();
    if (fieldLower.includes('email')) {
      creds[field] = `test_${Date.now()}@devloop-test.com`;
    } else if (fieldLower.includes('password')) {
      creds[field] = 'TestPassword123!';
    } else if (fieldLower.includes('username')) {
      creds[field] = `testuser_${Date.now()}`;
    } else {
      creds[field] = 'test-value';
    }
  }

  return creds;
}

export default {
  generateCrudTests,
  generateAuthTests,
};
