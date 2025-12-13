/**
 * Spec Runners Module
 *
 * Re-exports all runner functions for easy importing.
 */

// Main API spec runner
export { runSpec } from './runner.js';

// Config spec runner
export { isConfigSpec, runConfigSpec } from './config-runner.js';

// UI spec runner
export { isUISpec, runUISpec } from './ui-runner.js';
