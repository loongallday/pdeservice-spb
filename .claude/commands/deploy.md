# Deploy Edge Function

Deploy Supabase Edge Functions to production.

## Usage
```
/deploy <function-name>
/deploy all
```

## Examples
```
/deploy api-tickets
/deploy api-employees
/deploy all
```

## Available Functions (32 total)

### Core Business
- `api-tickets` - Work orders, comments, attachments, ratings
- `api-appointments` - Scheduling and approval
- `api-employees` - Workforce management
- `api-companies` - Company management
- `api-sites` - Customer locations
- `api-contacts` - Customer contacts
- `api-merchandise` - Equipment tracking
- `api-models` - Product models

### Reference & Config
- `api-reference-data` - Work types, statuses, provinces
- `api-roles` - Role management
- `api-departments` - Department management
- `api-features` - Feature flags
- `api-initialize` - App initialization

### Specialized
- `api-search` - Global search
- `api-analytics` - Workload analytics
- `api-reports` - Daily reports, Excel
- `api-fleet` - Vehicle management
- `api-fleet-sync` - Fleet GPS sync
- `api-route-optimization` - Route planning
- `api-stock` - Inventory
- `api-leave-requests` - Leave management
- `api-notifications` - Notifications
- `api-todos` - Task management

### Integration
- `api-ai` - AI assistant
- `api-ai-summary` - AI summaries
- `api-line-webhook` - LINE integration
- `api-staging` - File staging
- `api-places` - Google Places
- `api-package-services` - Service packages
- `api-employee-site-trainings` - Training records
- `api-ticket-work-estimates` - Work estimates
- `api-announcements` - Announcements

## Command
```bash
# Single function
npx supabase functions deploy $FUNCTION_NAME --no-verify-jwt --project-ref ogzyihacqbasolfxymgo

# All functions
npx supabase functions deploy --no-verify-jwt --project-ref ogzyihacqbasolfxymgo
```

## Pre-deployment Checklist
- [ ] Tests pass: `deno test tests/api-{name}/ --allow-all --no-lock --no-check`
- [ ] No TypeScript errors
- [ ] API documentation updated in `/doc/`
