import fs from 'fs';
import path from 'path';
import { FastAPIExtractor } from './fastapi.js';

/**
 * Framework detection and extractor selection
 *
 * Detects the backend framework used in a project and returns
 * the appropriate extractor instance.
 */

// Registry of available extractors
const extractors = {
  fastapi: FastAPIExtractor,
  // Future extractors:
  // django: DjangoExtractor,
  // nestjs: NestJSExtractor,
  // express: ExpressExtractor,
  // flask: FlaskExtractor,
};

/**
 * Detect the backend framework used in a project
 * @param {string} projectPath - Path to the project root
 * @returns {Promise<string|null>} Framework name or null if unknown
 */
export async function detectFramework(projectPath) {
  // Check for Python backends first
  const pythonResult = await detectPythonFramework(projectPath);
  if (pythonResult) return pythonResult;

  // Check for Node.js backends
  const nodeResult = await detectNodeFramework(projectPath);
  if (nodeResult) return nodeResult;

  // Check for other ecosystems
  const otherResult = await detectOtherFramework(projectPath);
  if (otherResult) return otherResult;

  return null;
}

async function detectPythonFramework(projectPath) {
  const pythonIndicators = [
    {
      file: 'requirements.txt',
      check: (content) => {
        if (content.includes('fastapi')) return 'fastapi';
        if (content.includes('django')) return 'django';
        if (content.includes('flask')) return 'flask';
        if (content.includes('starlette')) return 'starlette';
        return null;
      },
    },
    {
      file: 'pyproject.toml',
      check: (content) => {
        if (content.includes('fastapi')) return 'fastapi';
        if (content.includes('django')) return 'django';
        if (content.includes('flask')) return 'flask';
        return null;
      },
    },
    {
      file: 'Pipfile',
      check: (content) => {
        if (content.includes('fastapi')) return 'fastapi';
        if (content.includes('django')) return 'django';
        if (content.includes('flask')) return 'flask';
        return null;
      },
    },
  ];

  // Check in multiple locations
  const basePaths = ['', 'api/', 'backend/', 'server/', 'app/'];

  for (const basePath of basePaths) {
    for (const indicator of pythonIndicators) {
      const filePath = path.join(projectPath, basePath, indicator.file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const detected = indicator.check(content);
          if (detected) return detected;
        } catch (e) {
          // Continue
        }
      }
    }
  }

  return null;
}

async function detectNodeFramework(projectPath) {
  const nodePaths = [
    path.join(projectPath, 'package.json'),
    path.join(projectPath, 'api/package.json'),
    path.join(projectPath, 'backend/package.json'),
    path.join(projectPath, 'server/package.json'),
    path.join(projectPath, 'apps/api/package.json'),
  ];

  for (const pkgPath of nodePaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.express) return 'express';
        if (deps.fastify) return 'fastify';
        if (deps.koa) return 'koa';
        if (deps.hapi || deps['@hapi/hapi']) return 'hapi';
        if (deps.nestjs || deps['@nestjs/core']) return 'nestjs';
        if (deps.hono) return 'hono';
        if (deps.elysia) return 'elysia';
      } catch (e) {
        // Continue
      }
    }
  }

  return null;
}

async function detectOtherFramework(projectPath) {
  // Go
  const goMod = path.join(projectPath, 'go.mod');
  if (fs.existsSync(goMod)) {
    const content = fs.readFileSync(goMod, 'utf8');
    if (content.includes('gin-gonic/gin')) return 'gin';
    if (content.includes('labstack/echo')) return 'echo';
    if (content.includes('gofiber/fiber')) return 'fiber';
    return 'go';
  }

  // Ruby/Rails
  const gemfile = path.join(projectPath, 'Gemfile');
  if (fs.existsSync(gemfile)) {
    const content = fs.readFileSync(gemfile, 'utf8');
    if (content.includes('rails')) return 'rails';
    if (content.includes('sinatra')) return 'sinatra';
  }

  // Rust
  const cargoToml = path.join(projectPath, 'Cargo.toml');
  if (fs.existsSync(cargoToml)) {
    const content = fs.readFileSync(cargoToml, 'utf8');
    if (content.includes('actix-web')) return 'actix';
    if (content.includes('axum')) return 'axum';
    if (content.includes('rocket')) return 'rocket';
  }

  // Java/Spring
  const pomXml = path.join(projectPath, 'pom.xml');
  const buildGradle = path.join(projectPath, 'build.gradle');
  if (fs.existsSync(pomXml) || fs.existsSync(buildGradle)) {
    const content = fs.existsSync(pomXml)
      ? fs.readFileSync(pomXml, 'utf8')
      : fs.readFileSync(buildGradle, 'utf8');
    if (content.includes('spring-boot')) return 'spring-boot';
  }

  return null;
}

/**
 * Get the appropriate extractor for a project
 * @param {string} projectPath - Path to the project root
 * @param {string} [framework] - Optional framework override
 * @returns {Promise<BaseExtractor|null>} Extractor instance or null
 */
export async function getExtractor(projectPath, framework = null) {
  // Use provided framework or detect it
  const detectedFramework = framework || (await detectFramework(projectPath));

  if (!detectedFramework) {
    return null;
  }

  const ExtractorClass = extractors[detectedFramework];

  if (!ExtractorClass) {
    // Framework detected but no extractor available yet
    console.warn(
      `Framework '${detectedFramework}' detected but no extractor available yet.`
    );
    return null;
  }

  return new ExtractorClass(projectPath);
}

/**
 * Get list of supported frameworks
 * @returns {Array<string>} List of framework names
 */
export function getSupportedFrameworks() {
  return Object.keys(extractors);
}

/**
 * Check if a framework is supported
 * @param {string} framework - Framework name
 * @returns {boolean} True if supported
 */
export function isFrameworkSupported(framework) {
  return framework in extractors;
}

export default {
  detectFramework,
  getExtractor,
  getSupportedFrameworks,
  isFrameworkSupported,
};
