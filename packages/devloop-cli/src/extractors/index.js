/**
 * DevLoop Extractors Module
 *
 * Framework-specific extractors for the Extraction Layer of DevLoop's
 * three-layer architecture. Each extractor parses framework-specific
 * code and outputs the Universal Spec Format.
 *
 * @module extractors
 */

// Base class for all extractors
export { BaseExtractor } from './base.js';

// Framework-specific extractors
export { FastAPIExtractor } from './fastapi.js';

// Framework detection and extractor factory
export {
  detectFramework,
  getExtractor,
  getSupportedFrameworks,
  isFrameworkSupported,
} from './detect.js';

// Default export for convenience
import { detectFramework, getExtractor, getSupportedFrameworks, isFrameworkSupported } from './detect.js';
import { BaseExtractor } from './base.js';
import { FastAPIExtractor } from './fastapi.js';

export default {
  // Detection
  detectFramework,
  getExtractor,
  getSupportedFrameworks,
  isFrameworkSupported,

  // Base class
  BaseExtractor,

  // Framework extractors
  FastAPIExtractor,

  // Future extractors (placeholders for documentation):
  // DjangoExtractor,
  // NestJSExtractor,
  // ExpressExtractor,
  // FlaskExtractor,
};
