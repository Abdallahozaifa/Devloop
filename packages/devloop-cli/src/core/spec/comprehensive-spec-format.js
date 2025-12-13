/**
 * Comprehensive Spec Format
 *
 * This format provides everything needed for spec-driven development:
 * - Data models with types, constraints, relationships
 * - API endpoints with all response codes
 * - Business rules
 * - Frontend components with behavior
 * - Contract checks
 * - API and UI tests
 */

export const SPEC_TEMPLATE = {
  name: '',
  version: '1.0',
  description: '',

  // Data models with full schema
  models: {
    // Example:
    // Invoice: {
    //   fields: {
    //     id: { type: 'uuid', generated: true },
    //     project_id: { type: 'uuid', required: true, references: 'projects.id' },
    //     total: { type: 'decimal', computed: 'sum(items.amount)' },
    //     status: { type: 'enum', values: ['draft', 'sent', 'paid'], default: 'draft' }
    //   }
    // }
  },

  // API endpoints with full response handling
  api: [
    // {
    //   endpoint: 'POST /api/v1/invoices',
    //   auth: 'required',
    //   description: 'Create invoice',
    //   request: {
    //     body: {
    //       project_id: { type: 'uuid', required: true },
    //       request_ids: { type: 'array', of: 'uuid', required: true, min: 1 }
    //     }
    //   },
    //   response: {
    //     201: { body: 'Invoice' },
    //     400: { when: 'request_ids empty', body: { detail: 'At least one request required' } },
    //     403: { when: 'not owner', body: { detail: 'Access denied' } },
    //     404: { when: 'not found' }
    //   }
    // }
  ],

  // Business rules in plain English
  rules: [
    // 'Only draft invoices can be edited',
    // 'User can only see own invoices'
  ],

  // Frontend components
  ui: {
    components: {
      // InvoiceCreateModal: {
      //   location: 'apps/web/src/components/invoices/InvoiceCreateModal.tsx',
      //   props: {
      //     projectId: 'uuid',
      //     onSuccess: '(invoice: Invoice) => void'
      //   },
      //   behavior: [
      //     'Shows list of requests with checkboxes',
      //     'Submit calls POST /api/v1/invoices'
      //   ]
      // }
    },
    routes: {
      // '/invoices': 'InvoiceList',
      // '/invoices/:id': 'InvoiceDetail'
    }
  },

  // Contract checks
  contracts: [
    // {
    //   name: 'Frontend calls correct endpoint',
    //   file: 'apps/web/src/**/invoice*/**/*.tsx',
    //   must_contain: ['/api/v1/invoices'],
    //   must_not_contain: ['/api/v1/invoice']
    // }
  ],

  // API tests
  tests: {
    api: [],
    ui: []
  }
};

/**
 * Field type definitions
 */
export const FIELD_TYPES = {
  uuid: { description: 'UUID v4 string', example: '550e8400-e29b-41d4-a716-446655440000' },
  string: { description: 'Text string', example: 'Hello World' },
  int: { description: 'Integer number', example: 42 },
  decimal: { description: 'Decimal number', example: 99.99 },
  boolean: { description: 'True or false', example: true },
  datetime: { description: 'ISO 8601 datetime', example: '2024-01-15T10:30:00Z' },
  date: { description: 'ISO 8601 date', example: '2024-01-15' },
  enum: { description: 'Fixed set of values', example: 'status: [draft, sent, paid]' },
  array: { description: 'List of items', example: '[item1, item2]' },
  object: { description: 'Nested object', example: '{ key: value }' },
  json: { description: 'Arbitrary JSON', example: '{ "any": "structure" }' }
};

/**
 * HTTP status code meanings for API specs
 */
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
 * Validate a comprehensive spec
 */
export function validateSpec(spec) {
  const errors = [];
  const warnings = [];

  // Check required sections
  if (!spec.name) errors.push('Missing spec name');
  if (!spec.description) warnings.push('Missing spec description');

  // Check models
  if (spec.models) {
    for (const [modelName, model] of Object.entries(spec.models)) {
      if (!model.fields) {
        errors.push(`Model ${modelName} has no fields`);
        continue;
      }
      for (const [fieldName, field] of Object.entries(model.fields)) {
        if (!field.type) {
          errors.push(`${modelName}.${fieldName} missing type`);
        }
      }
    }
  }

  // Check API endpoints
  if (spec.api) {
    for (const endpoint of spec.api) {
      if (!endpoint.endpoint) {
        errors.push('API endpoint missing endpoint path');
        continue;
      }
      if (!endpoint.response) {
        warnings.push(`${endpoint.endpoint} missing response codes`);
      } else {
        // Check for required response codes
        const hasAuthRequirement = endpoint.auth === 'required';
        if (hasAuthRequirement && !endpoint.response['401']) {
          warnings.push(`${endpoint.endpoint} requires auth but missing 401 response`);
        }
      }
    }
  }

  // Check tests
  if (spec.tests?.api) {
    for (const test of spec.tests.api) {
      if (!test.name) errors.push('Test missing name');
      if (!test.request) errors.push(`Test "${test.name}" missing request`);
      if (!test.expect) errors.push(`Test "${test.name}" missing expect`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export default { SPEC_TEMPLATE, FIELD_TYPES, HTTP_STATUS_CODES, validateSpec };
