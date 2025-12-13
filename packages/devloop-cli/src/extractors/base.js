import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * BaseExtractor - Abstract base class for framework-specific extractors
 *
 * Each framework extractor (FastAPI, Django, NestJS, Express) must extend this class
 * and implement all required methods. The extractor's job is to analyze framework-specific
 * code and output the Universal Spec Format.
 *
 * @example
 * class FastAPIExtractor extends BaseExtractor {
 *   async discoverRoutes() { ... }
 *   async extractSchemas() { ... }
 *   async detectAuth(route) { ... }
 *   async mapRelationships() { ... }
 * }
 */
export class BaseExtractor {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Get the framework name this extractor handles
   * @returns {string} Framework name (e.g., 'fastapi', 'django', 'nestjs')
   */
  static get frameworkName() {
    throw new Error('frameworkName getter must be implemented');
  }

  /**
   * Discover all API routes/endpoints in the project
   * @returns {Promise<Array<RouteInfo>>} Array of route objects
   *
   * @typedef {Object} RouteInfo
   * @property {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @property {string} path - URL path pattern (e.g., /api/v1/users/{id})
   * @property {string} funcName - Function/handler name
   * @property {string} file - Relative file path
   * @property {number} line - Line number in file
   * @property {string} authType - Auth type (bearer, api-key, none)
   * @property {Array<HeaderInfo>} requiredHeaders - Required headers
   * @property {Object} responseInfo - Response model info
   * @property {Object} requestSchema - Request body schema info
   */
  async discoverRoutes() {
    throw new Error('discoverRoutes() must be implemented by subclass');
  }

  /**
   * Extract all data schemas/models from the project
   * @returns {Promise<Object<string, SchemaInfo>>} Map of schema name to schema info
   *
   * @typedef {Object} SchemaInfo
   * @property {string} file - File where schema is defined
   * @property {Array<FieldInfo>} requiredFields - Required fields
   * @property {Array<FieldInfo>} optionalFields - Optional fields with defaults
   */
  async extractSchemas() {
    throw new Error('extractSchemas() must be implemented by subclass');
  }

  /**
   * Detect authentication requirements for a route
   * @param {RouteInfo} route - Route to check
   * @returns {Promise<AuthInfo>} Authentication info
   *
   * @typedef {Object} AuthInfo
   * @property {string} type - Auth type (bearer, api-key, portal-token, basic, none)
   * @property {boolean} required - Whether auth is required
   * @property {Array<string>} scopes - Required scopes/permissions
   */
  async detectAuth(route) {
    throw new Error('detectAuth() must be implemented by subclass');
  }

  /**
   * Map relationships between schemas and routes
   * @returns {Promise<Array<RelationshipInfo>>} Array of relationships
   *
   * @typedef {Object} RelationshipInfo
   * @property {string} route - Route path
   * @property {string} requestSchema - Request body schema name
   * @property {string} responseSchema - Response schema name
   */
  async mapRelationships() {
    throw new Error('mapRelationships() must be implemented by subclass');
  }

  /**
   * Run the full extraction pipeline
   * @returns {Promise<ExtractionResult>} Complete extraction result
   *
   * @typedef {Object} ExtractionResult
   * @property {string} framework - Framework name
   * @property {Array<RouteInfo>} routes - Discovered routes
   * @property {Object<string, SchemaInfo>} schemas - Extracted schemas
   * @property {Array<RelationshipInfo>} relationships - Route-schema relationships
   */
  async extract() {
    const routes = await this.discoverRoutes();
    const schemas = await this.extractSchemas();

    // Detect auth for each route
    for (const route of routes) {
      const authInfo = await this.detectAuth(route);
      route.authInfo = authInfo;
    }

    const relationships = await this.mapRelationships();

    return {
      framework: this.constructor.frameworkName,
      routes,
      schemas,
      relationships,
    };
  }

  // ============================================
  // Helper methods available to all extractors
  // ============================================

  /**
   * Read a file from the project
   * @param {string} relativePath - Path relative to project root
   * @returns {Promise<string>} File contents
   */
  async readFile(relativePath) {
    const fullPath = path.join(this.projectPath, relativePath);
    return fs.promises.readFile(fullPath, 'utf-8');
  }

  /**
   * Check if a file exists in the project
   * @param {string} relativePath - Path relative to project root
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(relativePath) {
    const fullPath = path.join(this.projectPath, relativePath);
    try {
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find files matching glob patterns
   * @param {Array<string>} patterns - Glob patterns to match
   * @returns {Promise<Array<string>>} Array of absolute file paths
   */
  async findFiles(patterns) {
    const files = [];

    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: this.projectPath,
          absolute: true,
          ignore: [
            '**/node_modules/**',
            '**/__pycache__/**',
            '**/venv/**',
            '**/.venv/**',
            '**/dist/**',
            '**/build/**',
          ],
        });
        files.push(...matches);
      } catch (e) {
        // Pattern didn't match, continue
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Get line number for a character index in content
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} Line number (1-indexed)
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Parse path parameters from a route path
   * @param {string} routePath - Route path pattern
   * @returns {Array<string>} Array of parameter names
   *
   * @example
   * parsePathParams('/users/{id}/projects/{project_id}')
   * // Returns: ['id', 'project_id']
   */
  parsePathParams(routePath) {
    const params = [];
    const regex = /\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(routePath)) !== null) {
      params.push(match[1]);
    }
    return params;
  }

  /**
   * Normalize HTTP method to uppercase
   * @param {string} method - HTTP method
   * @returns {string} Normalized method
   */
  normalizeMethod(method) {
    return method.toUpperCase();
  }

  /**
   * Normalize path to standard format
   * @param {string} path - URL path
   * @returns {string} Normalized path with leading slash
   */
  normalizePath(path) {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // Remove trailing slash unless it's the root path
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  }
}

export default BaseExtractor;
