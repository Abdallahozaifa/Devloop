# Features - QA Test Matrix

> Define your features here for automated QA testing.
> Update this file as you add new routes and endpoints.

## Frontend Routes

### Public Routes (No Auth Required)

| Route | Description | Priority |
|-------|-------------|----------|
| `/` | Landing/home page | HIGH |
| `/login` | User login | HIGH |
| `/register` | User registration | HIGH |
| `/forgot-password` | Password reset | MEDIUM |

### Protected Routes (Auth Required)

| Route | Description | Priority |
|-------|-------------|----------|
| `/dashboard` | Main dashboard | HIGH |
| `/profile` | User profile | MEDIUM |
| `/settings` | User settings | MEDIUM |

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Description | Priority |
|--------|----------|-------------|----------|
| POST | `/register` | Register new user | HIGH |
| POST | `/login` | User login | HIGH |
| GET | `/me` | Get current user | HIGH |
| POST | `/logout` | User logout | MEDIUM |
| POST | `/forgot-password` | Request password reset | MEDIUM |

### Users (`/api/users`)

| Method | Endpoint | Description | Priority |
|--------|----------|-------------|----------|
| GET | `/` | List users | MEDIUM |
| GET | `/{id}` | Get user | MEDIUM |
| PATCH | `/{id}` | Update user | MEDIUM |
| DELETE | `/{id}` | Delete user | LOW |

### Resources (`/api/resources`)

| Method | Endpoint | Description | Priority |
|--------|----------|-------------|----------|
| GET | `/` | List resources | HIGH |
| POST | `/` | Create resource | HIGH |
| GET | `/{id}` | Get resource | HIGH |
| PATCH | `/{id}` | Update resource | HIGH |
| DELETE | `/{id}` | Delete resource | MEDIUM |

## Critical User Flows

### Flow 1: User Registration & Login

1. Visit `/register`
2. Fill form, submit
3. Redirect to `/dashboard`
4. Logout
5. Visit `/login`
6. Login successfully
7. Verify on `/dashboard`

### Flow 2: Resource CRUD

1. Login
2. Go to `/resources`
3. Create new resource
4. View resource
5. Edit resource
6. Delete resource

## Test Account Requirements

### QA Test Account

- Email: `qa@example.com`
- Password: `QATest123!`
- Role: Standard user

## Environment Variables for Testing

```bash
# API
DEVLOOP_API_URL=https://your-api.example.com/api

# Test credentials
QA_EMAIL=qa@example.com
QA_PASSWORD=QATest123!

# For visual verification
ANTHROPIC_API_KEY=<your-key>
```

## Priority Legend

- **HIGH**: Core functionality, must pass
- **MEDIUM**: Important features, should pass
- **LOW**: Nice-to-have, can be deferred
