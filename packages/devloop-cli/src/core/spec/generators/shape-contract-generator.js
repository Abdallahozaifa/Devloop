/**
 * Shape Contract Generator
 *
 * Auto-detects API response shapes from backend code and generates
 * spec tests with bodyIs validation to catch frontend/backend mismatches.
 *
 * Common bug pattern this catches:
 * - API returns { items: [], total: N } (paginated)
 * - Frontend calls response.filter() expecting raw array
 * - Results in runtime error or empty data
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Common paginated response patterns
const PAGINATED_PATTERNS = [
  // Python/FastAPI patterns
  { regex: /class\s+(\w+)ListResponse.*?items:\s*List\[/s, wrapper: 'items' },
  { regex: /class\s+(\w+)ListResponse.*?(\w+)s:\s*List\[/s, wrapperFromMatch: 2 },
  { regex: /return\s*\{["']items["']:\s*\w+,\s*["']total["']:/s, wrapper: 'items' },
  { regex: /return\s*\{["'](\w+)["']:\s*\w+,\s*["']total["']:/s, wrapperFromMatch: 1 },

  // Express/Node patterns
  { regex: /res\.json\(\{\s*items:\s*\w+,\s*total:/s, wrapper: 'items' },
  { regex: /res\.json\(\{\s*(\w+):\s*\w+,\s*total:/s, wrapperFromMatch: 1 },
  { regex: /return\s*\{\s*items:\s*\w+,\s*total:/s, wrapper: 'items' },

  // TypeScript interface patterns
  { regex: /interface\s+(\w+)ListResponse\s*\{[^}]*items:\s*\w+\[\]/s, wrapper: 'items' },
  { regex: /interface\s+(\w+)ListResponse\s*\{[^}]*(\w+):\s*\w+\[\][^}]*total:\s*number/s, wrapperFromMatch: 2 },
  { regex: /type\s+(\w+)ListResponse\s*=\s*\{[^}]*items:\s*\w+\[\]/s, wrapper: 'items' },
];

// Endpoint patterns to identify list endpoints
const LIST_ENDPOINT_PATTERNS = [
  { regex: /@router\.get\(["']\/["'].*?response_model=(\w+)ListResponse/s, method: 'GET' },
  { regex: /@app\.get\(["']\/(\w+)["'].*?response_model=(\w+)ListResponse/s, method: 'GET' },
  { regex: /router\.get\(["']\/["'],.*?list/si, method: 'GET' },
  { regex: /\.get\(["']\/(\w+)["'].*?\(req,\s*res\)/s, method: 'GET' },
];

/**
 * Analyze a file for paginated response patterns
 */
function analyzeFileForPaginatedResponses(filePath, content) {
  const results = [];

  for (const pattern of PAGINATED_PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      const wrapper = pattern.wrapper || (pattern.wrapperFromMatch && match[pattern.wrapperFromMatch]);
      if (wrapper) {
        results.push({
          file: filePath,
          wrapper,
          pattern: pattern.regex.toString().slice(0, 50) + '...',
        });
      }
    }
  }

  return results;
}

/**
 * Detect list endpoints and their response shapes
 */
function detectListEndpoints(filePath, content) {
  const endpoints = [];

  // Look for route definitions with list responses
  const routePatterns = [
    // FastAPI
    { regex: /@router\.get\(["']([^"']+)["'][^)]*\)[\s\S]*?response_model\s*=\s*(\w+)/g },
    { regex: /@app\.get\(["']([^"']+)["'][^)]*\)[\s\S]*?response_model\s*=\s*(\w+)/g },
    // Express
    { regex: /router\.get\(["']([^"']+)["']/g },
    { regex: /app\.get\(["']([^"']+)["']/g },
  ];

  for (const pattern of routePatterns) {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const path = match[1];
      const responseModel = match[2];

      // Check if this looks like a list endpoint
      if (path === '/' || path === '' || path.endsWith('/list') ||
          (responseModel && responseModel.includes('List'))) {
        endpoints.push({
          file: filePath,
          path,
          responseModel,
          isPaginated: responseModel?.includes('List') || false,
        });
      }
    }
  }

  return endpoints;
}

/**
 * Generate shape contract tests for detected patterns
 */
export function generateShapeContracts(projectRoot, options = {}) {
  const contracts = [];
  const searchDirs = options.searchDirs || ['app', 'api', 'src', 'routes', 'controllers'];
  const extensions = options.extensions || ['.py', '.ts', '.js'];

  for (const dir of searchDirs) {
    const searchPath = path.join(projectRoot, dir);
    if (!fs.existsSync(searchPath)) continue;

    for (const ext of extensions) {
      const files = glob.sync(`${searchPath}/**/*${ext}`);

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');

          // Analyze for paginated response patterns
          const paginatedResponses = analyzeFileForPaginatedResponses(file, content);

          // Detect list endpoints
          const listEndpoints = detectListEndpoints(file, content);

          // Generate contracts for paginated responses
          for (const response of paginatedResponses) {
            contracts.push({
              type: 'paginated_response',
              source: response.file,
              wrapper: response.wrapper,
              bodyIs: {
                [response.wrapper]: 'array',
                total: 'number',
              },
            });
          }

          // Generate contracts for list endpoints
          for (const endpoint of listEndpoints) {
            if (endpoint.isPaginated) {
              contracts.push({
                type: 'list_endpoint',
                source: endpoint.file,
                path: endpoint.path,
                method: 'GET',
                bodyIs: {
                  items: 'array',
                  total: 'number',
                },
              });
            }
          }
        } catch (err) {
          // Skip files that can't be read
        }
      }
    }
  }

  return contracts;
}

/**
 * Generate DevLoop spec tests from shape contracts
 */
export function generateSpecTests(contracts, options = {}) {
  const tests = [];

  for (const contract of contracts) {
    if (contract.type === 'list_endpoint') {
      tests.push({
        name: `${contract.path} returns paginated response`,
        as: options.role || 'user',
        request: {
          method: contract.method,
          path: contract.path,
        },
        expect: {
          status: 200,
          bodyIs: contract.bodyIs,
        },
      });
    } else if (contract.type === 'paginated_response') {
      // Create a generic test hint
      tests.push({
        name: `List endpoint returns { ${contract.wrapper}: array, total: number }`,
        hint: `Detected paginated response in ${path.basename(contract.source)}`,
        expect: {
          bodyIs: contract.bodyIs,
        },
      });
    }
  }

  return tests;
}

/**
 * Validate frontend code against detected shape contracts
 */
export function validateFrontendAgainstContracts(frontendRoot, contracts) {
  const issues = [];
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];

  for (const ext of extensions) {
    const files = glob.sync(`${frontendRoot}/**/*${ext}`, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');

        // Look for patterns that suggest direct array access on paginated responses
        const dangerousPatterns = [
          // data.filter() when data might be paginated
          { regex: /(\w+)\.filter\(/g, issue: 'Calling .filter() on potentially paginated response' },
          { regex: /(\w+)\.map\(/g, issue: 'Calling .map() on potentially paginated response' },
          { regex: /(\w+)\.forEach\(/g, issue: 'Calling .forEach() on potentially paginated response' },
          { regex: /(\w+)\.reduce\(/g, issue: 'Calling .reduce() on potentially paginated response' },
          { regex: /(\w+)\.length/g, issue: 'Accessing .length on potentially paginated response' },
        ];

        // Check for common hook data patterns
        const hookDataMatch = content.match(/const\s*\{\s*data:\s*(\w+)/g);
        if (hookDataMatch) {
          for (const pattern of dangerousPatterns) {
            const matches = content.matchAll(pattern.regex);
            for (const match of matches) {
              // Check if this variable is from a hook that might return paginated data
              const varName = match[1];
              if (content.includes(`data: ${varName}`) || content.includes(`data:${varName}`)) {
                // Check if there's proper unwrapping like data?.items or data.items
                const safePattern = new RegExp(`${varName}\\?\\.\\w+\\.${pattern.regex.source.replace('(\\w+)\\.', '')}|${varName}\\.\\w+\\.${pattern.regex.source.replace('(\\w+)\\.', '')}`);
                if (!safePattern.test(content)) {
                  issues.push({
                    file,
                    line: getLineNumber(content, match.index),
                    issue: pattern.issue,
                    variable: varName,
                    suggestion: `Use ${varName}?.items?.${match[0].split('.')[1]} or check the API response shape`,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
  }

  return issues;
}

/**
 * Get line number from character index
 */
function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

/**
 * Main function to analyze a project and generate shape contract report
 */
export async function analyzeProject(projectRoot, options = {}) {
  const backendDirs = options.backendDirs || ['app', 'api', 'src/api', 'server'];
  const frontendDirs = options.frontendDirs || ['apps/web', 'src', 'frontend', 'client'];

  // Generate contracts from backend
  const contracts = generateShapeContracts(projectRoot, {
    searchDirs: backendDirs,
  });

  // Validate frontend against contracts
  const issues = [];
  for (const frontendDir of frontendDirs) {
    const frontendPath = path.join(projectRoot, frontendDir);
    if (fs.existsSync(frontendPath)) {
      issues.push(...validateFrontendAgainstContracts(frontendPath, contracts));
    }
  }

  // Generate spec tests
  const specTests = generateSpecTests(contracts, options);

  return {
    contracts,
    issues,
    specTests,
    summary: {
      contractsFound: contracts.length,
      issuesFound: issues.length,
      testsGenerated: specTests.length,
    },
  };
}

export default {
  generateShapeContracts,
  generateSpecTests,
  validateFrontendAgainstContracts,
  analyzeProject,
};
