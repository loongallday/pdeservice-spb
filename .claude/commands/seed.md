# Seed Database

Seed the local database with test data.

## Usage
```
/seed [type]
```

## Examples
```
/seed                    # Seed all data
/seed reference          # Seed reference data only
/seed location           # Seed location data only
/seed test               # Seed test data only
/seed auth               # Seed auth users only
```

## Seed Files

Located in `supabase/seeds/`:

| File | Content | Order |
|------|---------|-------|
| `20260118080000_seed_reference_data.sql` | Work types, statuses, leave types, roles | 1st |
| `20260118080001_seed_location_data.sql` | Thai provinces, districts, subdistricts | 2nd |
| `20260118080002_seed_test_data.sql` | Employees, companies, sites, tickets | 3rd |
| `20260118080003_seed_auth_users.sql` | Test users in auth.users | 4th |

## Commands

### Reset and Seed All
```bash
supabase db reset --no-seed
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080000_seed_reference_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080001_seed_location_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080002_seed_test_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080003_seed_auth_users.sql
```

### Seed Individual Files
```bash
# Reference data only
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080000_seed_reference_data.sql

# Location data only
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080001_seed_location_data.sql

# Test data only
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080002_seed_test_data.sql

# Auth users only
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080003_seed_auth_users.sql
```

## Test Data Created

### Employees (10)
| ID | Email | Role |
|----|-------|------|
| `00000000-...-000000000001` | admin@pdeservice.com | Superadmin |
| `00000000-...-000000000002` | admin2@pdeservice.com | Admin |
| `00000000-...-000000000003` | assigner@pdeservice.com | Assigner |
| `00000000-...-000000000004` | tech1@pdeservice.com | Technician |
| `00000000-...-000000000005` | tech2@pdeservice.com | Technician |
| ... | ... | ... |

### Companies (5)
- Test Company (`10000000-...-000000000001`)
- ABC Corp (`10000000-...-000000000002`)
- Thai Tech (`10000000-...-000000000003`)
- Bangkok Electronics (`10000000-...-000000000004`)
- Siam Power (`10000000-...-000000000005`)

### Sites (8)
- Linked to companies above
- IDs: `20000000-0000-0000-0000-00000000000X`

### Tickets (5)
- Various work types (PM, RMA, Sales, Survey)
- IDs: `60000000-0000-0000-0000-00000000000X`

### Appointments (5)
- Linked to tickets
- IDs: `50000000-0000-0000-0000-00000000000X`

## Reference Data

### Work Types
- PM, RMA, Sales, Survey, Startup, Account, Pickup, AGS Battery

### Ticket Statuses
- Normal, Urgent, etc.

### Leave Types
- Annual, Sick, Personal, etc.

### Provinces
- All 77 Thai provinces with districts and subdistricts

## Notes

- Always seed in order (reference → location → test → auth)
- Auth seed requires reference and test data first
- Use `supabase db reset --no-seed` to clear before seeding
