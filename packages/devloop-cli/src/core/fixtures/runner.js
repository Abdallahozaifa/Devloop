import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const CACHE_FILE = '.devloop/fixtures.cache.json';

/**
 * Setup test fixtures - create data in dependency order
 * @param {string} projectDir - Project directory path
 * @param {string} apiUrl - API base URL
 * @param {Object} options - Optional settings
 * @param {string} options.token - CLI-provided token (overrides all auth config)
 */
export async function setupFixtures(projectDir, apiUrl, options = {}) {
  const fixturesPath = path.join(projectDir, '.devloop', 'fixtures.yaml');

  if (!fs.existsSync(fixturesPath)) {
    console.log('❌ No fixtures.yaml found. Create .devloop/fixtures.yaml first.');
    return null;
  }

  const config = yaml.parse(fs.readFileSync(fixturesPath, 'utf-8'));
  const results = {
    variables: {},
    created: [],
    failed: [],
    reused: []
  };

  console.log('🔧 Setting up test fixtures...\n');

  // 1. Authenticate all users
  console.log('📝 Authenticating test users...');
  for (const [name, creds] of Object.entries(config.auth || {})) {
    try {
      const token = await authenticateUser(apiUrl, name, creds, options.token);
      results.variables[`${name}_TOKEN`] = token;

      // Show auth method used
      let method = 'token (CLI)';
      if (!options.token) {
        if (creds.token) method = 'token (config)';
        else if (creds.token_env) method = `env (${creds.token_env})`;
        else method = 'password';
      }
      console.log(`   ✅ ${name}: authenticated via ${method}`);
    } catch (e) {
      console.log(`   ❌ ${name}: ${e.message}`);
      results.failed.push({ name, error: e.message });
    }
  }

  // 2. Create fixtures in dependency order
  console.log('\n📦 Creating fixtures...');
  const sorted = topologicalSort(config.fixtures || []);

  for (const fixture of sorted) {
    // Check dependencies
    const depsMet = (fixture.depends_on || []).every(dep =>
      results.created.find(c => c.name === dep) || results.reused.find(r => r.name === dep)
    );

    if (!depsMet) {
      console.log(`   ⏭️  ${fixture.name}: skipped (missing dependencies)`);
      continue;
    }

    // Check if already exists
    if (fixture.find_existing) {
      const existing = await findExisting(apiUrl, fixture, results.variables);
      if (existing) {
        console.log(`   ♻️  ${fixture.name}: reusing existing`);
        for (const [varName, jsonPath] of Object.entries(fixture.capture || {})) {
          results.variables[varName] = extractJsonPath(existing, jsonPath);
        }
        results.reused.push({ ...fixture, id: existing.id });
        continue;
      }
    }

    // Create new
    try {
      const response = await createFixture(apiUrl, fixture, results.variables);

      // Capture variables
      for (const [varName, jsonPath] of Object.entries(fixture.capture || {})) {
        results.variables[varName] = extractJsonPath(response, jsonPath);
      }
      console.log(`   ✅ ${fixture.name}: created`);

      results.created.push({ ...fixture, id: response.id });
    } catch (e) {
      console.log(`   ❌ ${fixture.name}: ${e.message}`);
      results.failed.push({ name: fixture.name, error: e.message });
    }
  }

  // 3. Save cache
  const cachePath = path.join(projectDir, CACHE_FILE);
  const cacheDir = path.dirname(cachePath);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cache = {
    created_at: new Date().toISOString(),
    environment: config.environment || 'production',
    api_url: apiUrl,
    variables: results.variables,
    fixtures: [...results.created, ...results.reused]
  };

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  // 4. Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Fixture Setup Summary');
  console.log('═'.repeat(50));
  console.log(`   Created: ${results.created.length}`);
  console.log(`   Reused:  ${results.reused.length}`);
  console.log(`   Failed:  ${results.failed.length}`);
  console.log(`   Cache:   ${cachePath}`);
  console.log('═'.repeat(50));

  // Show variables
  console.log('\n📋 Variables available for tests:');
  for (const [key, value] of Object.entries(results.variables)) {
    if (key.endsWith('_TOKEN')) {
      console.log(`   ${key}: ${String(value).substring(0, 20)}...`);
    } else {
      console.log(`   ${key}: ${value}`);
    }
  }

  return results;
}

/**
 * Load cached variables for test runs
 */
export function loadFixtureCache(projectDir) {
  const cachePath = path.join(projectDir, CACHE_FILE);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  return cache.variables;
}

/**
 * Check fixture status
 */
export async function checkFixtureStatus(projectDir, apiUrl) {
  const cachePath = path.join(projectDir, CACHE_FILE);

  if (!fs.existsSync(cachePath)) {
    console.log('❌ No fixture cache found. Run: devloop fixtures setup');
    return null;
  }

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  console.log('📊 Fixture Status');
  console.log('═'.repeat(50));
  console.log(`   Created: ${cache.created_at}`);
  console.log(`   Environment: ${cache.environment}`);
  console.log(`   API URL: ${cache.api_url}`);
  console.log('');

  // Show fixtures
  console.log('📦 Fixtures:');
  for (const fixture of cache.fixtures) {
    console.log(`   ${fixture.name}: ${fixture.id || 'unknown'}`);
  }

  console.log('\n📋 Variables:');
  for (const [key, value] of Object.entries(cache.variables)) {
    if (key.endsWith('_TOKEN')) {
      console.log(`   ${key}: ${String(value).substring(0, 20)}...`);
    } else {
      console.log(`   ${key}: ${value}`);
    }
  }

  return cache;
}

/**
 * Teardown fixtures
 */
export async function teardownFixtures(projectDir, apiUrl) {
  const cachePath = path.join(projectDir, CACHE_FILE);

  if (!fs.existsSync(cachePath)) {
    console.log('❌ No fixture cache found.');
    return;
  }

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  console.log('🗑️  Tearing down fixtures...\n');

  // Delete in reverse order (dependencies last)
  const fixtures = [...cache.fixtures].reverse();

  for (const fixture of fixtures) {
    if (fixture.cleanup && fixture.cleanup.endpoint) {
      try {
        const token = cache.variables[`${fixture.as}_TOKEN`];
        const rawEndpoint = resolveVariables(fixture.cleanup.endpoint, cache.variables);
        // Extract method and path from "DELETE /api/v1/..." format
        const endpoint = rawEndpoint.includes(' ') ? rawEndpoint.split(' ')[1] : rawEndpoint;
        const method = rawEndpoint.includes(' ') ? rawEndpoint.split(' ')[0] : (fixture.cleanup.method || 'DELETE');

        await fetch(`${apiUrl}${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log(`   🗑️  ${fixture.name}: deleted`);
      } catch (e) {
        console.log(`   ⚠️  ${fixture.name}: cleanup failed - ${e.message}`);
      }
    } else {
      console.log(`   ⏭️  ${fixture.name}: no cleanup defined`);
    }
  }

  // Remove cache
  fs.unlinkSync(cachePath);
  console.log('\n✅ Fixtures torn down and cache removed');
}

// Helper functions

/**
 * Authenticate a user using one of the supported methods:
 * 1. Direct token (config.token)
 * 2. Token from environment variable (config.token_env)
 * 3. Email/password login (config.email, config.password)
 */
async function authenticateUser(apiUrl, name, config, cliToken = null) {
  // Option 0: CLI token override (--token flag)
  if (cliToken) {
    return cliToken;
  }

  // Option 1: Token provided directly in config
  if (config.token) {
    return config.token;
  }

  // Option 2: Token from environment variable
  if (config.token_env) {
    const token = process.env[config.token_env];
    if (!token) {
      throw new Error(`Environment variable ${config.token_env} not set`);
    }
    return token;
  }

  // Option 3: Password login
  if (config.email && config.password) {
    return await login(apiUrl, config.email, config.password);
  }

  throw new Error(`No auth method configured for ${name}. Use token, token_env, or email/password.`);
}

async function login(apiUrl, email, password) {
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createFixture(apiUrl, fixture, variables) {
  const [method, endpoint] = fixture.endpoint.split(' ');
  const resolvedEndpoint = resolveVariables(endpoint, variables);
  const resolvedBody = resolveVariables(fixture.body, variables);
  const token = variables[`${fixture.as}_TOKEN`];

  const response = await fetch(`${apiUrl}${resolvedEndpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(resolvedBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }

  return response.json();
}

async function findExisting(apiUrl, fixture, variables) {
  if (!fixture.find_existing) return null;

  const token = variables[`${fixture.as}_TOKEN`];
  const rawEndpoint = resolveVariables(fixture.find_existing.endpoint, variables);
  // Extract path from "GET /api/v1/..." format
  const endpoint = rawEndpoint.includes(' ') ? rawEndpoint.split(' ')[1] : rawEndpoint;

  const response = await fetch(`${apiUrl}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) return null;

  const data = await response.json();
  const items = data.items || data || [];

  // Find matching item
  for (const item of (Array.isArray(items) ? items : [items])) {
    let matches = true;
    for (const [key, value] of Object.entries(fixture.find_existing.match || {})) {
      if (item[key] !== value) {
        matches = false;
        break;
      }
    }
    if (matches) return item;
  }

  return null;
}

function resolveVariables(obj, variables) {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => variables[key] || '');
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveVariables(item, variables));
  }
  if (typeof obj === 'object' && obj !== null) {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveVariables(value, variables);
    }
    return resolved;
  }
  return obj;
}

function extractJsonPath(obj, jsonPath) {
  // Simple JSON path: $.id, $.data.id
  const pathStr = jsonPath.replace(/^\$\.?/, '');
  if (!pathStr) return obj;

  const parts = pathStr.split('.');
  let value = obj;
  for (const key of parts) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

function topologicalSort(fixtures) {
  const sorted = [];
  const visited = new Set();

  function visit(fixture) {
    if (visited.has(fixture.name)) return;
    visited.add(fixture.name);

    for (const dep of fixture.depends_on || []) {
      const depFixture = fixtures.find(f => f.name === dep);
      if (depFixture) visit(depFixture);
    }

    sorted.push(fixture);
  }

  for (const fixture of fixtures) {
    visit(fixture);
  }

  return sorted;
}

export default { setupFixtures, loadFixtureCache, checkFixtureStatus, teardownFixtures };
