# DevLoop Debugging Guide

## Common Error Patterns

### Browser Console: "CORS error" or "Failed to fetch"
**Likely NOT a CORS issue.** Usually indicates a 500 server error.

**Debug steps:**
1. Check Fly.io API logs: `fly logs -a devloop-api`
2. Test endpoint directly with curl:
   ```bash
   curl -X POST https://devloop-api.fly.dev/api/v1/endpoint \
     -H "Content-Type: application/json" \
     -d '{"field": "value"}'
   ```
3. Look for actual error in API logs (SSL, database, validation)

### 422 Unprocessable Content
**Request body doesn't match expected schema.**

**Debug steps:**
1. Check the Pydantic schema in `api/app/schemas/`
2. Verify ALL required fields are included
3. Ensure `Content-Type: application/json` header is set
4. Check field types match (string vs number)

**Common causes:**
- Missing required field in request body
- Empty body sent to POST endpoint
- Wrong field name (case-sensitive)

### 500 Internal Server Error
**Server-side crash.**

**Debug steps:**
1. Check API logs: `fly logs -a devloop-api`
2. Look for Python traceback
3. Common causes:
   - Database connection failed (SSL issue)
   - Missing environment variable
   - Schema mismatch with database

### Database SSL Errors (asyncpg)
**Symptom:** `SSLError` or `ConnectionRefusedError` in logs

**Solution:** Use `sslmode=disable` for internal Fly.io connections:
```bash
fly secrets set DATABASE_URL="postgres://user:pass@db.internal:5432/db?sslmode=disable" -a devloop-api
```

### React "Cannot read property of undefined"
**Accessing nested data before async load completes.**

**Solution:** Add early return guards:
```typescript
useEffect(() => {
  if (!user) return;  // Guard
  if (!user.subscription) return;  // Guard
  setData(user.subscription.plan);
}, [user]);
```

## Quick Debug Commands

```bash
# View API logs in real-time
fly logs -a devloop-api

# Check API health
curl https://devloop-api.fly.dev/health

# Test specific endpoint
curl -X POST https://devloop-api.fly.dev/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "test"}'

# Connect to database
fly postgres connect -a devloop-db

# Check database schema
fly postgres connect -a devloop-db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';"

# Check Fly.io app status
fly status -a devloop-api
fly status -a devloop-landing

# SSH into app container
fly ssh console -a devloop-api
```

## API Endpoint Reference

| Endpoint | Method | Auth | Body Required |
|----------|--------|------|---------------|
| `/health` | GET | No | No |
| `/api/v1/auth/magic-link` | POST | No | `{ email }` |
| `/api/v1/auth/verify` | POST | No | `{ token }` |
| `/api/v1/auth/me` | GET | Yes | No |
| `/api/v1/billing/subscription` | GET | Yes | No |
| `/api/v1/billing/checkout` | POST | No | `{ plan, success_url, cancel_url }` |
| `/api/v1/billing/portal` | POST | Yes | `{ return_url }` |
| `/api/v1/dashboard/projects` | GET | Yes | No |
| `/api/v1/dashboard/projects` | POST | Yes | `{ name, ... }` |

## Expected Status Codes

| Scenario | Status Code |
|----------|-------------|
| Success | 200, 201 |
| Missing auth token | 401 |
| Invalid/expired token | 403 |
| Validation error (missing field) | 422 |
| Server crash | 500 |
| Bad gateway (app not running) | 502 |

## Fly.io Specific Issues

### Machine Not Starting
```bash
fly status -a devloop-api
fly logs -a devloop-api --instance <id>
```

### Secrets Not Applied
Secrets override fly.toml env vars. Redeploy after setting:
```bash
fly secrets set KEY=value -a devloop-api
fly deploy -a devloop-api
```

### Database Connection Issues
1. Check machine is in same region as database
2. Verify DATABASE_URL uses `.internal` hostname
3. Ensure `sslmode=disable` for internal connections
