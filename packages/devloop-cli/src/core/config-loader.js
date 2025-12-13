/**
 * DevLoop Config Loader
 *
 * Loads configuration from .devloop/config.yaml
 * Used for deterministic spec generation with user-defined credentials
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CONFIG_FILE = '.devloop/config.yaml';

/**
 * Load configuration from .devloop/config.yaml
 * @param {string} projectRoot - The root directory of the project
 * @returns {Object} Configuration object or empty defaults
 */
export function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    // Return empty defaults if config doesn't exist
    return {
      credentials: {
        test_user: {
          email: null,
          password: null
        }
      },
      api: {
        login_endpoint: '/api/v1/auth/login'
      }
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);
    return config || {};
  } catch (error) {
    console.warn(`Warning: Could not parse ${CONFIG_FILE}: ${error.message}`);
    return {};
  }
}

/**
 * Check if config file exists
 * @param {string} projectRoot - The root directory of the project
 * @returns {boolean} True if config exists
 */
export function configExists(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Get the path to the config file
 * @param {string} projectRoot - The root directory of the project
 * @returns {string} Full path to config file
 */
export function getConfigPath(projectRoot) {
  return path.join(projectRoot, CONFIG_FILE);
}

/**
 * Create a sample config file
 * @param {string} projectRoot - The root directory of the project
 * @returns {boolean} True if file was created
 */
export function createSampleConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILE);

  // Don't overwrite existing config
  if (fs.existsSync(configPath)) {
    return false;
  }

  const sampleConfig = `# DevLoop Configuration
# This file is used by DevLoop for deterministic spec generation
# Values here are substituted at test runtime

credentials:
  test_user:
    email: your-test-user@example.com
    password: your-test-password

  # Add additional test users if needed
  # other_user:
  #   email: other@example.com
  #   password: password123

api:
  # Login endpoint for authentication
  login_endpoint: /api/v1/auth/login

  # Base URL (optional - can also be set via --baseUrl flag)
  # base_url: https://your-api.com

# Project-specific settings (optional)
# project:
#   name: My Project
#   type: fullstack
`;

  // Ensure .devloop directory exists
  const devloopDir = path.join(projectRoot, '.devloop');
  if (!fs.existsSync(devloopDir)) {
    fs.mkdirSync(devloopDir, { recursive: true });
  }

  fs.writeFileSync(configPath, sampleConfig, 'utf8');
  return true;
}

/**
 * Get credentials for a specific role from config
 * @param {Object} config - The loaded configuration
 * @param {string} role - The role name (e.g., 'test_user', 'other_user')
 * @returns {Object|null} Credentials object or null
 */
export function getCredentialsForRole(config, role) {
  // Map common role names
  const roleMapping = {
    'user': 'test_user',
    'test_user': 'test_user',
    'other_user': 'other_user',
    'admin': 'admin'
  };

  const mappedRole = roleMapping[role] || role;

  if (config?.credentials?.[mappedRole]) {
    return config.credentials[mappedRole];
  }

  return null;
}

/**
 * Get the login endpoint from config
 * @param {Object} config - The loaded configuration
 * @returns {string} Login endpoint path
 */
export function getLoginEndpoint(config) {
  return config?.api?.login_endpoint || '/api/v1/auth/login';
}

export default {
  loadConfig,
  configExists,
  getConfigPath,
  createSampleConfig,
  getCredentialsForRole,
  getLoginEndpoint
};
