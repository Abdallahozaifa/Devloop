import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Patterns for parsing natural language specs
const PATTERNS = [
  {
    // 'guests can access /health'
    regex: /^(guests?|unauthenticated|public) can access (.+)$/i,
    generate: (match) => ({
      name: `${match[1]} can access ${match[2]}`,
      as: 'guest',
      request: { method: 'GET', path: match[2] },
      expect: { status: 200 }
    })
  },
  {
    // 'guests cannot access /admin'
    regex: /^(guests?|unauthenticated|public) cannot access (.+)$/i,
    generate: (match) => ({
      name: `${match[1]} cannot access ${match[2]}`,
      as: 'guest',
      request: { method: 'GET', path: match[2] },
      expect: { status: [401, 403] }
    })
  },
  {
    // 'authenticated users can access /dashboard'
    regex: /^(authenticated|logged.?in|users?) can access (.+)$/i,
    generate: (match) => ({
      name: `Authenticated users can access ${match[2]}`,
      as: 'user',
      request: { method: 'GET', path: match[2] },
      expect: { status: 200 }
    })
  },
  {
    // 'authenticated users cannot access /admin'
    regex: /^(authenticated|logged.?in|users?) cannot access (.+)$/i,
    generate: (match) => ({
      name: `Authenticated users cannot access ${match[2]}`,
      as: 'user',
      request: { method: 'GET', path: match[2] },
      expect: { status: [401, 403] }
    })
  },
  {
    // '/api/health returns 200'
    regex: /^(.+) returns (\d+)$/i,
    generate: (match) => ({
      name: `${match[1]} returns ${match[2]}`,
      as: 'guest',
      request: { method: 'GET', path: match[1] },
      expect: { status: parseInt(match[2]) }
    })
  },
  {
    // '/api/health should not return 403'
    regex: /^(.+) should not return (\d+)$/i,
    generate: (match) => ({
      name: `${match[1]} should not return ${match[2]}`,
      as: 'guest',
      request: { method: 'GET', path: match[1] },
      expect: { statusNot: parseInt(match[2]) }
    })
  },
  {
    // 'creating a project returns id'
    regex: /^creating (?:a |an )?(\w+) returns (.+)$/i,
    generate: (match) => {
      const resource = match[1].toLowerCase();
      const fields = match[2].split(/,?\s+and\s+|,\s*/).map(f => f.trim());
      return {
        name: `Creating a ${resource} returns ${match[2]}`,
        as: 'user',
        request: {
          method: 'POST',
          path: `/${resource}s`,
          body: { name: 'Test ' + resource }
        },
        expect: {
          status: [200, 201],
          bodyHas: fields
        }
      };
    }
  },
  {
    // 'GET /projects returns array'
    regex: /^(GET|POST|PUT|DELETE|PATCH) (.+) returns (array|object|string)$/i,
    generate: (match) => ({
      name: `${match[1]} ${match[2]} returns ${match[3]}`,
      as: 'user',
      request: { method: match[1].toUpperCase(), path: match[2] },
      expect: {
        status: 200,
        bodyIs: match[3].toLowerCase()
      }
    })
  },
  {
    // 'clients can access /portal/{token} without login'
    regex: /^(\w+) can access (.+) without (?:login|auth|authentication)$/i,
    generate: (match) => ({
      name: `${match[1]} can access ${match[2]} without login`,
      as: 'guest',
      request: { method: 'GET', path: match[2] },
      expect: {
        status: [200, 404],  // Valid or not found, but never 401/403
        statusNot: [401, 403]
      }
    })
  },
  {
    // 'authenticated users get 200 on /billing/subscription'
    regex: /^(authenticated|logged.?in|users?) get (\d+) on (.+)$/i,
    generate: (match) => ({
      name: `Authenticated users get ${match[2]} on ${match[3]}`,
      as: 'user',
      request: { method: 'GET', path: match[3] },
      expect: { status: parseInt(match[2]) }
    })
  },
  {
    // 'POST /auth/login with invalid credentials returns 401'
    regex: /^(GET|POST|PUT|DELETE|PATCH) (.+) with (.+) returns (\d+)$/i,
    generate: (match) => ({
      name: `${match[1]} ${match[2]} with ${match[3]} returns ${match[4]}`,
      as: 'guest',
      request: { method: match[1].toUpperCase(), path: match[2] },
      expect: { status: parseInt(match[4]) }
    })
  }
];

export function parseNaturalLanguage(description) {
  for (const pattern of PATTERNS) {
    const match = description.match(pattern.regex);
    if (match) {
      return pattern.generate(match);
    }
  }
  return null;
}

export function generateSpecFromDescription(description) {
  const test = parseNaturalLanguage(description);
  if (!test) {
    return null;
  }
  return test;
}

export function addTestToSpecFile(test, specFile) {
  let spec = { name: 'API Tests', tests: [] };

  if (fs.existsSync(specFile)) {
    const content = fs.readFileSync(specFile, 'utf-8');
    spec = yaml.load(content) || spec;
  }

  spec.tests = spec.tests || [];
  spec.tests.push(test);

  const dir = path.dirname(specFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(specFile, yaml.dump(spec, { indent: 2, lineWidth: -1 }));
  return spec;
}

export function createSpecFile(name, tests, outputPath) {
  const spec = {
    name,
    description: `Spec for ${name}`,
    tests
  };

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, yaml.dump(spec, { indent: 2, lineWidth: -1 }));
  return outputPath;
}
