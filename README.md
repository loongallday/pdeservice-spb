# pdeservice-spb

A service project.

## Getting Started

This project is currently under development.

## Prerequisites

- **Docker Desktop** - Required only for local Supabase development
  - Download and install from: https://docs.docker.com/desktop/install/windows-install/
  - Make sure Docker Desktop is running before starting local development
  - **NOT needed for deploying functions to remote**

- **Node.js** (v18 or higher) - For running Supabase CLI

## Installation

1. **Install Docker Desktop** (if not already installed):
   - Download from: https://docs.docker.com/desktop/install/windows-install/
   - Install and start Docker Desktop
   - Wait for Docker Desktop to fully start (whale icon in system tray)

2. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

3. **Start Supabase locally**:
   ```bash
   npx supabase start
   ```

   **Note**: If you encounter permission errors, try running PowerShell as Administrator.

## Usage

### Local Development

**Start local Supabase:**
```bash
supabase start
```

Once Supabase is running locally, you can access:
- **Supabase Studio**: http://localhost:54323
- **API URL**: http://localhost:54321
- **Database**: localhost:54322

**Testing functions locally:**
Each function has its own `deno.json` file for proper dependency management and linting. Your VS Code is already configured to use Deno for the functions directory.

To test a function locally:
```bash
supabase functions serve <function-name>
```

Or serve all functions:
```bash
supabase functions serve
```

**Stop local Supabase:**
```bash
supabase stop
```

### Deploying Functions to Remote

Deploy a single function (clean, no warnings):
```bash
supabase functions deploy <function-name> --no-verify-jwt --use-api
```

Deploy all functions:
```bash
supabase functions deploy --no-verify-jwt --use-api
```

**Why `--use-api`?**
- Uses the Management API to bundle functions remotely
- Eliminates all local bundling warnings
- No Docker required for deployment
- Faster and cleaner deployment process

**Each function includes:**
- `deno.json` - Deno configuration for dependencies and compiler options
- Proper TypeScript types and linting
- Isolated dependency management

## Testing

### Running Unit Tests

**Run all tests:**
```bash
deno test --allow-all
```

**Run tests for specific API:**
```bash
deno test tests/api-appointments/
```

**Run tests in watch mode:**
```bash
deno test --watch --allow-all
```

**Run tests with coverage:**
```bash
deno test --coverage=coverage --allow-all
```

**Using test tasks:**
```bash
deno task test          # Run all tests
deno task test:watch    # Watch mode
deno task test:coverage # With coverage
```

See [tests/README.md](./tests/README.md) for detailed testing documentation.

## Troubleshooting

### Migration History Mismatch

If you encounter an error like "The remote database's migration history does not match local files", it means your remote database has migrations that don't exist locally.

**Solution 1: Pull Current Schema (Recommended - Single Operation)**
If your local migrations directory is empty or out of sync, pull your current remote schema:

```bash
supabase db pull
```

This creates a new migration file that matches your current remote database schema. This is faster and avoids rate limiting issues.

**Solution 2: Repair Migration History (Use with caution - many API calls)**
If you need to mark remote migrations as "reverted" instead:

```powershell
.\repair-migrations.ps1
```

⚠️ **Note**: This script makes many API calls and may trigger rate limiting. Wait 15-30 minutes between runs if you get IP banned. The script now includes delays and retry logic to minimize this issue.

**Solution 3: Manual Repair**
You can also repair individual migrations manually:

```bash
supabase migration repair --status reverted <timestamp>
```

## License

TBD
