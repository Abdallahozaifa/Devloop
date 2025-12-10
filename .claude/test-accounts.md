# Test Accounts for QA

## Overview

These test accounts are used for automated QA testing. Create them in your development and production environments.

## QA Test Account

**Email:** `qa@example.com`
**Password:** `QATest123!`
**Role:** Standard user

### Required Setup

This account needs the following data for comprehensive testing:

1. **Basic profile data** - Name, avatar, etc.
2. **Sample resources** - At least 2-3 test records
3. **Various states** - Some completed, some pending items

## Environment Variables

Set these in your shell or `.env.qa` file:

```bash
export DEVLOOP_API_URL="https://your-api.example.com/api"
export DEVLOOP_APP_URL="https://your-app.example.com"
export QA_EMAIL="qa@example.com"
export QA_PASSWORD="QATest123!"
```

## Creating Test Data via API

After creating the user, you can use the API to create test data:

```bash
# Login and get token
TOKEN=$(curl -s -X POST "$DEVLOOP_API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"qa@example.com","password":"QATest123!"}' | jq -r '.token')

# Create test resources
curl -X POST "$DEVLOOP_API_URL/resources" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Resource","description":"For QA testing"}'
```

## Security Notes

- These accounts are for **testing only**
- Do not use real customer data
- Passwords should be rotated periodically
- Do not commit actual credentials to git (use environment variables)
- Consider using separate test databases

## Token Caching

QA scripts cache authentication tokens to `.claude/.token` for performance.
This file is gitignored and auto-refreshed when expired.
