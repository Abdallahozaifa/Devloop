/**
 * Pattern Matcher Module
 * Loads and matches patterns from the patterns database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load patterns database
let patterns = null;
let learnedPatterns = null;

/**
 * Load patterns from JSON file
 */
export function loadPatterns() {
  if (patterns) return patterns;

  const patternsPath = path.join(__dirname, '../data/patterns.json');
  try {
    patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
    return patterns;
  } catch (err) {
    console.warn('Warning: Could not load patterns.json:', err.message);
    return getDefaultPatterns();
  }
}

/**
 * Load learned patterns from GitHub extraction
 */
export function loadLearnedPatterns() {
  if (learnedPatterns) return learnedPatterns;

  const learnedPath = path.join(__dirname, '../data/learned-patterns.json');
  try {
    learnedPatterns = JSON.parse(fs.readFileSync(learnedPath, 'utf8'));
    return learnedPatterns;
  } catch (err) {
    // Learned patterns are optional
    return null;
  }
}

/**
 * Get learned health endpoints (from 100 GitHub repos)
 */
export function getLearnedHealthEndpoints() {
  const learned = loadLearnedPatterns();
  if (!learned?.healthEndpoints) {
    return ['/health', '/healthz', '/ping', '/status'];
  }

  // Return endpoints sorted by frequency
  return learned.healthEndpoints.map(e => e.path);
}

/**
 * Get learned API base paths (from 100 GitHub repos)
 */
export function getLearnedApiBasePaths() {
  const learned = loadLearnedPatterns();
  if (!learned?.apiBasePaths) {
    return ['/api/v1', '/api', '/v1', ''];
  }

  // Filter to API-like paths and sort by frequency
  return learned.apiBasePaths
    .filter(p => p.path.startsWith('/') && p.path !== '/')
    .map(p => p.path);
}

/**
 * Get default patterns if file fails to load
 */
function getDefaultPatterns() {
  return {
    hostingPlatforms: {
      'fly.io': {
        name: 'Fly.io',
        detection: { files: ['fly.toml'], configKey: 'app' },
        urlPatterns: [
          { template: 'https://{app}.fly.dev', type: 'frontend', priority: 1 },
          { template: 'https://{app}.fly.dev/api/v1', type: 'api', priority: 1 },
          { template: 'https://{app}.fly.dev/api', type: 'api', priority: 2 },
          { template: 'https://{app}-api.fly.dev', type: 'api', priority: 3 },
        ],
        healthEndpoints: ['/health', '/healthz', '/', '/api/health'],
      },
    },
    testEndpoints: {
      health: ['/health', '/healthz', '/api/health', '/api/v1/health'],
      docs: ['/docs', '/redoc', '/openapi.json'],
    },
    commonBugs: {},
  };
}

/**
 * Detect hosting platform from project files
 */
export function detectHostingPlatform(projectRoot) {
  const patternsDb = loadPatterns();
  const platforms = patternsDb.hostingPlatforms;

  for (const [platformId, platform] of Object.entries(platforms)) {
    const detection = platform.detection;

    // Check for detection files
    if (detection.files) {
      for (const file of detection.files) {
        const filePath = path.join(projectRoot, file);
        if (fs.existsSync(filePath)) {
          // Try to extract app name from config
          let appName = null;
          try {
            const content = fs.readFileSync(filePath, 'utf8');

            if (detection.configKey) {
              // Try TOML format: app = "name"
              const tomlMatch = content.match(new RegExp(`^${detection.configKey}\\s*=\\s*["']?([^"'\\s\\n]+)["']?`, 'm'));
              if (tomlMatch) {
                appName = tomlMatch[1];
              }

              // Try JSON format: "name": "value"
              if (!appName && file.endsWith('.json')) {
                const json = JSON.parse(content);
                appName = json[detection.configKey];
              }
            }
          } catch (e) {
            // Ignore parse errors
          }

          return {
            platform: platformId,
            platformName: platform.name,
            appName,
            configFile: file,
            urlPatterns: platform.urlPatterns,
            healthEndpoints: platform.healthEndpoints,
          };
        }
      }
    }

    // Check environment variables
    if (detection.envVars) {
      for (const envVar of detection.envVars) {
        if (process.env[envVar]) {
          return {
            platform: platformId,
            platformName: platform.name,
            appName: process.env[envVar],
            configFile: null,
            urlPatterns: platform.urlPatterns,
            healthEndpoints: platform.healthEndpoints,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Generate URL candidates from hosting platform patterns
 */
export function generateUrlCandidates(appName, platformInfo) {
  if (!appName || !platformInfo) return [];

  const candidates = [];

  for (const pattern of platformInfo.urlPatterns) {
    const url = pattern.template.replace('{app}', appName);
    candidates.push({
      url,
      type: pattern.type,
      priority: pattern.priority,
      pattern: pattern.template,
    });
  }

  // Sort by priority (lower is better)
  candidates.sort((a, b) => a.priority - b.priority);

  return candidates;
}

/**
 * Get health endpoints to test
 */
export function getHealthEndpoints(platformInfo) {
  const patternsDb = loadPatterns();

  // Use platform-specific endpoints if available
  if (platformInfo?.healthEndpoints) {
    return platformInfo.healthEndpoints;
  }

  // Fall back to default test endpoints
  return patternsDb.testEndpoints?.health || ['/health', '/healthz', '/'];
}

/**
 * Analyze error and match to known bug patterns
 */
export function analyzeError(statusCode, errorMessage) {
  const patternsDb = loadPatterns();
  const bugs = patternsDb.commonBugs;

  for (const [bugId, bug] of Object.entries(bugs)) {
    // Check status codes
    if (bug.statusCodes?.includes(statusCode)) {
      return {
        bugType: bugId,
        name: bug.name,
        causes: bug.causes,
        fixes: bug.fixes,
        codeHints: bug.codeHints,
      };
    }

    // Check symptoms in error message
    if (errorMessage && bug.symptoms) {
      const lowerMessage = errorMessage.toLowerCase();
      for (const symptom of bug.symptoms) {
        if (lowerMessage.includes(symptom.toLowerCase())) {
          return {
            bugType: bugId,
            name: bug.name,
            causes: bug.causes,
            fixes: bug.fixes,
            codeHints: bug.codeHints,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Detect framework from project files
 */
export function detectFramework(projectRoot) {
  const patternsDb = loadPatterns();
  const frameworks = patternsDb.frameworks;
  const results = [];

  for (const [frameworkId, framework] of Object.entries(frameworks)) {
    let score = 0;
    const indicators = framework.indicators;

    // Check for indicator files
    if (indicators.files) {
      for (const file of indicators.files) {
        const filePath = path.join(projectRoot, file);
        if (fs.existsSync(filePath)) {
          score += 10;
        }
      }
    }

    // Check structure directories
    if (framework.structure?.common) {
      for (const dir of framework.structure.common) {
        const dirPath = path.join(projectRoot, dir);
        if (fs.existsSync(dirPath)) {
          score += 5;
        }
      }
    }

    if (score > 0) {
      results.push({
        framework: frameworkId,
        name: framework.name,
        type: framework.type,
        score,
        apiPatterns: framework.apiPatterns,
        authPatterns: framework.authPatterns,
      });
    }
  }

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Get API base paths to try for a framework
 */
export function getApiBasePaths(frameworkId) {
  const patternsDb = loadPatterns();
  const framework = patternsDb.frameworks?.[frameworkId];

  if (framework?.apiPatterns?.basePaths) {
    return framework.apiPatterns.basePaths;
  }

  // Default base paths
  return ['/api/v1', '/api', '/v1', ''];
}

/**
 * Get auth endpoints for a framework
 */
export function getAuthEndpoints(frameworkId) {
  const patternsDb = loadPatterns();
  const framework = patternsDb.frameworks?.[frameworkId];

  if (framework?.authPatterns?.endpoints) {
    return framework.authPatterns.endpoints;
  }

  // Default auth endpoints
  return ['/auth/login', '/auth/register', '/login', '/register'];
}

/**
 * Smart URL prober using pattern database AND learned patterns
 */
export async function probeUrlsWithPatterns(projectRoot, frontendUrl, options = {}) {
  const { verbose = false, timeout = 3000 } = options;

  // Detect hosting platform
  const platformInfo = detectHostingPlatform(projectRoot);

  let candidates = [];

  if (platformInfo?.appName) {
    if (verbose) {
      console.log(`  Detected ${platformInfo.platformName} (app: ${platformInfo.appName})`);
    }

    // Generate candidates from platform patterns
    candidates = generateUrlCandidates(platformInfo.appName, platformInfo);
  }

  // If no platform detected or no candidates, generate from frontend URL
  if (candidates.length === 0 && frontendUrl) {
    candidates = generateCandidatesFromUrl(frontendUrl);
  }

  // Get health endpoints - prioritize learned patterns from 100 GitHub repos
  const learnedHealthEndpoints = getLearnedHealthEndpoints();
  const platformHealthEndpoints = getHealthEndpoints(platformInfo);

  // Merge learned patterns (higher priority) with platform-specific endpoints
  const healthEndpointSet = new Set([...learnedHealthEndpoints, ...platformHealthEndpoints]);
  const healthEndpoints = [...healthEndpointSet];

  if (verbose) {
    console.log(`  Using ${healthEndpoints.length} health endpoints from learned patterns`);
  }

  if (verbose && candidates.length > 0) {
    console.log(`  Testing ${candidates.length} URL patterns...`);
  }

  // Test each candidate
  for (const candidate of candidates) {
    if (candidate.type !== 'api') continue;

    for (const healthPath of healthEndpoints) {
      const testUrl = candidate.url + healthPath;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'DevLoop-QA/1.0' },
        });

        clearTimeout(timeoutId);

        // Found working endpoint
        if (response.ok || response.status === 401 || response.status === 403) {
          return {
            url: candidate.url,
            pattern: candidate.pattern,
            healthEndpoint: healthPath,
            platform: platformInfo?.platformName,
          };
        }
      } catch (e) {
        // Connection failed, try next
        continue;
      }
    }
  }

  return null;
}

/**
 * Generate URL candidates from a frontend URL (fallback)
 * Uses learned API base paths from 100 GitHub repos
 */
function generateCandidatesFromUrl(frontendUrl) {
  const candidates = [];

  try {
    const url = new URL(frontendUrl);
    const hostname = url.hostname;
    const protocol = url.protocol;

    // Get learned API base paths from GitHub repos analysis
    const learnedPaths = getLearnedApiBasePaths();

    // Add learned paths with high priority (from real-world repos)
    let priority = 1;
    for (const basePath of learnedPaths.slice(0, 5)) { // Top 5 learned paths
      candidates.push({
        url: `${protocol}//${hostname}${basePath}`,
        type: 'api',
        priority: priority++,
        pattern: `learned: ${basePath}`
      });
    }

    // Same origin patterns (hardcoded defaults as fallback)
    candidates.push({ url: `${protocol}//${hostname}/api/v1`, type: 'api', priority: priority++, pattern: 'same-origin /api/v1' });
    candidates.push({ url: `${protocol}//${hostname}/api`, type: 'api', priority: priority++, pattern: 'same-origin /api' });

    // Subdomain pattern
    if (!hostname.startsWith('api.')) {
      candidates.push({ url: `${protocol}//api.${hostname}`, type: 'api', priority: priority++, pattern: 'api. subdomain' });
    }

    // Platform-specific patterns
    if (hostname.endsWith('.fly.dev')) {
      const appName = hostname.replace('.fly.dev', '');
      candidates.push({ url: `${protocol}//${appName}-api.fly.dev`, type: 'api', priority: priority++, pattern: 'app-api.fly.dev' });
      candidates.push({ url: `${protocol}//${appName}-api.fly.dev/api/v1`, type: 'api', priority: priority++, pattern: 'app-api.fly.dev/api/v1' });
    }

    if (hostname.endsWith('.vercel.app')) {
      const appName = hostname.replace('.vercel.app', '');
      candidates.push({ url: `${protocol}//${appName}-api.vercel.app`, type: 'api', priority: priority++, pattern: 'app-api.vercel.app' });
    }

  } catch (e) {
    // Invalid URL
  }

  return candidates;
}

export default {
  loadPatterns,
  loadLearnedPatterns,
  detectHostingPlatform,
  generateUrlCandidates,
  getHealthEndpoints,
  getLearnedHealthEndpoints,
  getLearnedApiBasePaths,
  analyzeError,
  detectFramework,
  getApiBasePaths,
  getAuthEndpoints,
  probeUrlsWithPatterns,
};
