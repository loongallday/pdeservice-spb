# Data Sanitization Guide for Edge Functions

## Overview
All edge function services MUST sanitize data before database operations to prevent schema mismatch errors.

## Implementation Pattern

### 1. Import the sanitize utility
```typescript
import { sanitizeData } from '../_shared/sanitize.ts';
```

### 2. Add private static sanitization method to service class
```typescript
private static sanitize{Resource}Data(data: Record<string, unknown>): Record<string, unknown> {
  const validFields = [
    // List all valid fields from database schema
    // Exclude: id (auto-generated), created_at, updated_at (auto-managed)
    'field1',
    'field2',
    // ...
  ];
  return sanitizeData(data, validFields);
}
```

### 3. Use sanitization in create/update methods
```typescript
static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  
  // Sanitize data to remove invalid fields
  const sanitizedData = this.sanitize{Resource}Data(data);
  
  // ... rest of implementation
}
```

## Valid Fields by Table

### sites
**Schema fields**: name, subdistrict_code, district_code, province_code, postal_code, address_detail, map_url, company_id, contact_ids
**Exclude**: id, created_at, updated_at, tax_id (deprecated), district, tambon, province, subdistrict_id (removed)

### companies  
**Schema fields**: tax_id, name_th, name_en, type, status, objective, objective_code, register_date, register_capital, branch_name, address_full, address_no, address_moo, address_building, address_floor, address_room_no, address_soi, address_yaek, address_trok, address_village, address_road, address_tambon, address_district, address_province, address_tambon_code, address_district_code, address_province_code, address_detail
**Exclude**: created_at, updated_at

### contacts
**Schema fields**: site_id, person_name, nickname, phone, email, line_id, note
**Exclude**: id, created_at, updated_at

### tickets
**Schema fields**: details, work_type_id, assigner_id, status_id, additional, site_id, contact_id, work_result_id, appointment_id
**Exclude**: id, created_at, updated_at

### employees
**Schema fields**: name, code, is_active, auth_user_id, nickname, email, role_id
**Exclude**: id, created_at, updated_at

### work_results
**Schema fields**: ticket_id, description, created_by
**Exclude**: id, created_at, updated_at

### polls
**Schema fields**: title, description, poll_type, is_anonymous, expires_at, created_by
**Exclude**: id, created_at, updated_at

### roles
**Schema fields**: code, name_th, name_en, description, name, level
**Exclude**: id (note: no created_at/updated_at)

### leave_requests
**Schema fields**: employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approved_at, half_day_type
**Exclude**: id, created_at, updated_at

## Services Status

✅ **Completed**:
- sites (siteService.ts) - DONE
- companies (companyService.ts) - DONE

⏳ **Pending**:
- contacts (contactService.ts)
- tickets (ticketService.ts)
- employees (employeeService.ts)
- work_results (workResultService.ts)
- polls (pollService.ts)
- roles (roleService.ts)
- leave_requests (leaveService.ts)

## Testing
After implementing sanitization:
1. Test create operations with extra fields
2. Test update operations with invalid fields
3. Verify database errors don't occur for removed columns

