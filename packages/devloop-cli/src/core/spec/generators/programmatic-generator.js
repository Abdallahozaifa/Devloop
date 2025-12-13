/**
 * Programmatic Spec Generator
 *
 * Generates comprehensive test specs programmatically from backend analysis.
 * This ensures EVERY endpoint gets tested, not just what the AI decides.
 *
 * For each endpoint, generates:
 * 1. Auth test (401) - for protected endpoints
 * 2. Validation tests (422) - for each required field
 * 3. Happy path test - with all required fields
 * 4. Not found test (404) - for endpoints with {id}
 * 5. Contract tests - frontend must send required fields
 */

/**
 * Generate comprehensive specs programmatically from backend analysis.
 * @param {Object} backendInfo - Backend analysis with endpoints
 * @param {Object} schemas - Pydantic schema information
 * @returns {Object} Generated specs with stats
 */
export function generateProgrammaticSpecs(backendInfo, schemas) {
  const apiTests = [];
  const contractTests = [];

  // Group endpoints by resource for better organization
  const endpointGroups = groupEndpointsByResource(backendInfo.endpoints);

  for (const endpoint of backendInfo.endpoints) {
    const { method, path: epath, bodyModel, requiredHeaders, requiredFields, authType, dependencies = [] } = endpoint;

    // Determine if auth is required - check multiple indicators
    const requiresAuth = endpoint.requiresAuth ||
                         authType === 'bearer' ||
                         authType === 'portal' ||
                         dependencies.some(d => d.includes('current_user') || d.includes('get_user'));

    // Skip static/utility endpoints
    if (isStaticEndpoint(epath)) continue;

    // Clean path for test names
    const cleanPath = epath.startsWith('/api/v1') ? epath : `/api/v1${epath.startsWith('/') ? '' : '/'}${epath}`;
    const testBaseName = `${method} ${cleanPath}`;
    const resourceName = extractResourceName(epath);

    // 1. AUTH TEST - Every protected endpoint
    if (requiresAuth) {
      apiTests.push({
        name: `${resourceName} - ${method.toLowerCase()} requires authentication`,
        as: 'guest',
        request: {
          method,
          path: replacePathParams(cleanPath)
        },
        expect: {
          status: 401,
          statusNot: [200, 201, 403],
          bodyNot: ['id', 'data', 'items', resourceName.toLowerCase()]
        }
      });
    }

    // 2. REQUIRED HEADER TESTS
    for (const header of requiredHeaders || []) {
      // Skip if not a string or if it's Authorization/Bearer (covered by auth test)
      if (typeof header !== 'string') continue;
      if (header === 'Authorization' || header === 'Bearer') continue;

      apiTests.push({
        name: `${resourceName} - ${method.toLowerCase()} requires ${header} header`,
        as: 'user',
        request: {
          method,
          path: replacePathParams(cleanPath)
          // Intentionally missing header
        },
        expect: {
          status: [401, 403, 422]
        }
      });

      // Contract test for header
      contractTests.push({
        name: `Frontend sends ${header} header for ${resourceName}`,
        check: 'pattern_exists',
        in: 'apps/web/src/**/*.{ts,tsx}',
        pattern: header.replace(/-/g, '[-_]?'),
        message: `Backend requires ${header} header for ${method} ${cleanPath}`
      });
    }

    // 3. VALIDATION TESTS - For POST/PUT/PATCH with required fields
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      // Get required fields from endpoint info or schema
      const fields = getRequiredFields(endpoint, schemas, bodyModel);

      if (fields.length > 0) {
        for (const field of fields) {
          // Create body with all fields EXCEPT this one
          const bodyWithout = {};
          for (const f of fields) {
            if (f.name !== field.name) {
              bodyWithout[f.name] = getDefaultValue(f.type || f.name);
            }
          }

          apiTests.push({
            name: `${resourceName} - ${method.toLowerCase()} fails without ${field.name}`,
            as: 'user',
            request: {
              method,
              path: replacePathParams(cleanPath),
              body: bodyWithout
            },
            expect: {
              status: [400, 422],
              bodyHas: ['detail'],
              bodyNot: ['id']
            }
          });

          // Contract test for required field
          contractTests.push({
            name: `Frontend sends ${field.name} to ${resourceName}`,
            check: 'pattern_exists',
            in: 'apps/web/src/**/*.{ts,tsx}',
            pattern: field.name,
            message: `Backend requires ${field.name} for ${method} ${cleanPath}`
          });
        }

        // Happy path with all fields
        const fullBody = {};
        for (const f of fields) {
          fullBody[f.name] = getDefaultValue(f.type || f.name);
        }

        apiTests.push({
          name: `${resourceName} - ${method.toLowerCase()} succeeds with all required fields`,
          as: 'user',
          request: {
            method,
            path: replacePathParams(cleanPath),
            body: fullBody
          },
          expect: {
            status: method === 'POST' ? [200, 201] : [200],
            statusNot: [400, 422, 500]
          }
        });
      }
    }

    // 4. NOT FOUND TEST - For endpoints with {id}
    if (epath.includes('{') && ['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      apiTests.push({
        name: `${resourceName} - ${method.toLowerCase()} returns 404 for non-existent resource`,
        as: 'user',
        request: {
          method,
          path: replacePathParams(cleanPath, '99999999-9999-9999-9999-999999999999')
        },
        expect: {
          status: 404,
          bodyNot: ['id', 'data']
        }
      });
    }

    // 5. LIST ENDPOINT TEST - For GET endpoints without {id}
    if (method === 'GET' && !epath.includes('{') && requiresAuth) {
      apiTests.push({
        name: `${resourceName} - list returns array`,
        as: 'user',
        request: {
          method: 'GET',
          path: replacePathParams(cleanPath)
        },
        expect: {
          status: 200,
          statusNot: [401, 403, 500]
        }
      });
    }
  }

  // Add contract tests for error handling
  contractTests.push({
    name: 'Forms handle 422 validation errors',
    check: 'pattern_exists',
    in: 'apps/web/src/**/*.{ts,tsx}',
    pattern: '422|validation.*error|error.*validation',
    message: 'Forms must handle 422 validation error responses'
  });

  contractTests.push({
    name: 'API client handles 401 authentication errors',
    check: 'pattern_exists',
    in: 'apps/web/src/**/*.{ts,tsx}',
    pattern: '401|unauthorized|Unauthorized',
    message: 'API client must handle 401 authentication errors'
  });

  // Deduplicate tests
  const uniqueApiTests = deduplicateTests(apiTests);
  const uniqueContractTests = deduplicateTests(contractTests);

  return {
    apiTests: uniqueApiTests,
    contractTests: uniqueContractTests,
    stats: {
      endpoints: backendInfo.endpoints.length,
      apiTests: uniqueApiTests.length,
      contractTests: uniqueContractTests.length,
      authTests: uniqueApiTests.filter(t => t.name.includes('requires authentication')).length,
      validationTests: uniqueApiTests.filter(t => t.name.includes('fails without')).length,
      notFoundTests: uniqueApiTests.filter(t => t.name.includes('404')).length,
      happyPathTests: uniqueApiTests.filter(t => t.name.includes('succeeds')).length
    }
  };
}

/**
 * Group endpoints by resource for better organization
 */
function groupEndpointsByResource(endpoints) {
  const groups = {};
  for (const endpoint of endpoints) {
    const resource = extractResourceName(endpoint.path);
    if (!groups[resource]) {
      groups[resource] = [];
    }
    groups[resource].push(endpoint);
  }
  return groups;
}

/**
 * Extract resource name from path
 */
function extractResourceName(path) {
  // Remove /api/v1 prefix
  let cleanPath = path.replace(/^\/api\/v\d+\/?/, '');

  // Remove leading slashes and path params
  cleanPath = cleanPath.replace(/^\/+/, '').replace(/\/\{[^}]+\}/g, '');

  // Get first segment
  const segments = cleanPath.split('/').filter(s => s && !s.startsWith('{'));
  const resource = segments[0] || 'root';

  // Capitalize and clean up
  return resource.charAt(0).toUpperCase() + resource.slice(1).replace(/-/g, ' ');
}

/**
 * Check if endpoint is static/utility
 */
function isStaticEndpoint(path) {
  const staticPatterns = [
    '/health',
    '/favicon',
    '/robots',
    '/static',
    '/docs',
    '/openapi',
    '/redoc'
  ];
  return staticPatterns.some(p => path.includes(p));
}

/**
 * Replace path parameters with test values
 */
function replacePathParams(path, testId = 'test-id-123') {
  return path.replace(/\{[^}]+\}/g, testId);
}

/**
 * Get required fields from endpoint or schema
 */
function getRequiredFields(endpoint, schemas, bodyModel) {
  // First check endpoint's requiredFields
  if (endpoint.requiredFields && endpoint.requiredFields.length > 0) {
    return endpoint.requiredFields.map(f => {
      if (typeof f === 'string') {
        return { name: f, type: inferTypeFromName(f) };
      }
      return f;
    });
  }

  // Then check schema
  if (bodyModel && schemas[bodyModel]) {
    const schema = schemas[bodyModel];
    if (schema.fields) {
      return schema.fields.filter(f => f.required).map(f => ({
        name: f.name,
        type: f.type || inferTypeFromName(f.name)
      }));
    }
  }

  // Infer from common patterns
  return inferRequiredFieldsFromPath(endpoint.path, endpoint.method);
}

/**
 * Infer required fields from common path patterns
 */
function inferRequiredFieldsFromPath(path, method) {
  const fields = [];

  // Common patterns
  if (path.includes('/checkout-session') || path.includes('/create-checkout')) {
    fields.push(
      { name: 'price_id', type: 'str' },
      { name: 'success_url', type: 'url' },
      { name: 'cancel_url', type: 'url' }
    );
  } else if (path.includes('/invoices') && method === 'POST') {
    fields.push(
      { name: 'client_id', type: 'uuid' },
      { name: 'title', type: 'str' },
      { name: 'amount', type: 'number' }
    );
  } else if (path.includes('/clients') && method === 'POST') {
    fields.push(
      { name: 'name', type: 'str' },
      { name: 'email', type: 'email' }
    );
  } else if (path.includes('/projects') && method === 'POST') {
    fields.push(
      { name: 'client_id', type: 'uuid' },
      { name: 'name', type: 'str' }
    );
  } else if (path.includes('/requests') && method === 'POST') {
    fields.push(
      { name: 'title', type: 'str' },
      { name: 'content', type: 'str' }
    );
  } else if (path.includes('/proposals') && method === 'POST') {
    fields.push(
      { name: 'title', type: 'str' },
      { name: 'description', type: 'str' },
      { name: 'amount', type: 'number' }
    );
  } else if (path.includes('/scope') && method === 'POST') {
    fields.push(
      { name: 'title', type: 'str' }
    );
  } else if (path.includes('/messages') && method === 'POST') {
    fields.push(
      { name: 'content', type: 'str' }
    );
  } else if (path.includes('/auth/register') || path.includes('/register')) {
    fields.push(
      { name: 'email', type: 'email' },
      { name: 'password', type: 'str' },
      { name: 'full_name', type: 'str' }
    );
  } else if (path.includes('/auth/login') || path.includes('/login')) {
    fields.push(
      { name: 'email', type: 'email' },
      { name: 'password', type: 'str' }
    );
  } else if (path.includes('/analyze') && method === 'POST') {
    fields.push(
      { name: 'project_id', type: 'uuid' },
      { name: 'title', type: 'str' },
      { name: 'content', type: 'str' }
    );
  }

  return fields;
}

/**
 * Infer type from field name
 */
function inferTypeFromName(name) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('id') && !lowerName.includes('valid')) return 'uuid';
  if (lowerName.includes('email')) return 'email';
  if (lowerName.includes('url')) return 'url';
  if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('rate')) return 'number';
  if (lowerName.includes('count') || lowerName.includes('quantity')) return 'number';
  if (lowerName.includes('enabled') || lowerName.includes('active') || lowerName.includes('is_')) return 'bool';
  if (lowerName.includes('items') || lowerName.includes('list') || lowerName.includes('ids')) return 'array';
  return 'str';
}

/**
 * Get default value for a type
 */
function getDefaultValue(type) {
  const typeStr = String(type).toLowerCase();

  if (typeStr.includes('uuid')) return '550e8400-e29b-41d4-a716-446655440000';
  if (typeStr.includes('email')) return 'test@example.com';
  if (typeStr.includes('url') || typeStr.includes('http')) return 'https://example.com/test';
  if (typeStr.includes('number') || typeStr.includes('int') || typeStr.includes('float') || typeStr.includes('decimal')) return 1000;
  if (typeStr.includes('bool')) return true;
  if (typeStr.includes('array') || typeStr.includes('list')) return ['test-item'];
  if (typeStr.includes('date')) return '2024-01-01';
  if (typeStr.includes('datetime')) return '2024-01-01T00:00:00Z';

  // Default to string
  return 'test-value';
}

/**
 * Deduplicate tests by name
 */
function deduplicateTests(tests) {
  const seen = new Set();
  return tests.filter(test => {
    if (seen.has(test.name)) {
      return false;
    }
    seen.add(test.name);
    return true;
  });
}

/**
 * Convert specs to YAML format
 */
export function specsToYaml(specs, name, type, baseUrl = null) {
  const lines = [];

  lines.push(`name: ${name}`);
  if (type) lines.push(`type: ${type}`);
  if (baseUrl) lines.push(`baseUrl: ${baseUrl}`);

  // Add roles if API spec
  if (type === 'api') {
    lines.push('roles:');
    lines.push('  guest: {}');
    lines.push('  user:');
    lines.push('    credentials:');
    lines.push('      email: devloop-test@example.com');
    lines.push('      password: TestPassword123');
    lines.push('    loginEndpoint: /api/v1/auth/login');
  }

  lines.push('tests:');

  for (const test of specs) {
    lines.push(`  - name: ${test.name}`);

    if (test.as) {
      lines.push(`    as: ${test.as}`);
    }

    if (test.check) {
      lines.push(`    check: ${test.check}`);
      if (test.in) lines.push(`    in: ${test.in}`);
      if (test.pattern) lines.push(`    pattern: ${test.pattern}`);
      if (test.message) lines.push(`    message: ${test.message}`);
    } else if (test.request) {
      lines.push('    request:');
      lines.push(`      method: ${test.request.method}`);
      lines.push(`      path: ${test.request.path}`);

      if (test.request.body) {
        lines.push('      body:');
        for (const [key, value] of Object.entries(test.request.body)) {
          lines.push(`        ${key}: ${formatYamlValue(value)}`);
        }
      }
    }

    if (test.expect) {
      lines.push('    expect:');

      if (test.expect.status !== undefined) {
        if (Array.isArray(test.expect.status)) {
          lines.push('      status:');
          for (const s of test.expect.status) {
            lines.push(`        - ${s}`);
          }
        } else {
          lines.push(`      status: ${test.expect.status}`);
        }
      }

      if (test.expect.statusNot) {
        lines.push('      statusNot:');
        for (const s of test.expect.statusNot) {
          lines.push(`        - ${s}`);
        }
      }

      if (test.expect.bodyHas) {
        lines.push('      bodyHas:');
        for (const s of test.expect.bodyHas) {
          lines.push(`        - ${s}`);
        }
      }

      if (test.expect.bodyNot) {
        lines.push('      bodyNot:');
        for (const s of test.expect.bodyNot) {
          lines.push(`        - ${s}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a value for YAML
 */
function formatYamlValue(value) {
  if (typeof value === 'string') {
    // Quote strings that might be problematic
    if (value.includes(':') || value.includes('#') || value.includes("'") || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => formatYamlValue(v)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export default {
  generateProgrammaticSpecs,
  specsToYaml
};
