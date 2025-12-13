/**
 * DevLoop Variable Resolver
 *
 * Resolves ${VARIABLE} placeholders in spec objects using config values
 */

import { loadConfig, getCredentialsForRole, getLoginEndpoint } from './config-loader.js';

// Variable pattern: ${VARIABLE_NAME}
const VARIABLE_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

/**
 * Resolve a single string value, replacing ${VAR} with config values
 * @param {string} value - The string to resolve
 * @param {Object} config - The loaded configuration
 * @returns {string} Resolved string
 */
function resolveString(value, config) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(VARIABLE_PATTERN, (match, varName) => {
    // Check for known variables
    switch (varName) {
      case 'TEST_USER_EMAIL':
        return config?.credentials?.test_user?.email || match;
      case 'TEST_USER_PASSWORD':
        return config?.credentials?.test_user?.password || match;
      case 'OTHER_USER_EMAIL':
        return config?.credentials?.other_user?.email || match;
      case 'OTHER_USER_PASSWORD':
        return config?.credentials?.other_user?.password || match;
      case 'LOGIN_ENDPOINT':
        return getLoginEndpoint(config);
      case 'API_BASE_URL':
        return config?.api?.base_url || match;
      default:
        // Check if it's a custom credential
        if (varName.endsWith('_EMAIL')) {
          const role = varName.replace('_EMAIL', '').toLowerCase();
          const creds = getCredentialsForRole(config, role);
          return creds?.email || match;
        }
        if (varName.endsWith('_PASSWORD')) {
          const role = varName.replace('_PASSWORD', '').toLowerCase();
          const creds = getCredentialsForRole(config, role);
          return creds?.password || match;
        }
        // Return original if unknown
        return match;
    }
  });
}

/**
 * Recursively resolve all variables in an object
 * @param {any} obj - The object to resolve
 * @param {Object} config - The loaded configuration
 * @returns {any} Resolved object
 */
function resolveObject(obj, config) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveString(obj, config);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveObject(item, config));
  }

  if (typeof obj === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveObject(value, config);
    }
    return resolved;
  }

  return obj;
}

/**
 * Resolve all variables in a spec object
 * @param {Object} spec - The spec object to resolve
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Resolved spec
 */
export function resolveSpec(spec, projectRoot) {
  const config = loadConfig(projectRoot);
  return resolveObject(spec, config);
}

/**
 * Resolve variables in the roles section specifically
 * This is used during test execution to get real credentials
 * @param {Object} roles - The roles object from a spec
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Resolved roles
 */
export function resolveRoles(roles, projectRoot) {
  const config = loadConfig(projectRoot);
  return resolveObject(roles, config);
}

/**
 * Check if a string contains unresolved variables
 * @param {string} value - The string to check
 * @returns {boolean} True if contains unresolved variables
 */
export function hasUnresolvedVariables(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return VARIABLE_PATTERN.test(value);
}

/**
 * Get list of unresolved variables in a string
 * @param {string} value - The string to check
 * @returns {string[]} Array of variable names
 */
export function getUnresolvedVariables(value) {
  if (typeof value !== 'string') {
    return [];
  }
  const variables = [];
  let match;
  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');
  while ((match = pattern.exec(value)) !== null) {
    variables.push(match[1]);
  }
  return variables;
}

/**
 * Check entire object for unresolved variables
 * @param {any} obj - Object to check
 * @returns {string[]} Array of all unresolved variable names
 */
export function findAllUnresolvedVariables(obj) {
  const variables = new Set();

  function traverse(value) {
    if (typeof value === 'string') {
      getUnresolvedVariables(value).forEach(v => variables.add(v));
    } else if (Array.isArray(value)) {
      value.forEach(traverse);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse);
    }
  }

  traverse(obj);
  return Array.from(variables);
}

export default {
  resolveSpec,
  resolveRoles,
  resolveString,
  hasUnresolvedVariables,
  getUnresolvedVariables,
  findAllUnresolvedVariables
};
