# DevLoop Architecture

## Three-Layer Architecture

DevLoop uses a three-layer architecture that separates framework-specific code from framework-agnostic code:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTRACTION LAYER                                │
│                    (Framework-Specific)                              │
├─────────────────────────────────────────────────────────────────────┤
│  FastAPI    │  Django   │  NestJS  │  Express  │  Flask   │  Rails  │
│  Extractor  │  Extractor│  Extractor│ Extractor │ Extractor│ Extractor│
│             │           │          │           │          │          │
│  - Route    │  - URL    │  - Decorator│ - Router │ - @route │ - Rails │
│    decorators│   patterns│   metadata │  methods │  decorators│ routing │
│  - Pydantic │  - DRF    │  - DTOs  │  - Joi/Zod│ - Marshmallow│ - AR  │
│    schemas  │  serializers│  Swagger │  validation│ schemas  │  models │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   UNIVERSAL SPEC FORMAT                              │
│                   (Framework-Agnostic)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  models:                                                             │
│    - name: User                                                      │
│      fields: [id, email, name]                                       │
│                                                                      │
│  api:                                                                │
│    - path: /users                                                    │
│      method: GET                                                     │
│      responses: {200: UserList, 401: Unauthorized}                   │
│                                                                      │
│  tests:                                                              │
│    - name: "List users"                                              │
│      request: {method: GET, path: /users}                            │
│      expect: {status: 200}                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       TEST RUNNER                                    │
│                   (Framework-Agnostic)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  - Reads universal spec YAML                                         │
│  - Makes HTTP requests to live API                                   │
│  - Validates responses against spec                                  │
│  - Reports pass/fail results                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## What Each Layer Does

### Extraction Layer (Framework-Specific)
This is the ONLY layer that needs to be rewritten for each framework:

| Component | What It Does | FastAPI Example |
|-----------|--------------|-----------------|
| Route Discovery | Find all API endpoints | Parse `@app.get()`, `@router.post()` decorators |
| Schema Extraction | Extract request/response models | Parse Pydantic models |
| Auth Detection | Identify protected routes | Find `Depends(get_current_user)` |
| Relationship Mapping | Link models to endpoints | Map response_model to schemas |

### Universal Spec Format (Framework-Agnostic)
A standardized YAML format that represents any API:

```yaml
models:
  - name: User
    fields:
      - name: id
        type: uuid
      - name: email
        type: string

api:
  - path: /api/v1/users
    method: GET
    auth: required
    responses:
      200:
        schema: UserList
      401:
        schema: ErrorResponse

tests:
  - name: "List users requires auth"
    request:
      method: GET
      path: /api/v1/users
    expect:
      status: 401
```

### Test Runner (Framework-Agnostic)
Executes tests against the universal spec:
- Reads the YAML spec file
- Makes actual HTTP requests
- Validates status codes, response shapes, timing
- Works with ANY backend that speaks HTTP

## Framework Plugin System

### Directory Structure

```
devloop-cli/
├── src/
│   ├── core/
│   │   ├── spec/
│   │   │   ├── runner.js          # Test execution (framework-agnostic)
│   │   │   └── validator.js       # Spec validation
│   │   └── ...
│   ├── extractors/
│   │   ├── base.js                # Abstract base extractor
│   │   ├── fastapi.js             # FastAPI implementation (DONE)
│   │   ├── django.js              # Django REST Framework
│   │   ├── nestjs.js              # NestJS
│   │   ├── express.js             # Express.js
│   │   └── detect.js              # Auto-detect framework
│   └── commands/
│       └── spec/
│           └── generate.js        # Uses extractors
```

### Base Extractor Interface

```javascript
// extractors/base.js
class BaseExtractor {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  // Must be implemented by each framework
  async discoverRoutes() {
    throw new Error('discoverRoutes() must be implemented');
  }

  async extractSchemas() {
    throw new Error('extractSchemas() must be implemented');
  }

  async detectAuth(route) {
    throw new Error('detectAuth() must be implemented');
  }

  async mapRelationships() {
    throw new Error('mapRelationships() must be implemented');
  }

  // Common helper methods available to all extractors
  async readFile(path) { /* ... */ }
  async findFiles(pattern) { /* ... */ }
  parseAST(code, language) { /* ... */ }
}
```

### Framework Detection

```javascript
// extractors/detect.js
async function detectFramework(projectPath) {
  // Check for framework indicators
  if (await hasFile('requirements.txt') && await hasImport('fastapi')) {
    return 'fastapi';
  }
  if (await hasFile('requirements.txt') && await hasImport('django')) {
    return 'django';
  }
  if (await hasFile('package.json') && await hasDep('@nestjs/core')) {
    return 'nestjs';
  }
  if (await hasFile('package.json') && await hasDep('express')) {
    return 'express';
  }
  // ... more frameworks
  return 'unknown';
}
```

## Framework Support Effort Estimates

| Framework | Effort | Key Challenges |
|-----------|--------|----------------|
| **FastAPI** | DONE | - |
| **Django REST** | 2-3 days | URL patterns (regex), DRF serializers, viewsets |
| **Flask** | 2-3 days | Multiple extension patterns (Flask-RESTful, Flask-RESTX) |
| **Express.js** | 3-5 days | No standard patterns, many routing approaches |
| **NestJS** | 2-3 days | TypeScript decorators, good metadata via Swagger |
| **Spring Boot** | 3-5 days | Java annotations, different ecosystem |
| **Rails** | 4-6 days | Ruby conventions, resource routing |

## Framework Roadmap

### Phase 1: Launch (Current)
- FastAPI (complete)

### Phase 2: Week 1-2 Post-Launch
- NestJS - TypeScript ecosystem, decorator-based (similar to FastAPI)
- Django REST Framework - Large Python user base

### Phase 3: Week 3-4
- Express.js - Largest JS backend user base
- Flask - Python alternative to FastAPI

### Phase 4: Month 2+
- Spring Boot - Enterprise Java
- Rails - Ruby ecosystem
- Go (Gin/Echo) - Growing demand

## Adding a New Framework

1. **Create extractor file**: `src/extractors/{framework}.js`
2. **Extend BaseExtractor**: Implement all required methods
3. **Add detection logic**: Update `detect.js`
4. **Add tests**: Framework-specific extraction tests
5. **Update docs**: Add framework to supported list

### Example: Adding Django Support

```javascript
// extractors/django.js
class DjangoExtractor extends BaseExtractor {
  async discoverRoutes() {
    // 1. Find urls.py files
    // 2. Parse urlpatterns
    // 3. Resolve viewsets to individual routes
    // 4. Return normalized route objects
  }

  async extractSchemas() {
    // 1. Find serializers.py files
    // 2. Parse DRF serializer classes
    // 3. Extract field definitions
    // 4. Return normalized schema objects
  }

  async detectAuth(route) {
    // 1. Check for permission_classes
    // 2. Check for @login_required decorator
    // 3. Check authentication_classes
  }
}
```

## AI-Assisted Extraction

For complex or edge cases, DevLoop uses Claude to help extract API information:

```javascript
async function aiAssistedExtraction(codeSnippet, framework) {
  const prompt = `
    Extract API endpoints from this ${framework} code.
    Return JSON with: path, method, auth, requestBody, responseSchema

    Code:
    ${codeSnippet}
  `;

  return await claude.complete(prompt);
}
```

This is used as a fallback when:
- Framework patterns are non-standard
- Custom decorators/middleware are used
- Code is too complex for AST parsing

## Key Design Principles

1. **Extraction is the hard part** - The universal spec and test runner are simple once extraction works
2. **Framework plugins are isolated** - Adding Django doesn't affect FastAPI
3. **AI fills the gaps** - When AST parsing fails, Claude can interpret code
4. **Universal spec is the contract** - All frameworks output the same format
5. **Test runner is dumb** - It just makes HTTP requests and validates responses
