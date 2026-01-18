# API Search

## Overview

The Search API provides unified global search functionality across multiple entity types in the Field Service Management system. It allows users to search companies, sites, tickets, merchandise, and employees in a single request with results grouped by entity type.

Key features:
- Multi-entity search in a single request
- Parallel search execution for performance
- Thai and English text matching
- Partial word matching (prefix search with `%query%`)
- Results grouped by entity type with counts
- Configurable result limits per entity type

---

## Base URL

```
/api-search
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Required Permission Level:** 0 (Technician L1 or higher)

All authenticated users can perform global searches.

---

## Searchable Entities

| Entity Type | Search Fields | Order By |
|-------------|---------------|----------|
| `company` | name_th, name_en, tax_id | name_th |
| `site` | name, address_detail | name |
| `ticket` | ticket_code, details, details_summary | created_at (desc) |
| `merchandise` | serial_no | serial_no |
| `employee` | name, code, nickname, email | name |

**Notes:**
- Employee search only returns active employees (`is_active = true`)
- All searches use case-insensitive partial matching (`ILIKE %query%`)

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | Global search across entities | Yes |

---

## Endpoints

### 1. Global Search

Search across multiple entity types simultaneously.

**Request**

```
GET /api-search
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query (minimum 2 characters) |
| `types` | string | No | all types | Comma-separated list of entity types to search |
| `limit` | integer | No | 5 | Maximum results per entity type (1-10) |

**Valid Types**

- `company` - Search companies
- `site` - Search sites
- `ticket` - Search tickets
- `merchandise` - Search merchandise
- `employee` - Search employees

**Response**

```json
{
  "data": {
    "query": "ABC",
    "total": 15,
    "results": {
      "companys": [
        {
          "id": "uuid",
          "type": "company",
          "title": "บริษัท ABC จำกัด",
          "subtitle": "0123456789012",
          "description": "123 ถนนสุขุมวิท แขวงคลองเตย...",
          "metadata": {
            "tax_id": "0123456789012",
            "name_en": "ABC Company Limited"
          }
        }
      ],
      "sites": [
        {
          "id": "uuid",
          "type": "site",
          "title": "สาขา ABC สุขุมวิท",
          "subtitle": "บริษัท ABC จำกัด",
          "description": "456 ซอยสุขุมวิท 21...",
          "metadata": {
            "is_main_branch": false,
            "company_id": "uuid"
          }
        }
      ],
      "tickets": [
        {
          "id": "uuid",
          "type": "ticket",
          "title": "TK-2024-001234",
          "subtitle": "สาขา ABC สุขุมวิท",
          "description": "เครื่อง UPS ไม่ทำงาน",
          "metadata": {
            "status": "รอดำเนินการ",
            "work_type": "ซ่อม/เคลม",
            "site_id": "uuid"
          }
        }
      ],
      "merchandise": [
        {
          "id": "uuid",
          "type": "merchandise",
          "title": "ABC123456789",
          "subtitle": "UPS-3000VA",
          "description": "สาขา ABC สุขุมวิท",
          "metadata": {
            "model_id": "uuid",
            "model_name": "UPS 3000VA Online",
            "site_id": "uuid"
          }
        }
      ],
      "employees": [
        {
          "id": "uuid",
          "type": "employee",
          "title": "สมชาย ABC",
          "subtitle": "ชาย",
          "description": "ช่างเทคนิค",
          "metadata": {
            "code": "EMP001",
            "email": "somchai@example.com",
            "role_id": "uuid"
          }
        }
      ]
    },
    "counts": {
      "companys": 3,
      "sites": 5,
      "tickets": 4,
      "merchandise": 2,
      "employees": 1
    }
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | The search query that was executed |
| `total` | integer | Total number of results across all entity types |
| `results` | object | Search results grouped by entity type |
| `counts` | object | Total count of matches per entity type |

**Note:** The response uses `companys` (not `companies`) as the key name to match frontend expectations. This is a documented intentional naming.

**Search Result Object Fields**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique identifier of the entity |
| `type` | string | No | Entity type (`company`, `site`, `ticket`, `merchandise`, `employee`) |
| `title` | string | No | Primary display text |
| `subtitle` | string | Yes | Secondary display text |
| `description` | string | Yes | Additional context (truncated to 100 chars) |
| `metadata` | object | Yes | Type-specific additional data |

**Metadata by Entity Type**

| Entity | Metadata Fields |
|--------|-----------------|
| `company` | `tax_id`, `name_en` |
| `site` | `is_main_branch`, `company_id` |
| `ticket` | `status`, `work_type`, `site_id` |
| `merchandise` | `model_id`, `model_name`, `site_id` |
| `employee` | `code`, `email`, `role_id` |

**Example Requests**

```bash
# Search all entity types
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-search?q=ABC" \
  -H "Authorization: Bearer <token>"

# Search only companies and sites
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-search?q=สุขุมวิท&types=company,site" \
  -H "Authorization: Bearer <token>"

# Search with custom limit
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-search?q=UPS&limit=10" \
  -H "Authorization: Bearer <token>"

# Search tickets only
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-search?q=TK-2024&types=ticket" \
  -H "Authorization: Bearer <token>"

# Search merchandise by serial number
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-search?q=SN123&types=merchandise&limit=5" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All errors follow the standard API error format:

```json
{
  "error": "Error message in Thai"
}
```

### Common Errors

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 400 | ต้องระบุคำค้นหาอย่างน้อย 2 ตัวอักษร | Search query must be at least 2 characters |
| 400 | ประเภทไม่ถูกต้อง: xyz | Invalid entity type specified in `types` parameter |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 405 | Method not allowed | Only GET method is supported |
| 500 | Database error message | Database error during search |

---

## Usage Notes

### Frontend Integration

1. **Omnibox Search**: This API is designed for "search everywhere" functionality where users can type a query and see results from multiple entity types.

2. **Result Grouping**: Results are pre-grouped by entity type, making it easy to display in categorized sections (e.g., "Companies", "Sites", "Tickets").

3. **Counts for UI**: Use the `counts` object to show result counts per category, even when limiting displayed results.

4. **Type Filtering**: Use the `types` parameter to optimize searches when you only need specific entity types.

5. **Performance**: Searches are executed in parallel for all specified entity types, minimizing response time.

### Search Behavior

- **Minimum Query Length**: Queries must be at least 2 characters to avoid overly broad searches
- **Case Insensitive**: All searches are case-insensitive
- **Partial Matching**: Searches match anywhere in the field (contains search, not prefix-only)
- **Empty Results**: If a search fails for a specific entity type (e.g., database error), that type returns empty results without failing the entire request

### Limit Behavior

- Default limit is 5 results per entity type
- Maximum limit is 10 results per entity type
- Limit applies to each entity type independently
- The `counts` object shows total matches even if results are limited

---

## Related Endpoints

- **Companies API** (`/api-companies`) - Full company CRUD operations
- **Sites API** (`/api-sites`) - Site management
- **Tickets API** (`/api-tickets`) - Ticket management with advanced search
- **Merchandise API** (`/api-merchandise`) - Merchandise management
- **Employees API** (`/api-employees`) - Employee management

---

## Database Tables

This API searches across the following tables:

| Table | Description |
|-------|-------------|
| `main_companies` | Company records |
| `main_sites` | Site/location records |
| `main_tickets` | Work order tickets |
| `main_merchandise` | Equipment/merchandise records |
| `main_employees` | Employee records |
