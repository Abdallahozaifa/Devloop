import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getProjectRoot, detectFramework } from './config.js';

// File patterns to ignore
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/venv/**',
  '**/.venv/**',
  '**/target/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/*.map',
];

// File extensions to read
const CODE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.pyi',
  '.go',
  '.rs',
  '.java', '.kt', '.scala',
  '.rb',
  '.php',
  '.vue', '.svelte',
  '.json', '.yaml', '.yml', '.toml',
  '.sql',
  '.md',
  '.sh', '.bash',
  '.css', '.scss', '.less',
  '.html',
];

// Max file size to read (100KB)
const MAX_FILE_SIZE = 100 * 1024;

export async function readCodebase(options = {}) {
  const projectRoot = options.root || getProjectRoot();
  const framework = detectFramework(projectRoot);

  const files = await glob('**/*', {
    cwd: projectRoot,
    ignore: IGNORE_PATTERNS,
    nodir: true,
    absolute: false,
  });

  const codeFiles = [];
  let totalSize = 0;
  const maxTotalSize = options.maxSize || 500 * 1024; // 500KB default total

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!CODE_EXTENSIONS.includes(ext)) continue;

    const fullPath = path.join(projectRoot, file);

    try {
      const stats = fs.statSync(fullPath);
      if (stats.size > MAX_FILE_SIZE) continue;
      if (totalSize + stats.size > maxTotalSize) continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      codeFiles.push({
        path: file,
        content,
        size: stats.size,
      });
      totalSize += stats.size;
    } catch {
      // Skip unreadable files
    }
  }

  // Sort by importance (prioritize entry points, configs, etc.)
  codeFiles.sort((a, b) => {
    const aScore = getFileImportance(a.path, framework);
    const bScore = getFileImportance(b.path, framework);
    return bScore - aScore;
  });

  return {
    projectRoot,
    framework,
    files: codeFiles,
    totalFiles: codeFiles.length,
    totalSize,
  };
}

function getFileImportance(filePath, framework) {
  let score = 0;
  const name = path.basename(filePath).toLowerCase();
  const dir = path.dirname(filePath).toLowerCase();

  // Config files
  if (name === 'package.json') score += 100;
  if (name === 'tsconfig.json') score += 90;
  if (name === 'requirements.txt') score += 100;
  if (name === 'pyproject.toml') score += 100;
  if (name === 'cargo.toml') score += 100;
  if (name === 'go.mod') score += 100;

  // Entry points
  if (name === 'main.ts' || name === 'main.js') score += 80;
  if (name === 'index.ts' || name === 'index.js') score += 75;
  if (name === 'app.ts' || name === 'app.js') score += 75;
  if (name === 'main.py' || name === 'app.py') score += 80;
  if (name === 'main.go') score += 80;
  if (name === 'main.rs' || name === 'lib.rs') score += 80;

  // Routes/API
  if (dir.includes('routes') || dir.includes('api')) score += 50;
  if (dir.includes('endpoints')) score += 50;

  // Components (for frontend)
  if (dir.includes('components')) score += 40;
  if (dir.includes('pages')) score += 45;

  // Models/schemas
  if (dir.includes('models') || dir.includes('schemas')) score += 45;

  // Services/utils
  if (dir.includes('services')) score += 40;
  if (dir.includes('utils') || dir.includes('helpers')) score += 30;

  // Tests (lower priority for context)
  if (dir.includes('test') || name.includes('.test.') || name.includes('.spec.')) score -= 20;

  return score;
}

export function buildContext(codebase, maxTokens = 100000) {
  const estimatedCharsPerToken = 4;
  const maxChars = maxTokens * estimatedCharsPerToken;

  let context = `# Project Analysis

**Framework:** ${codebase.framework.type}
**Language:** ${codebase.framework.language}
**Test Framework:** ${codebase.framework.testFramework}
**Files:** ${codebase.totalFiles}

---

# Codebase Contents

`;

  let currentChars = context.length;

  for (const file of codebase.files) {
    const fileSection = `
## ${file.path}

\`\`\`${getLanguage(file.path)}
${file.content}
\`\`\`

`;

    if (currentChars + fileSection.length > maxChars) {
      break;
    }

    context += fileSection;
    currentChars += fileSection.length;
  }

  return context;
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.rb': 'ruby',
    '.php': 'php',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.sql': 'sql',
    '.md': 'markdown',
    '.sh': 'bash',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
  };
  return langMap[ext] || '';
}

export function extractRoutes(codebase) {
  const routes = [];

  for (const file of codebase.files) {
    // Express.js routes
    const expressMatches = file.content.matchAll(/(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    for (const match of expressMatches) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: file.path,
      });
    }

    // FastAPI routes
    const fastapiMatches = file.content.matchAll(/@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi);
    for (const match of fastapiMatches) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: file.path,
      });
    }

    // Next.js API routes (file-based)
    if (file.path.includes('pages/api/') || file.path.includes('app/api/')) {
      const apiPath = file.path
        .replace('pages/api/', '/api/')
        .replace('app/api/', '/api/')
        .replace(/\[([^\]]+)\]/g, ':$1')
        .replace(/\/route\.(ts|js)$/, '')
        .replace(/\.(ts|js)$/, '');
      routes.push({
        method: 'GET',
        path: apiPath,
        file: file.path,
      });
    }
  }

  return routes;
}
