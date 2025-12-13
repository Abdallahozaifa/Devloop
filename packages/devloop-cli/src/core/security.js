/**
 * Security utilities - never log secrets
 */

const SECRET_PATTERNS = [
  /Bearer [A-Za-z0-9-_.]+/gi,
  /password["']?\s*[:=]\s*["'][^"']+["']/gi,
  /token["']?\s*[:=]\s*["'][^"']+["']/gi,
  /api[_-]?key["']?\s*[:=]\s*["'][^"']+["']/gi,
  /secret["']?\s*[:=]\s*["'][^"']+["']/gi,
  /sk_live_[A-Za-z0-9]+/gi,
  /sk_test_[A-Za-z0-9]+/gi,
  /pk_live_[A-Za-z0-9]+/gi,
  /pk_test_[A-Za-z0-9]+/gi,
  /ANTHROPIC_API_KEY=[^\s]+/gi,
  /OPENAI_API_KEY=[^\s]+/gi,
  /DATABASE_URL=[^\s]+/gi,
  /Authorization:\s*Bearer\s+[^\s]+/gi,
  /"access_token":\s*"[^"]+"/gi,
  /"refresh_token":\s*"[^"]+"/gi,
];

/**
 * Redact sensitive information from a string
 * @param {string} str - String to redact
 * @returns {string} Redacted string
 */
export function redact(str) {
  if (typeof str !== 'string') return str;

  let redacted = str;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      // Keep the key/prefix, redact the value
      const colonIndex = match.indexOf(':');
      const equalIndex = match.indexOf('=');
      const sepIndex = colonIndex > -1 ? colonIndex : equalIndex;

      if (sepIndex > -1) {
        const prefix = match.substring(0, sepIndex + 1);
        return `${prefix} [REDACTED]`;
      }

      // For Bearer tokens, keep "Bearer" prefix
      if (match.toLowerCase().startsWith('bearer')) {
        return 'Bearer [REDACTED]';
      }

      return '[REDACTED]';
    });
  }
  return redacted;
}

/**
 * Safe console.log that redacts secrets
 * @param {...any} args - Arguments to log
 */
export function safeLog(...args) {
  const redactedArgs = args.map(arg => {
    if (typeof arg === 'string') return redact(arg);
    if (typeof arg === 'object' && arg !== null) {
      try {
        return redact(JSON.stringify(arg, null, 2));
      } catch {
        return arg;
      }
    }
    return arg;
  });
  console.log(...redactedArgs);
}

/**
 * Redact sensitive fields from a config object
 * @param {object} config - Config object to redact
 * @returns {object} Redacted config
 */
export function redactConfig(config) {
  if (!config || typeof config !== 'object') return config;

  const safe = { ...config };

  // Redact credentials
  if (safe.credentials) {
    safe.credentials = {};
    for (const [role, creds] of Object.entries(config.credentials)) {
      safe.credentials[role] = {
        ...creds,
        password: creds?.password ? '[REDACTED]' : undefined,
        token: creds?.token ? '[REDACTED]' : undefined,
        api_key: creds?.api_key ? '[REDACTED]' : undefined,
      };
    }
  }

  // Redact top-level secrets
  if (safe.license_key) {
    safe.license_key = safe.license_key.substring(0, 8) + '...[REDACTED]';
  }
  if (safe.api_key) {
    safe.api_key = '[REDACTED]';
  }
  if (safe.database_url) {
    safe.database_url = '[REDACTED]';
  }

  return safe;
}

/**
 * Redact headers object for logging
 * @param {object} headers - Headers to redact
 * @returns {object} Redacted headers
 */
export function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;

  const safe = { ...headers };
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

  for (const key of Object.keys(safe)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      safe[key] = '[REDACTED]';
    }
  }

  return safe;
}

export default {
  redact,
  safeLog,
  redactConfig,
  redactHeaders,
};
