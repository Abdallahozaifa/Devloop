/**
 * Universal Spec Schema
 *
 * This format is framework-agnostic.
 * Works for FastAPI, Express, Django, Next.js, etc.
 */

export const SPEC_SCHEMA = {
  // Metadata
  name: 'string',
  version: 'string',
  description: 'string',

  // Data models - universal types
  models: {
    // ModelName: {
    //   fields: {
    //     id: { type: 'uuid', generated: true },
    //     name: { type: 'string', required: true, maxLength: 255 },
    //     amount: { type: 'decimal', required: true, min: 0 },
    //     status: { type: 'enum', values: ['draft', 'active'], default: 'draft' },
    //     created_at: { type: 'datetime', generated: true },
    //     project_id: { type: 'uuid', references: 'projects.id' }
    //   }
    // }
  },

  // API endpoints - HTTP standard
  api: [
    // {
    //   endpoint: 'POST /api/v1/invoices',
    //   auth: 'required' | 'optional' | 'none',
    //   description: 'string',
    //   request: {
    //     body: { field: { type, required, ... } },
    //     query: { field: { type, default, ... } },
    //     headers: { 'X-Custom': { type, required } }
    //   },
    //   response: {
    //     201: { body: 'ModelName', description: 'Created' },
    //     400: { when: 'condition', body: { detail: 'string' } },
    //     401: { when: 'not authenticated' },
    //     403: { when: 'not authorized' },
    //     404: { when: 'not found' },
    //     422: { when: 'validation fails' }
    //   }
    // }
  ],

  // Business rules - plain English
  rules: [
    // 'Only draft invoices can be edited',
    // 'User can only see own invoices'
  ],

  // UI components - framework-agnostic behavior
  ui: {
    components: {
      // ComponentName: {
      //   description: 'string',
      //   props: { propName: 'type' },
      //   state: { stateName: 'type' },
      //   behavior: ['string'],
      //   apiCalls: ['POST /api/v1/invoices']
      // }
    },
    routes: {
      // '/invoices': 'InvoiceListPage',
      // '/invoices/:id': 'InvoiceDetailPage'
    }
  },

  // Contract checks - patterns to verify
  contracts: [
    // {
    //   name: 'string',
    //   description: 'string',
    //   file: 'glob pattern',
    //   must_contain: ['pattern'],
    //   must_not_contain: ['pattern']
    // }
  ],

  // Tests - universal HTTP/browser tests
  tests: {
    api: [
      // {
      //   name: 'string',
      //   as: 'guest' | 'user' | 'admin',
      //   request: { method, path, body, headers },
      //   expect: { status, bodyHas, bodyShape, bodyNot }
      // }
    ],
    ui: [
      // {
      //   name: 'string',
      //   steps: [{ goto, click, fill, wait }],
      //   expect: [{ visible, not_visible, url }]
      // }
    ]
  }
};

// Universal field types
export const FIELD_TYPES = {
  uuid: { description: 'UUID v4' },
  string: { description: 'Text', options: ['maxLength', 'minLength', 'pattern'] },
  int: { description: 'Integer', options: ['min', 'max'] },
  decimal: { description: 'Decimal number', options: ['min', 'max', 'precision'] },
  boolean: { description: 'True/False' },
  datetime: { description: 'ISO 8601 datetime' },
  date: { description: 'ISO 8601 date' },
  enum: { description: 'One of values', options: ['values'] },
  array: { description: 'Array of items', options: ['of', 'min', 'max'] },
  object: { description: 'Nested object', options: ['properties'] },
  email: { description: 'Email address' },
  url: { description: 'URL' },
  json: { description: 'JSON blob' }
};

// HTTP Status codes reference
export const HTTP_STATUS_CODES = {
  200: 'Success - Resource returned',
  201: 'Created - New resource created',
  204: 'No Content - Success with no response body',
  400: 'Bad Request - Invalid input or business rule violation',
  401: 'Unauthorized - Authentication required',
  403: 'Forbidden - Not authorized to access resource',
  404: 'Not Found - Resource does not exist',
  409: 'Conflict - Resource already exists',
  422: 'Unprocessable Entity - Validation error',
  500: 'Internal Server Error - Unexpected server error'
};

/**
 * Validate spec against schema
 */
export function validateSpec(spec) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!spec.name) errors.push('Missing: name');
  if (!spec.description) warnings.push('Missing: description');

  // Models validation
  if (!spec.models || Object.keys(spec.models).length === 0) {
    errors.push('Missing: models (at least one model required)');
  } else {
    for (const [modelName, model] of Object.entries(spec.models)) {
      if (!model.fields) {
        errors.push(`Model ${modelName}: missing fields`);
      } else {
        for (const [fieldName, field] of Object.entries(model.fields)) {
          if (!field.type) {
            errors.push(`${modelName}.${fieldName}: missing type`);
          } else if (!FIELD_TYPES[field.type]) {
            warnings.push(`${modelName}.${fieldName}: unknown type '${field.type}'`);
          }
        }
      }
    }
  }

  // API validation
  if (!spec.api || spec.api.length === 0) {
    errors.push('Missing: api endpoints (at least one endpoint required)');
  } else {
    for (const endpoint of spec.api) {
      if (!endpoint.endpoint) {
        errors.push('Endpoint missing: endpoint path');
        continue;
      }

      const [method, path] = endpoint.endpoint.split(' ');
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        errors.push(`${endpoint.endpoint}: invalid HTTP method '${method}'`);
      }

      if (!endpoint.response) {
        warnings.push(`${endpoint.endpoint}: missing response codes`);
      } else {
        // Check for required response codes based on auth
        if (endpoint.auth === 'required' && !endpoint.response['401']) {
          warnings.push(`${endpoint.endpoint}: requires auth but missing 401 response`);
        }
      }
    }
  }

  // Tests validation
  if (spec.tests?.api) {
    for (const test of spec.tests.api) {
      if (!test.name) errors.push('API test missing: name');
      if (!test.request) errors.push(`API test "${test.name}": missing request`);
      if (!test.expect) errors.push(`API test "${test.name}": missing expect`);
    }
  }

  if (spec.tests?.ui) {
    for (const test of spec.tests.ui) {
      if (!test.name) errors.push('UI test missing: name');
      if (!test.steps) errors.push(`UI test "${test.name}": missing steps`);
      if (!test.expect) errors.push(`UI test "${test.name}": missing expect`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export default { SPEC_SCHEMA, FIELD_TYPES, HTTP_STATUS_CODES, validateSpec };
