import fs from 'fs';
import path from 'path';

/**
 * Detects the framework stack of a project
 * Supports: React, Next.js, Vue, Svelte, FastAPI, Express, Django, Rails, etc.
 */
export async function detectFramework(projectRoot) {
  const result = {
    frontend: null,
    backend: null,
    database: null,
    language: {
      frontend: null,
      backend: null,
    },
    packageManager: null,
    monorepo: false,
  };

  // Detect package manager
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    result.packageManager = 'pnpm';
  } else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
    result.packageManager = 'yarn';
  } else if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
    result.packageManager = 'npm';
  } else if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) {
    result.packageManager = 'bun';
  }

  // Check for monorepo
  const turboJson = path.join(projectRoot, 'turbo.json');
  const pnpmWorkspace = path.join(projectRoot, 'pnpm-workspace.yaml');
  const lernaJson = path.join(projectRoot, 'lerna.json');

  if (fs.existsSync(turboJson) || fs.existsSync(pnpmWorkspace) || fs.existsSync(lernaJson)) {
    result.monorepo = true;
  }

  // Detect frontend framework
  const frontendResult = await detectFrontend(projectRoot);
  result.frontend = frontendResult.framework;
  result.language.frontend = frontendResult.language;

  // Detect backend framework
  const backendResult = await detectBackend(projectRoot);
  result.backend = backendResult.framework;
  result.language.backend = backendResult.language;

  // Detect database
  result.database = await detectDatabase(projectRoot);

  return result;
}

async function detectFrontend(projectRoot) {
  const result = { framework: null, language: null };

  // Check package.json in various locations
  const packageJsonPaths = [
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'apps/web/package.json'),
    path.join(projectRoot, 'frontend/package.json'),
    path.join(projectRoot, 'client/package.json'),
    path.join(projectRoot, 'packages/web/package.json'),
  ];

  for (const pkgPath of packageJsonPaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Check TypeScript
        if (deps.typescript) {
          result.language = 'typescript';
        } else {
          result.language = 'javascript';
        }

        // Check for frameworks
        if (deps.next) {
          result.framework = 'nextjs';
          return result;
        }
        if (deps['@remix-run/react'] || deps.remix) {
          result.framework = 'remix';
          return result;
        }
        if (deps.nuxt || deps['nuxt3']) {
          result.framework = 'nuxt';
          return result;
        }
        if (deps.vue) {
          result.framework = 'vue';
          return result;
        }
        if (deps.svelte || deps['@sveltejs/kit']) {
          result.framework = 'svelte';
          return result;
        }
        if (deps.react) {
          // Check if it's Vite, CRA, or other
          if (deps.vite) {
            result.framework = 'react-vite';
          } else if (deps['react-scripts']) {
            result.framework = 'create-react-app';
          } else {
            result.framework = 'react';
          }
          return result;
        }
        if (deps.angular || deps['@angular/core']) {
          result.framework = 'angular';
          return result;
        }
        if (deps.solid || deps['solid-js']) {
          result.framework = 'solid';
          return result;
        }
        if (deps.preact) {
          result.framework = 'preact';
          return result;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }

  return result;
}

async function detectBackend(projectRoot) {
  const result = { framework: null, language: null };

  // Check for Python backends
  const pythonIndicators = [
    { file: 'requirements.txt', check: (content) => {
      if (content.includes('fastapi')) return { framework: 'fastapi', language: 'python' };
      if (content.includes('django')) return { framework: 'django', language: 'python' };
      if (content.includes('flask')) return { framework: 'flask', language: 'python' };
      if (content.includes('starlette')) return { framework: 'starlette', language: 'python' };
      return null;
    }},
    { file: 'pyproject.toml', check: (content) => {
      if (content.includes('fastapi')) return { framework: 'fastapi', language: 'python' };
      if (content.includes('django')) return { framework: 'django', language: 'python' };
      if (content.includes('flask')) return { framework: 'flask', language: 'python' };
      return null;
    }},
    { file: 'Pipfile', check: (content) => {
      if (content.includes('fastapi')) return { framework: 'fastapi', language: 'python' };
      if (content.includes('django')) return { framework: 'django', language: 'python' };
      if (content.includes('flask')) return { framework: 'flask', language: 'python' };
      return null;
    }},
  ];

  // Check Python backends in multiple locations
  const backendPaths = ['', 'api/', 'backend/', 'server/'];

  for (const basePath of backendPaths) {
    for (const indicator of pythonIndicators) {
      const filePath = path.join(projectRoot, basePath, indicator.file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const detected = indicator.check(content);
        if (detected) return detected;
      }
    }
  }

  // Check for Node.js backends
  const nodePaths = [
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'api/package.json'),
    path.join(projectRoot, 'backend/package.json'),
    path.join(projectRoot, 'server/package.json'),
    path.join(projectRoot, 'apps/api/package.json'),
  ];

  for (const pkgPath of nodePaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        const language = deps.typescript ? 'typescript' : 'javascript';

        if (deps.express) {
          return { framework: 'express', language };
        }
        if (deps.fastify) {
          return { framework: 'fastify', language };
        }
        if (deps.koa) {
          return { framework: 'koa', language };
        }
        if (deps.hapi || deps['@hapi/hapi']) {
          return { framework: 'hapi', language };
        }
        if (deps.nestjs || deps['@nestjs/core']) {
          return { framework: 'nestjs', language };
        }
        if (deps.hono) {
          return { framework: 'hono', language };
        }
        if (deps.elysia) {
          return { framework: 'elysia', language };
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Check for Go backends
  const goMod = path.join(projectRoot, 'go.mod');
  if (fs.existsSync(goMod)) {
    const content = fs.readFileSync(goMod, 'utf8');
    if (content.includes('gin-gonic/gin')) {
      return { framework: 'gin', language: 'go' };
    }
    if (content.includes('labstack/echo')) {
      return { framework: 'echo', language: 'go' };
    }
    if (content.includes('gofiber/fiber')) {
      return { framework: 'fiber', language: 'go' };
    }
    return { framework: 'go', language: 'go' };
  }

  // Check for Ruby/Rails
  const gemfile = path.join(projectRoot, 'Gemfile');
  if (fs.existsSync(gemfile)) {
    const content = fs.readFileSync(gemfile, 'utf8');
    if (content.includes('rails')) {
      return { framework: 'rails', language: 'ruby' };
    }
    if (content.includes('sinatra')) {
      return { framework: 'sinatra', language: 'ruby' };
    }
  }

  // Check for Rust
  const cargoToml = path.join(projectRoot, 'Cargo.toml');
  if (fs.existsSync(cargoToml)) {
    const content = fs.readFileSync(cargoToml, 'utf8');
    if (content.includes('actix-web')) {
      return { framework: 'actix', language: 'rust' };
    }
    if (content.includes('axum')) {
      return { framework: 'axum', language: 'rust' };
    }
    if (content.includes('rocket')) {
      return { framework: 'rocket', language: 'rust' };
    }
  }

  // Check for Java/Spring
  const pomXml = path.join(projectRoot, 'pom.xml');
  const buildGradle = path.join(projectRoot, 'build.gradle');
  if (fs.existsSync(pomXml) || fs.existsSync(buildGradle)) {
    const content = fs.existsSync(pomXml)
      ? fs.readFileSync(pomXml, 'utf8')
      : fs.readFileSync(buildGradle, 'utf8');
    if (content.includes('spring-boot')) {
      return { framework: 'spring-boot', language: 'java' };
    }
  }

  return result;
}

async function detectDatabase(projectRoot) {
  const databases = [];

  // Check common database indicators
  const checks = [
    { files: ['docker-compose.yml', 'docker-compose.yaml'], patterns: ['postgres', 'postgresql'], db: 'postgresql' },
    { files: ['docker-compose.yml', 'docker-compose.yaml'], patterns: ['mysql', 'mariadb'], db: 'mysql' },
    { files: ['docker-compose.yml', 'docker-compose.yaml'], patterns: ['mongo'], db: 'mongodb' },
    { files: ['docker-compose.yml', 'docker-compose.yaml'], patterns: ['redis'], db: 'redis' },
    { files: ['.env', '.env.local', '.env.example'], patterns: ['DATABASE_URL.*postgres'], db: 'postgresql' },
    { files: ['.env', '.env.local', '.env.example'], patterns: ['DATABASE_URL.*mysql'], db: 'mysql' },
    { files: ['.env', '.env.local', '.env.example'], patterns: ['MONGODB_URI', 'MONGO_URL'], db: 'mongodb' },
    { files: ['requirements.txt', 'pyproject.toml'], patterns: ['psycopg', 'asyncpg'], db: 'postgresql' },
    { files: ['requirements.txt', 'pyproject.toml'], patterns: ['pymysql', 'mysqlclient'], db: 'mysql' },
    { files: ['requirements.txt', 'pyproject.toml'], patterns: ['pymongo', 'motor'], db: 'mongodb' },
    { files: ['package.json'], patterns: ['"pg"', '"postgres"', '@prisma'], db: 'postgresql' },
    { files: ['package.json'], patterns: ['"mysql2"', '"mysql"'], db: 'mysql' },
    { files: ['package.json'], patterns: ['"mongodb"', '"mongoose"'], db: 'mongodb' },
    { files: ['prisma/schema.prisma'], patterns: ['provider = "postgresql"'], db: 'postgresql' },
    { files: ['prisma/schema.prisma'], patterns: ['provider = "mysql"'], db: 'mysql' },
    { files: ['prisma/schema.prisma'], patterns: ['provider = "mongodb"'], db: 'mongodb' },
    { files: ['prisma/schema.prisma'], patterns: ['provider = "sqlite"'], db: 'sqlite' },
  ];

  for (const check of checks) {
    for (const file of check.files) {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          for (const pattern of check.patterns) {
            if (new RegExp(pattern, 'i').test(content)) {
              if (!databases.includes(check.db)) {
                databases.push(check.db);
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }
    }
  }

  return databases.length === 1 ? databases[0] : databases.length > 1 ? databases : null;
}

export default { detectFramework };
