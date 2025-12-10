# DevLoop Coding Standards

## Frontend API Calls

### Always Include Headers and Body
Every fetch() call to the API MUST include:
1. `Content-Type: application/json` header for POST/PUT/PATCH
2. `Authorization: Bearer ${token}` header for authenticated endpoints
3. JSON body with ALL required fields per API schema

```typescript
// CORRECT
const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    return_url: `${window.location.origin}/dashboard`
  })
})

// WRONG - missing Content-Type and body
const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
})
```

### Check API Schema Before Frontend Changes
Before adding or modifying any API call in the frontend:
1. Read the corresponding Pydantic schema in `api/app/schemas/`
2. Identify ALL required fields
3. Include all required fields in the request body

Example: For `/api/v1/billing/portal`, check `api/app/schemas/billing.py`:
```python
class CreatePortalRequest(BaseModel):
    return_url: str  # Required!
```

### Handle API Errors Properly
```typescript
const res = await fetch(url, options)
if (!res.ok) {
  const error = await res.json().catch(() => ({ detail: 'Unknown error' }))
  console.error('API error:', res.status, error)
  // Show user-friendly error message
  return
}
const data = await res.json()
```

## Backend API Design

### Always Have Sensible Defaults
For optional fields that users might forget, provide defaults in Pydantic schemas:
```python
class CreateCheckoutRequest(BaseModel):
    plan: PlanType
    email: Optional[str] = None
    success_url: str = "https://devloop-landing.fly.dev/checkout/success"
    cancel_url: str = "https://devloop-landing.fly.dev/#pricing"
```

### Return Descriptive Error Messages
```python
@router.post("/portal")
async def create_portal(request: CreatePortalRequest, ...):
    if not request.return_url:
        raise HTTPException(
            status_code=422,
            detail="return_url is required"
        )
```

## Database

### PostgreSQL Enum Values
Always use lowercase for enum values to match Python conventions:
```python
# Python
class QASchedule(str, Enum):
    NONE = "none"      # Attribute uppercase, value lowercase
    HOURLY = "hourly"
    DAILY = "daily"
```

```sql
-- PostgreSQL - values must match Python enum VALUES (lowercase)
CREATE TYPE qaschedule AS ENUM ('none', 'hourly', 'daily', 'weekly');
```

### SQLAlchemy Enum Column Definition
**CRITICAL**: SQLAlchemy uses enum NAME by default, not VALUE. Always use `values_callable`:
```python
# CORRECT - uses enum values (lowercase)
qa_schedule: Mapped[QASchedule] = mapped_column(
    Enum(QASchedule, values_callable=lambda x: [e.value for e in x]),
    default=QASchedule.NONE,
    nullable=False
)

# WRONG - sends enum names (uppercase), causing PostgreSQL error
qa_schedule: Mapped[QASchedule] = mapped_column(
    Enum(QASchedule),  # Will send 'NONE' instead of 'none'
    default=QASchedule.NONE,
    nullable=False
)
```

### SSL Mode for Fly.io Internal Connections
When connecting to Fly Postgres internally:
```
DATABASE_URL=postgres://user:pass@app-db.internal:5432/db?sslmode=disable
```

## Testing

### E2E Tests Must Validate API Contracts
Every API endpoint called from the frontend needs a corresponding E2E test that:
1. Tests with correct request body (should succeed or return auth error)
2. Tests with empty/invalid body (should return 422, not 500)

```typescript
test('billing portal endpoint should validate request body', async ({ request }) => {
  // Test invalid request - should get 422
  const badResponse = await request.post(`${API_URL}/api/v1/billing/portal`, {
    headers: { 'Content-Type': 'application/json' },
    data: {}
  });
  expect([401, 403, 422]).toContain(badResponse.status());

  // Test valid request - should get 401/403 (auth), not 422
  const goodResponse = await request.post(`${API_URL}/api/v1/billing/portal`, {
    headers: { 'Content-Type': 'application/json' },
    data: { return_url: 'https://example.com/dashboard' }
  });
  expect([401, 403]).toContain(goodResponse.status());
});
```

### Run Tests Before Every Deploy
```bash
# Before deploying landing
cd landing && npm run test:chromium

# Before deploying API
cd api && python scripts/smoke_test.py --base-url https://devloop-api.fly.dev
```

### Authenticated E2E Testing with Playwright
For testing authenticated dashboard UI interactions, inject JWT into localStorage:

```typescript
test.describe('Authenticated Dashboard Tests', () => {
  // Generate token via: fly ssh console -a devloop-api (see INSTRUCTIONS.md)
  const TEST_JWT = 'your-jwt-token-here';

  test.beforeEach(async ({ page }) => {
    // Navigate first to establish origin
    await page.goto(BASE_URL);

    // Inject auth token - MUST use 'token' key (see App.tsx:254)
    await page.evaluate((token) => {
      localStorage.setItem('token', token);  // NOT 'devloop_token'!
    }, TEST_JWT);
  });

  test('should access dashboard when authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    // Should NOT see login form
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).not.toBeVisible({ timeout: 5000 });
  });
});
```

**Common Mistakes:**
1. Using wrong localStorage key (`devloop_token` vs `token`) - always grep the actual code
2. Token expiration - JWT tokens have `exp` claim, regenerate when tests fail
3. Not navigating before `page.evaluate()` - localStorage is origin-scoped

### Generate JWT for E2E Tests
```bash
# SSH into API and generate JWT token for test user
fly ssh console -a devloop-api -C "python3 -c \"
import os
from datetime import datetime, timedelta
from jose import jwt
secret = os.environ.get('SECRET_KEY')
user_id = 'aadfd94f-0b0d-44e8-bf1a-3ad15de7a4d1'  # Test user ID
expire = datetime.utcnow() + timedelta(days=1)
token = jwt.encode({'sub': user_id, 'exp': expire}, secret, algorithm='HS256')
print(token)
\""
```

### Test User Credentials
- **Email**: `abdallahozaifa19527@gmail.com`
- **User ID**: `aadfd94f-0b0d-44e8-bf1a-3ad15de7a4d1`
- **localStorage Key**: `token` (NOT `devloop_token`)

### Testing Expected API Responses
When testing endpoints that require authentication or subscriptions:

```typescript
// Manage Billing - returns 400 if user has no subscription (expected behavior)
test('manage billing button should work', async ({ page }) => {
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/api/v1/billing/portal')
  );
  await page.click('button:has-text("Manage Billing")');
  const response = await responsePromise;
  // 400 = no subscription, 200 = success - both are valid
  expect([200, 400]).toContain(response.status());
});
```

### Button Selector Best Practices
Use specific text matching for buttons with dynamic content:

```typescript
// WRONG - buttons may have more text
const button = page.locator('button:has-text("Get Started")');

// CORRECT - use partial match for buttons with prices
const button = page.locator('button:has-text("Get Started - $")');

// OR use more specific selector
const button = page.locator('[data-testid="solo-plan-button"]');
```

## React Component Patterns

### Shared Components for Consistent UI
When UI elements appear on multiple pages (navbar, footer, etc.), extract them into shared components:

```typescript
// CORRECT - shared component with props for configuration
type NavPage = 'home' | 'docs' | 'dashboard'

interface NavbarProps {
  activePage: NavPage
  user?: { email: string } | null
  onLogout?: () => void
  showFeaturesPricing?: boolean  // Show landing page anchor links
}

function Navbar({ activePage, user, onLogout, showFeaturesPricing = false }: NavbarProps) {
  const navLinkClass = (page: NavPage) => {
    const isActive = activePage === page
    return `text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white'}`
  }
  // ... component implementation
}

// Usage on different pages:
<Navbar activePage="home" showFeaturesPricing={true} />
<Navbar activePage="docs" />
<Navbar activePage="dashboard" user={user} onLogout={logout} />
```

```typescript
// WRONG - duplicating navbar code in each page component
function LandingPage() {
  return (
    <nav>...</nav>  // 50 lines of navbar code
  )
}

function DocsPage() {
  return (
    <nav>...</nav>  // Same 50 lines copied
  )
}
```

### TypeScript Type Definitions for Props
Always define types for component props, especially union types for valid values:

```typescript
// CORRECT - type-safe props
type NavPage = 'home' | 'docs' | 'dashboard'

// Usage - TypeScript will catch typos
<Navbar activePage="hom" />  // Error: Type '"hom"' is not assignable
```

### Remove Unused Imports Before Building
TypeScript strict mode flags unused imports. Always remove them:

```typescript
// WRONG - will cause build error TS6133
import { useState, useEffect, useCallback } from 'react'  // useCallback unused

// CORRECT
import { useState, useEffect } from 'react'
```

### Mobile-First Responsive Design
Use Tailwind's responsive prefixes (sm:, md:, lg:) for mobile-first design:

```typescript
// Mobile hamburger menu pattern
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

return (
  <nav>
    {/* Desktop nav - hidden on mobile */}
    <div className="hidden md:flex items-center gap-8">
      <Link to="/docs">Docs</Link>
    </div>

    {/* Mobile hamburger - shown on mobile only */}
    <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
      <Menu className="h-5 w-5" />
    </button>

    {/* Mobile menu dropdown */}
    {mobileMenuOpen && (
      <div className="md:hidden absolute top-full left-0 right-0 bg-zinc-900">
        <Link to="/docs">Docs</Link>
      </div>
    )}
  </nav>
)
```
