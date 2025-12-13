/**
 * Clear error messages with actionable fixes
 */

export const ERROR_HELP = {
  'PUPPETEER_NOT_FOUND': {
    message: 'Puppeteer not found - required for UI tests',
    fix: 'npm install puppeteer',
    alternative: 'devloop test --skip-ui'
  },
  'AUTH_FAILED': {
    message: 'Authentication failed',
    fix: 'Check credentials in .devloop/config.yaml',
    docs: 'https://devloop.dev/docs/auth'
  },
  'SPEC_PARSE_ERROR': {
    message: 'Failed to parse spec file',
    fix: 'Check YAML syntax in your spec files',
    hint: 'Run: devloop spec validate'
  },
  'API_UNREACHABLE': {
    message: 'API URL is not reachable',
    fix: 'Check --api-url and ensure server is running'
  },
  'NO_SPECS_FOUND': {
    message: 'No spec files found',
    fix: 'Run: devloop spec generate -y',
    hint: 'Specs should be in .devloop/specs/'
  },
  'INVALID_SPEC': {
    message: 'Spec file has invalid structure',
    fix: 'Ensure spec has required fields: name, tests',
    hint: 'See https://devloop.dev/docs/specs'
  },
  'LICENSE_INVALID': {
    message: 'License key is invalid or expired',
    fix: 'Check your license at https://devloop.dev/account',
    hint: 'Set DEVLOOP_LICENSE_KEY env or use devloop init'
  },
  'LICENSE_MISSING': {
    message: 'No license key found',
    fix: 'Run: devloop init',
    hint: 'Or set DEVLOOP_LICENSE_KEY environment variable'
  },
  'RATE_LIMITED': {
    message: 'Rate limit exceeded',
    fix: 'Wait a few minutes before running again',
    hint: 'Upgrade plan for higher limits'
  },
  'NETWORK_ERROR': {
    message: 'Network request failed',
    fix: 'Check your internet connection',
    hint: 'Also verify the API URL is correct'
  },
  'CONFIG_MISSING': {
    message: 'DevLoop config not found',
    fix: 'Run: devloop init',
    hint: 'Creates .devloop/config.yaml'
  },
  'TIMEOUT': {
    message: 'Request timed out',
    fix: 'Check if the server is responding slowly',
    hint: 'Try increasing timeout in config'
  },
  'WRITE_BLOCKED': {
    message: 'Write operation blocked (read-only mode)',
    fix: 'Use --allow-writes to enable POST/PUT/DELETE tests',
    hint: 'Read-only mode is the default for safety'
  }
};

/**
 * Format an error with helpful context
 * @param {string} errorCode - Error code from ERROR_HELP
 * @param {object} details - Additional context
 * @returns {string} Formatted error message
 */
export function formatError(errorCode, details = {}) {
  const help = ERROR_HELP[errorCode];
  if (!help) return `Error: ${errorCode}${details.message ? ` - ${details.message}` : ''}`;

  let output = `\n❌ ${help.message}`;
  if (details.context) output += `\n   ${details.context}`;
  output += `\n\n   Fix: ${help.fix}`;
  if (help.alternative) output += `\n   Or:  ${help.alternative}`;
  if (help.hint) output += `\n   Hint: ${help.hint}`;
  if (help.docs) output += `\n   Docs: ${help.docs}`;
  output += '\n';

  return output;
}

/**
 * Detect error type from error object and format
 * @param {Error} error - Error object
 * @returns {string} Formatted error message
 */
export function formatErrorFromException(error) {
  const message = error.message || String(error);

  // Detect known error patterns
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return formatError('API_UNREACHABLE', { context: message });
  }
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return formatError('TIMEOUT', { context: message });
  }
  if (message.includes('puppeteer')) {
    return formatError('PUPPETEER_NOT_FOUND', { context: message });
  }
  if (message.includes('401') || message.includes('Unauthorized')) {
    return formatError('AUTH_FAILED', { context: message });
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return formatError('RATE_LIMITED', { context: message });
  }
  if (message.includes('YAML') || message.includes('parse')) {
    return formatError('SPEC_PARSE_ERROR', { context: message });
  }

  // Generic error
  return `\n❌ ${message}\n`;
}

export default {
  ERROR_HELP,
  formatError,
  formatErrorFromException,
};
