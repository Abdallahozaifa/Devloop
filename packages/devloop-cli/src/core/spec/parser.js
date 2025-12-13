import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export function parseSpecFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const spec = yaml.load(content);

  // Determine spec type (default: api)
  const type = spec.type || 'api';

  // Parse tests - handle both flat array and comprehensive format (tests.api, tests.ui)
  let tests = [];
  if (spec.tests) {
    if (Array.isArray(spec.tests)) {
      // Flat array format (standard spec)
      tests = type === 'config'
        ? spec.tests.map(parseConfigTest)
        : type === 'ui'
          ? spec.tests.map(parseUITest)
          : spec.tests.map(parseTest);
    } else if (typeof spec.tests === 'object') {
      // Comprehensive format with tests.api and tests.ui subsections
      if (spec.tests.api && Array.isArray(spec.tests.api)) {
        tests = tests.concat(spec.tests.api.map(parseTest));
      }
      if (spec.tests.ui && Array.isArray(spec.tests.ui)) {
        tests = tests.concat(spec.tests.ui.map(parseUITest));
      }
      if (spec.tests.config && Array.isArray(spec.tests.config)) {
        tests = tests.concat(spec.tests.config.map(parseConfigTest));
      }
    }
  }

  return {
    name: spec.name || path.basename(filePath, '.yaml'),
    type,
    description: spec.description,
    baseUrl: spec.baseUrl,
    roles: parseRoles(spec.roles || {}),
    variables: spec.variables || {},
    // Include model/api/rules/contracts metadata for comprehensive specs
    models: spec.models || null,
    api: spec.api || null,
    rules: spec.rules || null,
    contracts: spec.contracts || null,
    ui: spec.ui || null,
    tests,
    file: filePath
  };
}

function parseConfigTest(test) {
  return {
    name: test.name || 'Unnamed config test',
    skip: test.skip || false,
    check: test.check,
    url: test.url,
    in: test.in,
    pattern: test.pattern,
    exclude: test.exclude || [],
    file: test.file,
    var: test.var,
    path: test.path,
    message: test.message,
    expect: test.expect || {}
  };
}

function parseUITest(test) {
  return {
    name: test.name || 'Unnamed UI test',
    skip: test.skip || false,
    url: test.url,
    headers: test.headers || {},
    waitUntil: test.waitUntil || 'networkidle2',
    waitFor: test.waitFor,
    timeout: test.timeout || 30000,
    expect: {
      status: test.expect?.status,
      noNetworkErrors: test.expect?.noNetworkErrors !== false,
      noConsoleErrors: test.expect?.noConsoleErrors !== false,
      allowedFailures: test.expect?.allowedFailures || [],
      allowedConsoleErrors: test.expect?.allowedConsoleErrors || [],
      elementExists: test.expect?.elementExists,
      elementNotExists: test.expect?.elementNotExists,
      textContains: test.expect?.textContains,
      textNotContains: test.expect?.textNotContains,
      title: test.expect?.title,
      apiCallsSucceed: test.expect?.apiCallsSucceed
    }
  };
}

function parseRoles(roles) {
  const parsed = {
    guest: { auth: null },
    ...roles
  };

  return parsed;
}

function parseTest(test) {
  return {
    name: test.name || test.it || 'Unnamed test',
    skip: test.skip || false,
    as: test.as || 'guest',
    setup: test.setup || [],
    storeAs: test.storeAs,
    request: {
      method: test.request?.method || test.method || 'GET',
      path: test.request?.path || test.path,
      headers: test.request?.headers || test.headers || {},
      body: test.request?.body || test.body,
      query: test.request?.query || test.query
    },
    expect: {
      status: test.expect?.status || test.status,
      headers: test.expect?.headers,
      body: test.expect?.body,
      // Custom matchers
      bodyHas: test.expect?.bodyHas || test.expect?.has,
      bodyIs: test.expect?.bodyIs,
      bodyMatches: test.expect?.bodyMatches,
      // Not matchers (for checking 403 bugs)
      statusNot: test.expect?.statusNot,
      // Body content validation (new features)
      bodyNot: test.expect?.bodyNot,
      bodyNotContains: test.expect?.bodyNotContains,
      bodyContains: test.expect?.bodyContains,
      noError: test.expect?.noError
    },
    cleanup: test.cleanup || []
  };
}

export function loadAllSpecs(specsDir) {
  if (!fs.existsSync(specsDir)) {
    return [];
  }

  const files = fs.readdirSync(specsDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  return files.map(f => parseSpecFile(path.join(specsDir, f)));
}

export function validateSpec(spec) {
  const errors = [];

  // For comprehensive specs, having no tests is acceptable if they define models/api
  const isComprehensiveSpec = spec.models || spec.api || spec.rules;

  if (!spec.tests || spec.tests.length === 0) {
    if (!isComprehensiveSpec) {
      errors.push('Spec has no tests');
    }
  }

  for (const test of spec.tests || []) {
    // Skip validation for UI tests (they have different structure)
    if (test.url && !test.request) {
      continue;
    }
    if (test.request && !test.request.path) {
      errors.push(`Test '${test.name}' missing request path`);
    }
    if (test.expect && !test.expect.status && !test.expect.body && !test.expect.statusNot &&
        !test.expect.noConsoleErrors && !test.expect.noNetworkErrors) {
      errors.push(`Test '${test.name}' has no expectations`);
    }
  }

  return errors;
}
