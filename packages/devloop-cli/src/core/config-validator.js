import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

/**
 * Config Validator for DevLoop CLI
 * Scans codebase for common configuration issues like:
 * - Hardcoded URLs that don't match production URLs
 * - Wrong API URL patterns
 * - Missing environment variables
 */

// Common patterns that indicate potential config issues
const CONFIG_PATTERNS = {
  // Hardcoded API URLs (should use env vars or relative URLs)
  hardcodedApiUrls: {
    pattern: /(['"`])https?:\/\/[a-zA-Z0-9-]+\.(fly\.dev|vercel\.app|railway\.app|herokuapp\.com|netlify\.app)[^'"`]*(['"`])/g,
    severity: 'warning',
    message: 'Hardcoded deployment URL found - should use environment variables',
    fileTypes: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.svelte'],
  },

  // API URL fallbacks that might be wrong
  wrongApiUrlPattern: {
    pattern: /\|\|\s*(['"`])https?:\/\/[a-zA-Z0-9-]+-api\./g,
    severity: 'error',
    message: 'Hardcoded API URL in fallback - verify this matches your actual API domain',
    fileTypes: ['.js', '.ts', '.tsx', '.jsx'],
  },

  // fetch() calls with hardcoded URLs
  hardcodedFetch: {
    pattern: /fetch\s*\(\s*(['"`])https?:\/\/(?!localhost)[^'"`]+(['"`])/g,
    severity: 'warning',
    message: 'fetch() with hardcoded URL - consider using environment variable',
    fileTypes: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.svelte'],
  },

  // Environment variable that might be undefined
  undefinedEnvVar: {
    pattern: /process\.env\.([A-Z_][A-Z0-9_]*)\s*\|\|/g,
    severity: 'info',
    message: 'Environment variable with fallback - ensure fallback is correct',
    fileTypes: ['.js', '.ts'],
  },

  // Vite env vars with fallback
  viteEnvFallback: {
    pattern: /import\.meta\.env\.([A-Z_][A-Z0-9_]*)\s*\|\|/g,
    severity: 'info',
    message: 'Vite env variable with fallback - ensure fallback is correct for production',
    fileTypes: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.svelte'],
  },
};

// URL domains to flag as potentially misconfigured
const SUSPICIOUS_DOMAIN_PATTERNS = [
  /-api\.(fly\.dev|vercel\.app)/,  // *-api.fly.dev might be wrong if API is on same domain
  /localhost:\d+/,                   // localhost shouldn't appear in production code
  /127\.0\.0\.1/,                    // Same as localhost
];

/**
 * Validate configuration across the codebase
 * @param {string} projectRoot - Root directory of the project
 * @param {Object} options - Validation options
 * @returns {Array} Array of validation issues
 */
export async function validateConfig(projectRoot, options = {}) {
  const issues = [];
  const {
    verbose = false,
    includeDirs = ['src', 'app', 'pages', 'components', 'lib', 'utils'],
    excludeDirs = ['node_modules', 'dist', 'build', '.next', '.nuxt', 'coverage'],
  } = options;

  // Find all relevant files
  const filePatterns = includeDirs.map(dir => path.join(projectRoot, dir, '**/*.{js,ts,tsx,jsx,vue,svelte}'));

  let files = [];
  for (const pattern of filePatterns) {
    try {
      const matches = await glob(pattern, {
        ignore: excludeDirs.map(d => `**/${d}/**`),
        nodir: true,
      });
      files = files.concat(matches);
    } catch {
      // Directory might not exist, that's okay
    }
  }

  // Also check root-level config files
  const rootConfigs = ['next.config.js', 'vite.config.ts', 'vite.config.js', 'nuxt.config.ts'];
  for (const configFile of rootConfigs) {
    const configPath = path.join(projectRoot, configFile);
    if (fs.existsSync(configPath)) {
      files.push(configPath);
    }
  }

  // Scan each file
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(projectRoot, filePath);
      const fileExt = path.extname(filePath);

      // Check each pattern
      for (const [name, config] of Object.entries(CONFIG_PATTERNS)) {
        if (!config.fileTypes.includes(fileExt)) continue;

        const matches = content.matchAll(config.pattern);
        for (const match of matches) {
          const lineNumber = getLineNumber(content, match.index);
          const context = getContext(content, match.index);

          // Check if this is in a comment
          if (isInComment(content, match.index)) continue;

          // Additional checks for suspicious domains
          let extraInfo = '';
          if (name === 'hardcodedApiUrls' || name === 'wrongApiUrlPattern' || name === 'hardcodedFetch') {
            for (const domainPattern of SUSPICIOUS_DOMAIN_PATTERNS) {
              if (domainPattern.test(match[0])) {
                extraInfo = ' (suspicious domain pattern detected)';
                break;
              }
            }
          }

          issues.push({
            type: name,
            severity: config.severity,
            file: relativePath,
            line: lineNumber,
            message: config.message + extraInfo,
            match: match[0].substring(0, 100) + (match[0].length > 100 ? '...' : ''),
            context: context,
          });
        }
      }

      // Special check: API URL inconsistency
      const apiUrlCheck = checkApiUrlConsistency(content, relativePath);
      if (apiUrlCheck) {
        issues.push(apiUrlCheck);
      }

    } catch (err) {
      if (verbose) {
        console.warn(`Could not scan ${filePath}: ${err.message}`);
      }
    }
  }

  // Check environment files
  const envIssues = await checkEnvFiles(projectRoot);
  issues.push(...envIssues);

  return issues;
}

/**
 * Check for API URL consistency issues
 */
function checkApiUrlConsistency(content, filePath) {
  // Look for patterns like:
  // const apiUrl = env.VITE_API_URL || 'https://wrong-url'
  const urlFallbackPattern = /(?:api[_-]?url|API[_-]?URL|apiUrl)\s*=\s*(?:import\.meta\.)?(?:env|process)\.(?:env\.)?[A-Z_]+\s*\|\|\s*(['"`])([^'"`]+)\1/gi;

  const matches = content.matchAll(urlFallbackPattern);
  for (const match of matches) {
    const fallbackUrl = match[2];

    // Check if fallback contains suspicious patterns
    if (/-api\.(fly|vercel|railway|heroku)/.test(fallbackUrl)) {
      const lineNumber = getLineNumber(content, match.index);
      return {
        type: 'apiUrlMismatch',
        severity: 'error',
        file: filePath,
        line: lineNumber,
        message: 'API URL fallback may be incorrect - common pattern is API on same domain with /api prefix',
        match: match[0],
        suggestion: 'For production, use relative URLs (empty string or \'/api/v1\') instead of hardcoded domain',
      };
    }
  }
  return null;
}

/**
 * Check .env files for common issues
 */
async function checkEnvFiles(projectRoot) {
  const issues = [];

  const envFiles = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    if (!fs.existsSync(envPath)) continue;

    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || !line.trim()) return;

        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (!match) return;

        const [, key, value] = match;

        // Check for placeholder values
        if (value.includes('your-') || value.includes('YOUR_') || value.includes('xxx') || value.includes('changeme')) {
          issues.push({
            type: 'placeholderEnvValue',
            severity: 'warning',
            file: envFile,
            line: index + 1,
            message: `Environment variable ${key} appears to have a placeholder value`,
            match: `${key}=${value.substring(0, 30)}...`,
          });
        }

        // Check for localhost in production env
        if (envFile.includes('production') && (value.includes('localhost') || value.includes('127.0.0.1'))) {
          issues.push({
            type: 'localhostInProduction',
            severity: 'error',
            file: envFile,
            line: index + 1,
            message: `Environment variable ${key} contains localhost in production config`,
            match: `${key}=${value}`,
          });
        }
      });
    } catch {
      // Ignore file read errors
    }
  }

  return issues;
}

/**
 * Get line number from string index
 */
function getLineNumber(content, index) {
  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

/**
 * Get context around a match
 */
function getContext(content, index, contextLength = 80) {
  const start = Math.max(0, index - contextLength / 2);
  const end = Math.min(content.length, index + contextLength / 2);
  let context = content.substring(start, end);

  // Clean up for display
  context = context.replace(/\n/g, ' ').trim();
  if (start > 0) context = '...' + context;
  if (end < content.length) context = context + '...';

  return context;
}

/**
 * Check if index is inside a comment
 */
function isInComment(content, index) {
  // Simple check - look for // before the index on the same line
  const lineStart = content.lastIndexOf('\n', index) + 1;
  const lineContent = content.substring(lineStart, index);
  return lineContent.includes('//') || lineContent.includes('/*');
}

/**
 * Format issues for display
 */
export function formatIssues(issues) {
  if (issues.length === 0) {
    return chalk.green('No configuration issues found!');
  }

  let output = '';

  // Group by severity
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    output += chalk.red.bold(`\nErrors (${errors.length}):\n`);
    errors.forEach(issue => {
      output += formatIssue(issue, chalk.red);
    });
  }

  if (warnings.length > 0) {
    output += chalk.yellow.bold(`\nWarnings (${warnings.length}):\n`);
    warnings.forEach(issue => {
      output += formatIssue(issue, chalk.yellow);
    });
  }

  if (infos.length > 0) {
    output += chalk.blue.bold(`\nInfo (${infos.length}):\n`);
    infos.forEach(issue => {
      output += formatIssue(issue, chalk.blue);
    });
  }

  return output;
}

function formatIssue(issue, colorFn) {
  let output = '';
  output += `  ${colorFn('●')} ${chalk.white(issue.file)}:${issue.line}\n`;
  output += `    ${issue.message}\n`;
  output += chalk.gray(`    ${issue.match}\n`);
  if (issue.suggestion) {
    output += chalk.cyan(`    Suggestion: ${issue.suggestion}\n`);
  }
  output += '\n';
  return output;
}

/**
 * Quick scan for common API URL misconfigurations
 * Returns true if issues found
 */
export async function quickScan(projectRoot) {
  const issues = await validateConfig(projectRoot, { verbose: false });
  const criticalIssues = issues.filter(i => i.severity === 'error');
  return {
    hasIssues: issues.length > 0,
    hasCritical: criticalIssues.length > 0,
    count: issues.length,
    criticalCount: criticalIssues.length,
  };
}
