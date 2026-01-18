#!/bin/bash
# ==============================================
# Reset Local Database with Full Data
# ==============================================
# This script:
# 1. Resets the database with schema migration
# 2. Seeds reference data (departments, roles, etc.)
# 3. Seeds location data (provinces, districts, subdistricts)
# 4. Seeds test data (sample employees, companies, tickets)
#
# Usage: ./scripts/reset-local-db.sh
# ==============================================

set -e

echo "=== Resetting Local Database ==="

# Step 1: Reset database without seed
echo "Step 1: Applying schema migration..."
supabase db reset --no-seed

# Step 2: Seed reference data
echo "Step 2: Seeding reference data..."
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080000_seed_reference_data.sql

# Step 3: Seed location data
echo "Step 3: Seeding location data (this may take a moment)..."
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080001_seed_location_data.sql

# Step 4: Seed test data
echo "Step 4: Seeding test data..."
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080002_seed_test_data.sql

# Verify
echo ""
echo "=== Verification ==="
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
SELECT 'employees' as table_name, count(*) FROM main_employees
UNION ALL SELECT 'companies', count(*) FROM main_companies
UNION ALL SELECT 'sites', count(*) FROM main_sites
UNION ALL SELECT 'tickets', count(*) FROM main_tickets
UNION ALL SELECT 'provinces', count(*) FROM ref_provinces
UNION ALL SELECT 'districts', count(*) FROM ref_districts
UNION ALL SELECT 'subdistricts', count(*) FROM ref_sub_districts
ORDER BY 1;
"

echo ""
echo "=== Database Reset Complete ==="
