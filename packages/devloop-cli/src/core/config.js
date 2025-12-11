import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

// Load .env from current directory
dotenv.config();

export const API_URL = process.env.DEVLOOP_API_URL || 'https://devloop-api.fly.dev';
export const CONFIG_DIR = '.devloop';
export const CONFIG_FILE = 'config.json';
export const LICENSE_CACHE_FILE = path.join(os.homedir(), '.devloop-license');

export function getProjectRoot() {
  let dir = process.cwd();
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, CONFIG_DIR))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, 'package.json')) ||
        fs.existsSync(path.join(dir, 'requirements.txt')) ||
        fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function getConfigPath() {
  return path.join(getProjectRoot(), CONFIG_DIR, CONFIG_FILE);
}

export function loadConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

export function saveConfig(config) {
  const configDir = path.join(getProjectRoot(), CONFIG_DIR);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(configDir, CONFIG_FILE),
    JSON.stringify(config, null, 2)
  );
}

export function getLicenseKey() {
  // First check env var
  if (process.env.DEVLOOP_LICENSE_KEY) {
    return process.env.DEVLOOP_LICENSE_KEY;
  }

  // Then check config
  const config = loadConfig();
  if (config.license_key) {
    return config.license_key;
  }

  // Finally check cache
  if (fs.existsSync(LICENSE_CACHE_FILE)) {
    try {
      const cache = JSON.parse(fs.readFileSync(LICENSE_CACHE_FILE, 'utf8'));
      return cache.license_key;
    } catch {
      return null;
    }
  }

  return null;
}

export function detectFramework(projectPath = process.cwd()) {
  const pkgPath = path.join(projectPath, 'package.json');
  const reqPath = path.join(projectPath, 'requirements.txt');
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  const cargoPath = path.join(projectPath, 'Cargo.toml');
  const goPath = path.join(projectPath, 'go.mod');

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.next) return { type: 'nextjs', language: 'typescript', testFramework: 'jest' };
      if (deps.react) return { type: 'react', language: 'typescript', testFramework: 'vitest' };
      if (deps.vue) return { type: 'vue', language: 'typescript', testFramework: 'vitest' };
      if (deps.express || deps.fastify || deps.koa) return { type: 'node-api', language: 'typescript', testFramework: 'jest' };
      return { type: 'node', language: 'javascript', testFramework: 'jest' };
    } catch {
      return { type: 'node', language: 'javascript', testFramework: 'jest' };
    }
  }

  if (fs.existsSync(reqPath) || fs.existsSync(pyprojectPath)) {
    return { type: 'python', language: 'python', testFramework: 'pytest' };
  }

  if (fs.existsSync(cargoPath)) {
    return { type: 'rust', language: 'rust', testFramework: 'cargo' };
  }

  if (fs.existsSync(goPath)) {
    return { type: 'go', language: 'go', testFramework: 'go' };
  }

  return { type: 'generic', language: 'unknown', testFramework: 'unknown' };
}

export function detectPlatform(projectPath = process.cwd()) {
  if (fs.existsSync(path.join(projectPath, 'fly.toml'))) {
    return 'fly';
  }
  if (fs.existsSync(path.join(projectPath, 'vercel.json'))) {
    return 'vercel';
  }
  if (fs.existsSync(path.join(projectPath, 'railway.json'))) {
    return 'railway';
  }
  if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
    return 'docker';
  }
  return null;
}
