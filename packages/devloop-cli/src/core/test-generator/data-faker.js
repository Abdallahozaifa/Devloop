import crypto from 'crypto';

/**
 * Generates fake test data based on field types and names
 * Smart detection of field semantics for realistic test data
 */
export function generateFakeData(field, context = {}) {
  const { name, type, enumType, enumValues } = field;
  const fieldNameLower = name?.toLowerCase() || '';

  // Handle enums
  if (type === 'enum' && enumValues?.length) {
    return enumValues[0].value || enumValues[0].name;
  }

  // Smart detection based on field name
  if (fieldNameLower.includes('email')) {
    return generateEmail(context);
  }
  if (fieldNameLower.includes('password')) {
    return generatePassword();
  }
  if (fieldNameLower.includes('phone') || fieldNameLower.includes('mobile')) {
    return generatePhone();
  }
  if (fieldNameLower.includes('url') || fieldNameLower.includes('website') || fieldNameLower.includes('link')) {
    return generateUrl(fieldNameLower);
  }
  if (fieldNameLower.includes('image') || fieldNameLower.includes('avatar') || fieldNameLower.includes('photo')) {
    return generateImageUrl();
  }
  if (fieldNameLower.includes('address')) {
    return generateAddress();
  }
  if (fieldNameLower.includes('city')) {
    return generateCity();
  }
  if (fieldNameLower.includes('country')) {
    return generateCountry();
  }
  if (fieldNameLower.includes('zip') || fieldNameLower.includes('postal')) {
    return generateZipCode();
  }
  if (fieldNameLower.includes('state') || fieldNameLower.includes('province')) {
    return generateState();
  }
  if (fieldNameLower.includes('name') && fieldNameLower.includes('first')) {
    return generateFirstName();
  }
  if (fieldNameLower.includes('name') && fieldNameLower.includes('last')) {
    return generateLastName();
  }
  if (fieldNameLower.includes('name') && !fieldNameLower.includes('user')) {
    return generateFullName();
  }
  if (fieldNameLower.includes('username')) {
    return generateUsername();
  }
  if (fieldNameLower.includes('title')) {
    return generateTitle();
  }
  if (fieldNameLower.includes('description') || fieldNameLower.includes('desc') || fieldNameLower.includes('summary')) {
    return generateDescription();
  }
  if (fieldNameLower.includes('content') || fieldNameLower.includes('body') || fieldNameLower.includes('text')) {
    return generateContent();
  }
  if (fieldNameLower.includes('price') || fieldNameLower.includes('amount') || fieldNameLower.includes('cost')) {
    return generatePrice();
  }
  if (fieldNameLower.includes('quantity') || fieldNameLower.includes('count') || fieldNameLower.includes('num')) {
    return generateQuantity();
  }
  if (fieldNameLower.includes('status')) {
    return generateStatus(context);
  }
  if (fieldNameLower.includes('type') || fieldNameLower.includes('category')) {
    return generateType(context);
  }
  if (fieldNameLower.includes('color')) {
    return generateColor();
  }
  if (fieldNameLower.includes('slug')) {
    return generateSlug();
  }
  if (fieldNameLower.includes('token') || fieldNameLower.includes('key') || fieldNameLower.includes('secret')) {
    return generateToken();
  }
  if (fieldNameLower.includes('ip')) {
    return generateIp();
  }

  // Type-based fallbacks
  switch (type) {
    case 'uuid':
      return generateUuid();
    case 'integer':
      return generateInteger(fieldNameLower);
    case 'number':
      return generateNumber(fieldNameLower);
    case 'boolean':
      return generateBoolean(fieldNameLower);
    case 'datetime':
      return generateDatetime(fieldNameLower);
    case 'date':
      return generateDate(fieldNameLower);
    case 'time':
      return generateTime();
    case 'email':
      return generateEmail(context);
    case 'url':
      return generateUrl(fieldNameLower);
    case 'json':
    case 'object':
      return generateJson();
    case 'array':
      return generateArray();
    default:
      return generateString(fieldNameLower);
  }
}

/**
 * Generate a complete fake object for an entity
 */
export function generateFakeEntity(entity, context = {}) {
  const data = {};

  for (const field of entity.fields || []) {
    // Skip auto-generated fields
    if (field.primaryKey && (field.default?.includes('uuid') || field.default?.includes('auto'))) {
      continue;
    }
    // Skip timestamps
    if (['created_at', 'updated_at', 'deleted_at'].includes(field.name)) {
      continue;
    }

    data[field.name] = generateFakeData(field, { ...context, entity });
  }

  return data;
}

/**
 * Generate fake credential data for auth tests
 */
export function generateCredentials(credentialFields = ['email', 'password']) {
  const creds = {};

  for (const field of credentialFields) {
    const fieldLower = field.toLowerCase();
    if (fieldLower.includes('email')) {
      creds[field] = generateEmail();
    } else if (fieldLower.includes('password')) {
      creds[field] = generatePassword();
    } else if (fieldLower.includes('username')) {
      creds[field] = generateUsername();
    } else {
      creds[field] = generateString(field);
    }
  }

  return creds;
}

// Generator functions
function generateUuid() {
  return crypto.randomUUID();
}

function generateEmail(context = {}) {
  const prefix = context.entity?.name?.toLowerCase() || 'test';
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}@devloop-test.com`;
}

function generatePassword() {
  return 'TestPassword123!';
}

function generatePhone() {
  const area = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${area}${exchange}${subscriber}`;
}

function generateUrl(fieldName = '') {
  if (fieldName.includes('github')) {
    return 'https://github.com/devloop-test/example';
  }
  if (fieldName.includes('linkedin')) {
    return 'https://linkedin.com/in/devloop-test';
  }
  if (fieldName.includes('twitter')) {
    return 'https://twitter.com/devloop_test';
  }
  return 'https://example.com/test-page';
}

function generateImageUrl() {
  const width = 400;
  const height = 400;
  return `https://picsum.photos/${width}/${height}`;
}

function generateAddress() {
  const num = Math.floor(Math.random() * 9000) + 1000;
  const streets = ['Main St', 'Oak Ave', 'Park Blvd', 'Broadway', 'Market St'];
  return `${num} ${streets[Math.floor(Math.random() * streets.length)]}`;
}

function generateCity() {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Francisco'];
  return cities[Math.floor(Math.random() * cities.length)];
}

function generateState() {
  const states = ['CA', 'NY', 'TX', 'FL', 'WA', 'IL'];
  return states[Math.floor(Math.random() * states.length)];
}

function generateCountry() {
  return 'United States';
}

function generateZipCode() {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function generateFirstName() {
  const names = ['John', 'Jane', 'Alex', 'Sam', 'Chris', 'Jordan', 'Taylor', 'Morgan'];
  return names[Math.floor(Math.random() * names.length)];
}

function generateLastName() {
  const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller'];
  return names[Math.floor(Math.random() * names.length)];
}

function generateFullName() {
  return `${generateFirstName()} ${generateLastName()}`;
}

function generateUsername() {
  const timestamp = Date.now().toString(36);
  return `testuser_${timestamp}`;
}

function generateTitle() {
  const adjectives = ['Important', 'New', 'Updated', 'Draft', 'Final'];
  const nouns = ['Document', 'Project', 'Task', 'Report', 'Plan'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

function generateDescription() {
  return 'This is a test description generated by DevLoop for automated testing purposes.';
}

function generateContent() {
  return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
}

function generatePrice() {
  return Number((Math.random() * 1000).toFixed(2));
}

function generateQuantity() {
  return Math.floor(Math.random() * 100) + 1;
}

function generateStatus(context = {}) {
  const statuses = ['active', 'pending', 'completed', 'draft', 'published'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function generateType(context = {}) {
  const types = ['standard', 'premium', 'basic', 'enterprise', 'custom'];
  return types[Math.floor(Math.random() * types.length)];
}

function generateColor() {
  const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateSlug() {
  const timestamp = Date.now().toString(36);
  return `test-item-${timestamp}`;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateIp() {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function generateInteger(fieldName = '') {
  if (fieldName.includes('age')) {
    return Math.floor(Math.random() * 60) + 18;
  }
  if (fieldName.includes('year')) {
    return 2024;
  }
  if (fieldName.includes('order') || fieldName.includes('position') || fieldName.includes('rank')) {
    return Math.floor(Math.random() * 10) + 1;
  }
  return Math.floor(Math.random() * 1000);
}

function generateNumber(fieldName = '') {
  if (fieldName.includes('lat')) {
    return Number((Math.random() * 180 - 90).toFixed(6));
  }
  if (fieldName.includes('lng') || fieldName.includes('lon')) {
    return Number((Math.random() * 360 - 180).toFixed(6));
  }
  if (fieldName.includes('rating') || fieldName.includes('score')) {
    return Number((Math.random() * 5).toFixed(1));
  }
  if (fieldName.includes('percent')) {
    return Number((Math.random() * 100).toFixed(2));
  }
  return Number((Math.random() * 1000).toFixed(2));
}

function generateBoolean(fieldName = '') {
  // Default to true for common "enabled" type fields
  if (fieldName.includes('active') || fieldName.includes('enabled') || fieldName.includes('verified')) {
    return true;
  }
  return Math.random() > 0.5;
}

function generateDatetime(fieldName = '') {
  const now = new Date();
  if (fieldName.includes('birth') || fieldName.includes('dob')) {
    // Generate a date 20-50 years ago
    const years = Math.floor(Math.random() * 30) + 20;
    now.setFullYear(now.getFullYear() - years);
  } else if (fieldName.includes('start')) {
    // Generate a recent past date
    now.setDate(now.getDate() - Math.floor(Math.random() * 30));
  } else if (fieldName.includes('end') || fieldName.includes('due') || fieldName.includes('deadline')) {
    // Generate a future date
    now.setDate(now.getDate() + Math.floor(Math.random() * 30) + 1);
  }
  return now.toISOString();
}

function generateDate(fieldName = '') {
  return generateDatetime(fieldName).split('T')[0];
}

function generateTime() {
  const hours = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const minutes = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${hours}:${minutes}:00`;
}

function generateJson() {
  return { key: 'value', nested: { data: true } };
}

function generateArray() {
  return ['item1', 'item2', 'item3'];
}

function generateString(fieldName = '') {
  if (fieldName.includes('code')) {
    return `CODE${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  if (fieldName.includes('reference') || fieldName.includes('ref')) {
    return `REF-${Date.now().toString(36).toUpperCase()}`;
  }
  const timestamp = Date.now().toString(36);
  return `test_${timestamp}`;
}

/**
 * Generate path parameter values for API testing
 */
export function generatePathParams(params = [], context = {}) {
  const values = {};

  for (const param of params) {
    const paramName = param.name || param;
    const paramType = param.type || 'string';

    if (paramType === 'uuid' || paramName.toLowerCase().includes('id')) {
      // Use stored ID from context if available
      const entityName = paramName.replace('_id', '').replace('Id', '');
      if (context[entityName]?.id) {
        values[paramName] = context[entityName].id;
      } else {
        values[paramName] = generateUuid();
      }
    } else if (paramType === 'integer') {
      values[paramName] = Math.floor(Math.random() * 1000) + 1;
    } else {
      values[paramName] = generateSlug();
    }
  }

  return values;
}

/**
 * Generate query parameters for API testing
 */
export function generateQueryParams(params = []) {
  const values = {};

  for (const param of params) {
    if (!param.required) continue;

    const paramName = param.name;
    const paramType = param.type || 'string';

    switch (paramType) {
      case 'integer':
        values[paramName] = Math.floor(Math.random() * 100);
        break;
      case 'boolean':
        values[paramName] = true;
        break;
      case 'array':
        values[paramName] = ['item1', 'item2'];
        break;
      default:
        values[paramName] = `test_${paramName}`;
    }
  }

  return values;
}

export default {
  generateFakeData,
  generateFakeEntity,
  generateCredentials,
  generatePathParams,
  generateQueryParams,
};
