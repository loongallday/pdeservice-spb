# Postman Collection for PDE Service

## Import Instructions

### Step 1: Import Environment
1. Open Postman
2. Click **Import** button
3. Select `PDE Service Local.postman_environment.json`
4. Click **Import**

### Step 2: Import Collection
1. Click **Import** button again
2. Select `PDE Service Local.postman_collection.json`
3. Click **Import**

### Step 3: Select Environment
1. In top-right corner of Postman, click the environment dropdown
2. Select **"PDE Service - Local"**
3. The environment is now active!

## Environment Variables

The environment includes:
- `baseUrl`: http://127.0.0.1:54321
- `apikey`: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
- `accessToken`: (auto-populated after sign in)
- `adminEmail`: admin@test.com
- `adminPassword`: admin1234 (stored as secret)
- `adminEmployeeId`: 1b96a8fa-79a3-4773-963a-07fb046ba2ca

### Authentication Flow

**One-Click Setup:**
1. Make sure **"PDE Service - Local"** environment is selected (top-right dropdown)
2. Go to **Authentication** → **Sign In**
3. Click **Send**
4. ✅ Done! The `accessToken` is automatically saved
5. All other APIs now work automatically with authentication

**What happens automatically:**
- Admin credentials are used from environment variables
- Access token is extracted from response and saved
- All subsequent requests automatically include the Bearer token

### Test Endpoints

After signing in, you can test any endpoint:
- **Initialize** - Get all initial app data (employee, roles, departments, features) in one request
- **Employees** - Manage employee records
- **Employee-Site Trainings** - Track which employees are trained for which sites
- **Announcements** - Publish announcement messages
- **Tickets** - Create and manage tickets
- **Companies** - Company management
- **Sites** - Site/location management
- **Contacts** - Contact information
- **Departments** - Department CRUD
- **Roles** - Role management
- **Features** - Get enabled features and menu items
- **Reference Data** - Work types, statuses, leave types, provinces
- **Appointments** - Appointment scheduling
- **Work Results** - Work result documentation
- **Leave Requests** - Leave request management
- **Polls** - Poll creation and voting
- **Merchandise** - Merchandise/equipment management
- **Models** - Merchandise model management
- **PM Log** - Preventive maintenance log entries
- **PM Summary** - PM summary and warranty renewal tracking

## Collection Structure

```
PDE Service - Local Development
├── Authentication
│   ├── Sign In (auto-saves token)
│   └── Get User
├── Initialize (1 request)
│   └── Initialize App (get all bootstrap data)
├── Employees (5 requests)
├── Employee-Site Trainings (4 requests)
├── Announcements (1 request)
├── Tickets (5 requests)
├── Companies (4 requests)
├── Sites (4 requests)
├── Contacts (3 requests)
├── Departments (3 requests)
├── Roles (3 requests)
├── Features (2 requests)
├── Reference Data (4 requests)
├── Appointments (3 requests)
├── Work Results (3 requests)
├── Leave Requests (3 requests)
├── Polls (4 requests)
├── Merchandise (6 requests)
├── Models (6 requests)
├── PM Log (6 requests)
└── PM Summary (3 requests)
```

## Tips

1. **Sign in first** - Always run the Sign In request before testing other endpoints
2. **Check responses** - Each request includes example bodies and parameters
3. **Replace UUIDs** - Replace `uuid-here` placeholders with actual IDs from your database
4. **View in Studio** - Use Supabase Studio (http://127.0.0.1:54323) to browse database and get IDs
5. **Auto-authentication** - The collection is configured to automatically include the Bearer token in all requests

## Troubleshooting

**401 Unauthorized:**
- Run the Sign In request again
- Check that `accessToken` variable is set (View → Show Postman Console)

**404 Not Found:**
- Ensure Supabase is running: `supabase status`
- Ensure Edge Functions are served: Check if `supabase_edge_runtime_pdeservice-spb` container is running

**Empty responses:**
- Create test data first via Studio or using POST requests
- Check RLS policies - admin@test.com has level 99 access

## Quick Start (3 Steps!)

1. **Import Environment** → `PDE Service Local.postman_environment.json`
2. **Import Collection** → `PDE Service Local.postman_collection.json`
3. **Select Environment** → Choose "PDE Service - Local" in top-right dropdown
4. **Sign In** → Run **Authentication → Sign In** (one click!)
5. **Test APIs** → All 60+ requests are now ready to use!

### First API to Try
After signing in, try these in order:
1. **Initialize → Initialize App** - Get all bootstrap data (employee, roles, departments, features) in one request
2. **Authentication → Get User** - Verify your token works
3. **Employees → Get Employee by Code** - See your admin profile
4. **Reference Data → Get Work Types** - Test a simple GET
5. **Features → Get Enabled Features** - See what features you have access to

Enjoy testing! 🚀

