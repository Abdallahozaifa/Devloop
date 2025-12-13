/**
 * Spec Generators Module
 *
 * Re-exports all generator functions for easy importing.
 */

// Simple natural language generator
export { parseNaturalLanguage, addTestToSpecFile } from './generator.js';

// AI-powered generator
export {
  generateSpecsWithAI,
  autoSaveSpecs,
  interactiveSpecReview,
  printSpecSummary,
  generateComprehensiveSpecs,
  generateBackendFirstSpecs,
} from './ai-generator.js';

// Comprehensive spec generator
export {
  generateComprehensiveSpec,
  saveComprehensiveSpec,
  getSpecSummary,
} from './comprehensive-generator.js';

// Universal spec generator (main generator)
export {
  generateUniversalSpec,
  saveUniversalSpec,
  getUniversalSpecSummary,
} from './universal-generator.js';

// Programmatic generator
export { generateProgrammaticSpec } from './programmatic-generator.js';

// Shape contract generator
export { generateShapeContract, saveShapeContract } from './shape-contract-generator.js';
