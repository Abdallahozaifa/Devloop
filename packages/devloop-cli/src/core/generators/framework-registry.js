/**
 * Framework Registry
 *
 * Registers framework-specific generators and patterns.
 * Add new frameworks by creating a generator file and registering it.
 */

const frameworks = new Map();

/**
 * Register a framework with its configuration
 * @param {string} name - Framework name (e.g., 'fastapi', 'react', 'express')
 * @param {object} config - Framework configuration
 */
export function registerFramework(name, config) {
  frameworks.set(name, {
    name,
    detect: config.detect,                    // Function to detect framework in project
    generator: config.generator,              // Code generator functions
    contractPatterns: config.contractPatterns, // Patterns for contract checks
    filePaths: config.filePaths               // Standard file locations
  });
}

/**
 * Detect which framework is being used in a project
 * @param {string} projectDir - Project directory path
 * @returns {string|null} - Framework name or null if not detected
 */
export function detectFramework(projectDir) {
  for (const [name, framework] of frameworks) {
    try {
      if (framework.detect(projectDir)) {
        return name;
      }
    } catch (err) {
      // Detection failed, try next framework
    }
  }
  return null;
}

/**
 * Detect all frameworks in a project (for full-stack projects)
 * @param {string} projectDir - Project directory path
 * @returns {string[]} - Array of detected framework names
 */
export function detectAllFrameworks(projectDir) {
  const detected = [];
  for (const [name, framework] of frameworks) {
    try {
      if (framework.detect(projectDir)) {
        detected.push(name);
      }
    } catch (err) {
      // Detection failed, try next framework
    }
  }
  return detected;
}

/**
 * Get a specific framework by name
 * @param {string} name - Framework name
 * @returns {object|undefined} - Framework config or undefined
 */
export function getFramework(name) {
  return frameworks.get(name);
}

/**
 * List all registered frameworks
 * @returns {string[]} - Array of framework names
 */
export function listFrameworks() {
  return Array.from(frameworks.keys());
}

/**
 * Get the generator for a specific framework
 * @param {string} name - Framework name
 * @returns {object|undefined} - Generator object or undefined
 */
export function getGenerator(name) {
  const framework = frameworks.get(name);
  return framework?.generator;
}

/**
 * Get contract patterns for a specific framework
 * @param {string} name - Framework name
 * @returns {object|undefined} - Contract patterns or undefined
 */
export function getContractPatterns(name) {
  const framework = frameworks.get(name);
  return framework?.contractPatterns;
}

/**
 * Get file paths for a specific framework
 * @param {string} name - Framework name
 * @returns {object|undefined} - File paths or undefined
 */
export function getFilePaths(name) {
  const framework = frameworks.get(name);
  return framework?.filePaths;
}

export { frameworks };
