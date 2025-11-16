# Testing Edge Functions in Postman

## Setup

### 1. Create Test User via Supabase Studio

1. Open http://127.0.0.1:54323 (Supabase Studio)
2. Go to **Authentication** > **Users**
3. Click **Add user** > **Create new user**
4. Email: `test@example.com`
5. Password: `test123456`
6. Click **Create user**

### 2. Get JWT Token

**Method 1: Sign in via API**

```
POST http://127.0.0.1:54321/auth/v1/token?grant_type=password
Headers:
  apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
  Content-Type: application/json

Body (raw JSON):
{
  "email": "test@example.com",
  "password": "test123456"
}
```

**Response** will contain:
```json
{
  "access_token": "eyJhbGc...",  // <- Use this as Bearer token
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

### 3. Test Edge Functions

**Example 1: Get Tickets**
```
GET http://127.0.0.1:54321/functions/v1/api-tickets
Headers:
  apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
  Authorization: Bearer eyJhbGc...  // <- Your access_token
  Content-Type: application/json
```

**Example 2: Get Features**
```
GET http://127.0.0.1:54321/functions/v1/api-features
Headers:
  apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
  Authorization: Bearer eyJhbGc...
```

**Example 3: Create Ticket**
```
POST http://127.0.0.1:54321/functions/v1/api-tickets
Headers:
  apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
  Authorization: Bearer eyJhbGc...
  Content-Type: application/json

Body (raw JSON):
{
  "company_id": "uuid-here",
  "site_id": "uuid-here",
  "work_type_id": "uuid-here",
  "description": "Test ticket"
}
```

## Postman Environment Setup (Optional)

Create a Postman Environment with these variables:

```
baseUrl: http://127.0.0.1:54321
functionsUrl: {{baseUrl}}/functions/v1
authUrl: {{baseUrl}}/auth/v1
apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
accessToken: (leave empty, set after login)
```

## All Available Endpoints

1. **api-tickets** - Ticket CRUD operations
2. **api-employees** - Employee management
3. **api-sites** - Site management
4. **api-companies** - Company management
5. **api-contacts** - Contact management
6. **api-appointments** - Appointment management
7. **api-work-results** - Work result management
8. **api-roles** - Role management
9. **api-departments** - Department management
10. **api-leave-requests** - Leave request management
11. **api-polls** - Poll management
12. **api-features** - Feature management
13. **api-reference-data** - Reference data (statuses, work types, etc.)

## Testing Tips

1. **Create test data first** via Studio (http://127.0.0.1:54323)
   - Create departments
   - Create roles
   - Create employees (link to auth user)
   - Create companies, sites, etc.

2. **Set up employee record**
   - After creating auth user, create corresponding employee record
   - Link employee.auth_user_id to auth.users.id
   - Set employee.role_id and employee.is_active = true

3. **Test in order**
   - Reference data first (no complex dependencies)
   - Then basic entities (departments, roles)
   - Then entities with relationships (employees, sites)
   - Finally complex operations (tickets, work results)

