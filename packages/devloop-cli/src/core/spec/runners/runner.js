import fetch from 'node-fetch';
import { resolveRoles } from '../../variable-resolver.js';

// Write methods that modify data
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export async function runSpec(spec, context) {
  // Resolve ${VAR} variables in roles section from config
  const resolvedRoles = spec.roles ? resolveRoles(spec.roles, context.projectRoot || process.cwd()) : {};
  spec = { ...spec, roles: resolvedRoles };
  const results = {
    name: spec.name,
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Resolve variables
  const variables = { ...spec.variables, ...context.variables };

  for (const test of spec.tests) {
    if (test.skip) {
      results.skipped++;
      results.tests.push({ ...test, status: 'skipped' });
      continue;
    }

    // Skip write operations in read-only mode
    const method = (test.request?.method || 'GET').toUpperCase();
    if (context.readOnly && WRITE_METHODS.includes(method)) {
      results.skipped++;
      results.tests.push({
        ...test,
        status: 'skipped',
        skipReason: 'read-only mode (use --allow-writes to enable)'
      });
      continue;
    }

    const result = await runTest(test, spec, context, variables);
    results.tests.push(result);

    if (result.passed) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Store variables from response for chaining
    if (result.response?.body && test.storeAs) {
      variables[test.storeAs] = result.response.body;
    }
  }

  return results;
}

async function runTest(test, spec, context, variables) {
  const result = {
    name: test.name,
    passed: false,
    request: null,
    response: null,
    errors: []
  };

  try {
    // Get auth for role
    const auth = await getAuthForRole(test.as, spec.roles, context);

    // Build request
    const url = buildUrl(test.request.path, context.apiUrl, variables);
    const headers = {
      'Content-Type': 'application/json',
      ...test.request.headers
    };

    if (auth?.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    if (auth?.header) {
      Object.assign(headers, auth.header);
    }

    result.request = {
      method: test.request.method,
      url,
      headers,
      body: test.request.body
    };

    // Make request
    const response = await fetch(url, {
      method: test.request.method,
      headers,
      body: test.request.body ? JSON.stringify(interpolate(test.request.body, variables)) : undefined
    });

    let body;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
    } else {
      body = await response.text();
    }

    result.response = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body
    };

    // Check expectations
    result.passed = checkExpectations(result.response, test.expect, result.errors);

  } catch (error) {
    result.errors.push(error.message);
    result.passed = false;
  }

  return result;
}

async function getAuthForRole(role, roles, context) {
  if (role === 'guest' || !role) {
    return null;
  }

  const roleConfig = roles[role];
  if (!roleConfig) {
    // Try to get from context
    if (context.auth?.[role]) {
      return context.auth[role];
    }
    return null;
  }

  if (roleConfig.token) {
    return { token: roleConfig.token };
  }

  if (roleConfig.credentials) {
    // Login to get token
    const loginUrl = `${context.apiUrl}${roleConfig.loginEndpoint || '/auth/login'}`;
    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleConfig.credentials)
      });

      if (res.ok) {
        const data = await res.json();
        return { token: data.access_token || data.token };
      }
    } catch (e) {
      console.error(`Failed to authenticate as ${role}:`, e.message);
    }
  }

  return null;
}

function buildUrl(path, baseUrl, variables) {
  let url = path;

  // Interpolate variables in path
  url = interpolate(url, variables);

  // Prepend base URL if path is relative
  if (!url.startsWith('http')) {
    url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
  }

  return url;
}

function interpolate(value, variables) {
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }
  if (typeof value === 'object' && value !== null) {
    const result = Array.isArray(value) ? [] : {};
    for (const key in value) {
      result[key] = interpolate(value[key], variables);
    }
    return result;
  }
  return value;
}

function checkExpectations(response, expect, errors) {
  let passed = true;

  // Check status
  if (expect.status !== undefined) {
    const expectedStatuses = Array.isArray(expect.status) ? expect.status : [expect.status];
    if (!expectedStatuses.includes(response.status)) {
      errors.push(`Expected status ${expectedStatuses.join(' or ')}, got ${response.status}`);
      passed = false;
    }
  }

  // Check status NOT (useful for catching 403 bugs)
  if (expect.statusNot !== undefined) {
    const forbiddenStatuses = Array.isArray(expect.statusNot) ? expect.statusNot : [expect.statusNot];
    if (forbiddenStatuses.includes(response.status)) {
      errors.push(`Expected status NOT ${forbiddenStatuses.join(' or ')}, but got ${response.status}`);
      passed = false;
    }
  }

  // Check body has fields
  if (expect.bodyHas) {
    const fields = Array.isArray(expect.bodyHas) ? expect.bodyHas : [expect.bodyHas];
    for (const field of fields) {
      if (typeof response.body !== 'object' || !(field in response.body)) {
        errors.push(`Expected body to have '${field}'`);
        passed = false;
      }
    }
  }

  // Check body is array
  if (expect.bodyIs === 'array' && !Array.isArray(response.body)) {
    errors.push('Expected body to be array');
    passed = false;
  }

  // Check body is object
  if (expect.bodyIs === 'object' && (typeof response.body !== 'object' || Array.isArray(response.body))) {
    errors.push('Expected body to be object');
    passed = false;
  }

  // Check body shape contract (for paginated responses like { items: [], total: N })
  if (typeof expect.bodyIs === 'object' && expect.bodyIs !== null) {
    if (typeof response.body !== 'object' || Array.isArray(response.body)) {
      errors.push(`Expected body to be object with shape ${JSON.stringify(expect.bodyIs)}`);
      passed = false;
    } else {
      for (const [field, expectedType] of Object.entries(expect.bodyIs)) {
        const actualValue = response.body[field];
        if (actualValue === undefined) {
          errors.push(`Expected body to have field '${field}'`);
          passed = false;
        } else if (expectedType === 'array' && !Array.isArray(actualValue)) {
          errors.push(`Expected body.${field} to be array, got ${typeof actualValue}`);
          passed = false;
        } else if (expectedType === 'number' && typeof actualValue !== 'number') {
          errors.push(`Expected body.${field} to be number, got ${typeof actualValue}`);
          passed = false;
        } else if (expectedType === 'string' && typeof actualValue !== 'string') {
          errors.push(`Expected body.${field} to be string, got ${typeof actualValue}`);
          passed = false;
        } else if (expectedType === 'boolean' && typeof actualValue !== 'boolean') {
          errors.push(`Expected body.${field} to be boolean, got ${typeof actualValue}`);
          passed = false;
        } else if (expectedType === 'object' && (typeof actualValue !== 'object' || Array.isArray(actualValue))) {
          errors.push(`Expected body.${field} to be object, got ${Array.isArray(actualValue) ? 'array' : typeof actualValue}`);
          passed = false;
        }
      }
    }
  }

  // Check body matches pattern
  if (expect.bodyMatches) {
    for (const [key, pattern] of Object.entries(expect.bodyMatches)) {
      const value = response.body?.[key];
      if (pattern === 'uuid' && !isUUID(value)) {
        errors.push(`Expected ${key} to be UUID`);
        passed = false;
      }
      if (pattern === 'email' && !isEmail(value)) {
        errors.push(`Expected ${key} to be email`);
        passed = false;
      }
      if (pattern === 'string' && typeof value !== 'string') {
        errors.push(`Expected ${key} to be string`);
        passed = false;
      }
    }
  }

  // Check exact body match
  if (expect.body && typeof expect.body === 'object') {
    for (const [key, expected] of Object.entries(expect.body)) {
      if (response.body?.[key] !== expected) {
        errors.push(`Expected body.${key} to be ${expected}, got ${response.body?.[key]}`);
        passed = false;
      }
    }
  }

  // Check body NOT has fields (inverse of bodyHas - catches error responses)
  if (expect.bodyNot) {
    const fields = Array.isArray(expect.bodyNot) ? expect.bodyNot : [expect.bodyNot];
    for (const field of fields) {
      if (typeof response.body === 'object' && field in response.body) {
        errors.push(`Expected body NOT to have '${field}', but it was present`);
        passed = false;
      }
    }
  }

  // Check body does NOT contain string (for catching error messages)
  if (expect.bodyNotContains) {
    const patterns = Array.isArray(expect.bodyNotContains) ? expect.bodyNotContains : [expect.bodyNotContains];
    const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    for (const pattern of patterns) {
      if (bodyStr.toLowerCase().includes(pattern.toLowerCase())) {
        errors.push(`Body should NOT contain '${pattern}', but it does`);
        passed = false;
      }
    }
  }

  // Check for error indicators in response (noError check)
  if (expect.noError) {
    const errorIndicators = ['error', 'Error', 'ERROR', 'detail', 'message'];
    const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body || {});

    // Check for common error fields
    if (typeof response.body === 'object' && response.body !== null) {
      for (const field of errorIndicators) {
        if (field in response.body && response.body[field]) {
          // Skip if the field is expected data (e.g., "message" in a valid response)
          if (field === 'message' && !String(response.body[field]).toLowerCase().includes('error')) {
            continue;
          }
          if (field === 'detail' && response.status < 400) {
            continue;
          }
          if (field === 'error' || (field === 'detail' && response.status >= 400)) {
            errors.push(`Response contains error indicator '${field}': ${response.body[field]}`);
            passed = false;
          }
        }
      }
    }

    // Check for "Access Denied", "Unauthorized", etc. in response
    const errorPatterns = ['access denied', 'unauthorized', 'forbidden', 'not found', 'invalid'];
    for (const pattern of errorPatterns) {
      if (bodyStr.toLowerCase().includes(pattern) && response.status >= 400) {
        errors.push(`Response contains error: '${pattern}'`);
        passed = false;
        break;
      }
    }
  }

  // Check body contains specific value (for checking successful responses)
  if (expect.bodyContains) {
    const patterns = Array.isArray(expect.bodyContains) ? expect.bodyContains : [expect.bodyContains];
    const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    for (const pattern of patterns) {
      if (!bodyStr.toLowerCase().includes(pattern.toLowerCase())) {
        errors.push(`Expected body to contain '${pattern}', but it doesn't`);
        passed = false;
      }
    }
  }

  return passed;
}

function isUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export { runTest, checkExpectations, interpolate };
