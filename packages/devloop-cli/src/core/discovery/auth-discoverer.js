import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Discovers authentication patterns in a project
 * Detects: JWT, Session, OAuth, API Key, Magic Link, etc.
 */
export async function discoverAuth(projectRoot, framework) {
  const result = {
    type: null,
    methods: [],
    loginEndpoint: null,
    registerEndpoint: null,
    logoutEndpoint: null,
    refreshEndpoint: null,
    tokenHeader: null,
    tokenLocation: null,
    credentialFields: [],
    oauthProviders: [],
    passwordReset: null,
  };

  // Try to discover from OpenAPI spec first
  const openApiAuth = await discoverFromOpenApi(projectRoot, framework);
  if (openApiAuth) {
    Object.assign(result, openApiAuth);
  }

  // Discover from backend code
  const backendAuth = await discoverFromBackend(projectRoot, framework);
  Object.assign(result, { ...result, ...backendAuth });

  // Discover from frontend code
  const frontendAuth = await discoverFromFrontend(projectRoot, framework);
  Object.assign(result, { ...result, ...frontendAuth });

  // Infer auth type from discovered info
  if (!result.type) {
    result.type = inferAuthType(result);
  }

  // Set default token header if JWT
  if (result.type === 'jwt' && !result.tokenHeader) {
    result.tokenHeader = 'Authorization: Bearer {token}';
    result.tokenLocation = 'header';
  }

  return result;
}

async function discoverFromOpenApi(projectRoot, framework) {
  // Check for OpenAPI spec files
  const openApiPaths = [
    'openapi.json',
    'openapi.yaml',
    'swagger.json',
    'swagger.yaml',
    'api/openapi.json',
    'docs/openapi.json',
  ];

  for (const specPath of openApiPaths) {
    const fullPath = path.join(projectRoot, specPath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const spec = specPath.endsWith('.json') ? JSON.parse(content) : content;

        // Parse security schemes
        if (spec.components?.securitySchemes) {
          const schemes = spec.components.securitySchemes;
          const result = { methods: [] };

          for (const [name, scheme] of Object.entries(schemes)) {
            if (scheme.type === 'http' && scheme.scheme === 'bearer') {
              result.type = 'jwt';
              result.tokenHeader = 'Authorization: Bearer {token}';
              result.methods.push('jwt');
            }
            if (scheme.type === 'apiKey') {
              result.methods.push('api_key');
              result.tokenHeader = `${scheme.name}: {token}`;
              result.tokenLocation = scheme.in;
            }
            if (scheme.type === 'oauth2') {
              result.methods.push('oauth2');
              result.type = 'oauth2';
            }
          }

          return result;
        }
      } catch (e) {
        // Continue to next method
      }
    }
  }

  return null;
}

async function discoverFromBackend(projectRoot, framework) {
  const result = {
    loginEndpoint: null,
    registerEndpoint: null,
    logoutEndpoint: null,
    refreshEndpoint: null,
    credentialFields: [],
    oauthProviders: [],
  };

  const backendLang = framework?.language?.backend;

  if (backendLang === 'python') {
    return await discoverPythonAuth(projectRoot);
  } else if (backendLang === 'javascript' || backendLang === 'typescript') {
    return await discoverNodeAuth(projectRoot);
  }

  return result;
}

async function discoverPythonAuth(projectRoot) {
  const result = {
    loginEndpoint: null,
    registerEndpoint: null,
    logoutEndpoint: null,
    refreshEndpoint: null,
    credentialFields: [],
    oauthProviders: [],
    methods: [],
  };

  // Find Python files that might contain auth endpoints
  const authPaths = [
    'app/api/**/auth*.py',
    'api/app/api/**/auth*.py',
    'backend/app/api/**/auth*.py',
    'src/**/auth*.py',
    '**/routers/auth*.py',
    '**/endpoints/auth*.py',
  ];

  for (const pattern of authPaths) {
    const files = await glob(pattern, { cwd: projectRoot, ignore: ['**/test_*', '**/__pycache__/**'] });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Find login endpoint
      const loginMatch = content.match(/@(?:router|app)\.(post|get)\s*\(['"](\/(?:auth\/)?(?:login|signin))['"]/i);
      if (loginMatch) {
        result.loginEndpoint = `POST ${loginMatch[2]}`;
      }

      // Find register endpoint
      const registerMatch = content.match(/@(?:router|app)\.(post)\s*\(['"](\/(?:auth\/)?(?:register|signup))['"]/i);
      if (registerMatch) {
        result.registerEndpoint = `POST ${registerMatch[2]}`;
      }

      // Find logout endpoint
      const logoutMatch = content.match(/@(?:router|app)\.(post|get)\s*\(['"](\/(?:auth\/)?logout)['"]/i);
      if (logoutMatch) {
        result.logoutEndpoint = `${logoutMatch[1].toUpperCase()} ${logoutMatch[2]}`;
      }

      // Find refresh endpoint
      const refreshMatch = content.match(/@(?:router|app)\.(post)\s*\(['"](\/(?:auth\/)?(?:refresh|token\/refresh))['"]/i);
      if (refreshMatch) {
        result.refreshEndpoint = `POST ${refreshMatch[2]}`;
      }

      // Check for OAuth providers
      if (content.includes('google')) result.oauthProviders.push('google');
      if (content.includes('github')) result.oauthProviders.push('github');
      if (content.includes('facebook')) result.oauthProviders.push('facebook');

      // Check for JWT
      if (content.includes('jwt') || content.includes('JWT') || content.includes('access_token')) {
        result.methods.push('jwt');
      }

      // Check for session-based auth
      if (content.includes('session') && content.includes('cookie')) {
        result.methods.push('session');
      }

      // Extract credential fields from schema
      const schemaMatch = content.match(/class\s+(?:Login|Auth|Credential)(?:Schema|Request|Input)\s*\([^)]*\):\s*([^}]+?)(?=\n\s*class|\n\s*@|\nRouter|\Z)/s);
      if (schemaMatch) {
        const schemaBody = schemaMatch[1];
        const fieldMatches = schemaBody.matchAll(/(\w+)\s*:\s*(?:str|EmailStr|SecretStr|Password)/g);
        for (const match of fieldMatches) {
          if (!result.credentialFields.includes(match[1])) {
            result.credentialFields.push(match[1]);
          }
        }
      }

      // Common credential patterns
      if (content.includes('email') && !result.credentialFields.includes('email')) {
        result.credentialFields.push('email');
      }
      if (content.includes('password') && !result.credentialFields.includes('password')) {
        result.credentialFields.push('password');
      }
    }
  }

  // Check for password reset
  const resetFiles = await glob('**/*reset*.py', { cwd: projectRoot, ignore: ['**/test_*', '**/__pycache__/**'] });
  if (resetFiles.length > 0) {
    result.passwordReset = true;
  }

  return result;
}

async function discoverNodeAuth(projectRoot) {
  const result = {
    loginEndpoint: null,
    registerEndpoint: null,
    logoutEndpoint: null,
    refreshEndpoint: null,
    credentialFields: [],
    oauthProviders: [],
    methods: [],
  };

  // Find auth-related files
  const authPaths = [
    'src/**/auth*.{js,ts}',
    'routes/**/auth*.{js,ts}',
    'api/**/auth*.{js,ts}',
    'server/**/auth*.{js,ts}',
  ];

  for (const pattern of authPaths) {
    const files = await glob(pattern, { cwd: projectRoot, ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'] });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Express/Node patterns
      const loginMatch = content.match(/(?:router|app)\.(post|get)\s*\(['"](\/(?:auth\/)?(?:login|signin))['"]/i);
      if (loginMatch) {
        result.loginEndpoint = `POST ${loginMatch[2]}`;
      }

      const registerMatch = content.match(/(?:router|app)\.(post)\s*\(['"](\/(?:auth\/)?(?:register|signup))['"]/i);
      if (registerMatch) {
        result.registerEndpoint = `POST ${registerMatch[2]}`;
      }

      const logoutMatch = content.match(/(?:router|app)\.(post|get)\s*\(['"](\/(?:auth\/)?logout)['"]/i);
      if (logoutMatch) {
        result.logoutEndpoint = `${logoutMatch[1].toUpperCase()} ${logoutMatch[2]}`;
      }

      // Check for JWT
      if (content.includes('jsonwebtoken') || content.includes('jwt')) {
        result.methods.push('jwt');
      }

      // Check for Passport.js
      if (content.includes('passport')) {
        result.methods.push('passport');
        if (content.includes('passport-google')) result.oauthProviders.push('google');
        if (content.includes('passport-github')) result.oauthProviders.push('github');
        if (content.includes('passport-facebook')) result.oauthProviders.push('facebook');
      }

      // Check for session
      if (content.includes('express-session') || content.includes('cookie-session')) {
        result.methods.push('session');
      }

      // Common credential fields
      if (content.includes('email')) result.credentialFields.push('email');
      if (content.includes('password')) result.credentialFields.push('password');
      if (content.includes('username')) result.credentialFields.push('username');
    }
  }

  // Dedupe
  result.credentialFields = [...new Set(result.credentialFields)];
  result.oauthProviders = [...new Set(result.oauthProviders)];
  result.methods = [...new Set(result.methods)];

  return result;
}

async function discoverFromFrontend(projectRoot, framework) {
  const result = {
    credentialFields: [],
    oauthProviders: [],
  };

  // Find login pages/components
  const loginPaths = [
    'src/**/*login*.{tsx,jsx,vue,svelte}',
    'pages/**/*login*.{tsx,jsx,vue,svelte}',
    'app/**/*login*.{tsx,jsx,vue,svelte}',
    'apps/web/src/**/*login*.{tsx,jsx,vue,svelte}',
  ];

  for (const pattern of loginPaths) {
    const files = await glob(pattern, { cwd: projectRoot, ignore: ['**/node_modules/**'], nocase: true });

    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for form fields
      if (content.includes('type="email"') || content.includes('name="email"')) {
        if (!result.credentialFields.includes('email')) {
          result.credentialFields.push('email');
        }
      }
      if (content.includes('type="password"') || content.includes('name="password"')) {
        if (!result.credentialFields.includes('password')) {
          result.credentialFields.push('password');
        }
      }
      if (content.includes('name="username"')) {
        if (!result.credentialFields.includes('username')) {
          result.credentialFields.push('username');
        }
      }

      // Check for OAuth buttons
      if (content.match(/google|Google/i)) result.oauthProviders.push('google');
      if (content.match(/github|GitHub/i)) result.oauthProviders.push('github');
      if (content.match(/facebook|Facebook/i)) result.oauthProviders.push('facebook');
    }
  }

  // Dedupe
  result.oauthProviders = [...new Set(result.oauthProviders)];

  return result;
}

function inferAuthType(result) {
  if (result.methods.includes('jwt')) return 'jwt';
  if (result.methods.includes('session')) return 'session';
  if (result.methods.includes('oauth2')) return 'oauth2';
  if (result.methods.includes('passport')) return 'passport';

  // Infer from endpoints
  if (result.loginEndpoint || result.registerEndpoint) {
    return 'jwt'; // Default assumption for API-based auth
  }

  return null;
}

export default { discoverAuth };
