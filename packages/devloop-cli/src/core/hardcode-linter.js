
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// These patterns are forbidden in the DevLoop source code.
export const FORBIDDEN_PATTERNS = [
  '/api',
  '/api/v1',
  'apps/',
  'src/',
  'frontend/',
  'backend/',
  'prod',
  'staging',
  'Authorization',
  'Bearer',
];

// Files to ignore during the scan.
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/package-lock.json',
  '**/test-violation.js', // For testing the doctor command
  '**/hardcode-linter.js', // This file itself
  '**/patterns.json',
  '**/data/learned-patterns.json',
];

export async function runHardcodeLinter() {
  const violations = [];
  const projectRoot = path.resolve(__dirname, '../../'); // Get the root of the devloop-cli package

  const searchPromises = FORBIDDEN_PATTERNS.map(pattern => 
    search_file_content({
      pattern: pattern,
      dir_path: projectRoot,
      no_ignore: true, // Search all files, we will filter later
      case_sensitive: true,
    })
  );

  const results = await Promise.all(searchPromises);

  results.forEach((result, i) => {
    const pattern = FORBIDDEN_PATTERNS[i];
    if (result && Array.isArray(result)) {
      result.forEach(match => {
        const isIgnored = IGNORE_PATTERNS.some(ignorePattern => {
          // Simple glob matching for now
          const regex = new RegExp(ignorePattern.replace(/\*\*/g, '.*'));
          return regex.test(match.file);
        });

        if (!isIgnored) {
          violations.push({
            file: match.file,
            line: match.line,
            match: pattern,
          });
        }
      });
    }
  });

  return violations;
}
