# API Analytics

## Overview

The Analytics API provides comprehensive workforce analytics and reporting endpoints focused on technician utilization, workload distribution, and performance trends. This API is designed to help managers and administrators monitor team efficiency, identify workload imbalances, and track performance over time.

**Base URL:** `/api-analytics`

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header.

```
Authorization: Bearer <jwt_token>
```

**Required Permission Level:** Level 1+ (Assigner, PM, Sales, Admin, Superadmin)

| Level | Role | Access |
|-------|------|--------|
| 1 | Assigner, PM, Sales | Full read access |
| 2 | Admin | Full read access |
| 3 | Superadmin | Full read access |

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/technicians/utilization` | Get utilization metrics for a specific date |
| GET | `/technicians/utilization/summary` | Get utilization summary over a date range |
| GET | `/technicians/workload` | Get detailed workload metrics for a specific date |
| GET | `/technicians/workload/distribution` | Get workload distribution over a date range |
| GET | `/technicians/trends` | Get utilization trends over a date range |
| GET | `/technicians/:id` | Get detailed analytics for a specific technician |

---

## Endpoints

### 1. Get Technician Utilization

Retrieves utilization metrics for all technicians on a specific date. Shows how many technicians were active, ticket assignments, and breakdowns by work type and appointment type.

**Endpoint:** `GET /api-analytics/technicians/utilization`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | Date in `YYYY-MM-DD` format |

#### Response

```json
{
  "data": {
    "date": "2026-01-15",
    "total_technicians": 50,
    "active_technicians": 35,
    "utilization_rate": 70.00,
    "total_tickets_assigned": 120,
    "total_tickets_confirmed": 95,
    "confirmation_rate": 79.17,
    "avg_tickets_per_active_technician": 3.43,
    "by_work_type": [
      {
        "work_type_id": "uuid-1",
        "work_type_code": "pm",
        "work_type_name": "บำรุงรักษา",
        "ticket_count": 45,
        "technician_count": 20
      },
      {
        "work_type_id": "uuid-2",
        "work_type_code": "rma",
        "work_type_name": "เคลม/ซ่อม",
        "ticket_count": 30,
        "technician_count": 15
      }
    ],
    "by_appointment_type": [
      {
        "appointment_type": "scheduled",
        "ticket_count": 80,
        "technician_count": 30
      },
      {
        "appointment_type": "emergency",
        "ticket_count": 40,
        "technician_count": 20
      }
    ],
    "generated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The requested date |
| `total_technicians` | number | Total number of active technicians in the system |
| `active_technicians` | number | Number of technicians with assignments on this date |
| `utilization_rate` | number | Percentage of technicians that were active (0-100) |
| `total_tickets_assigned` | number | Total unique tickets assigned on this date |
| `total_tickets_confirmed` | number | Total tickets confirmed by technicians |
| `confirmation_rate` | number | Percentage of assigned tickets that were confirmed (0-100) |
| `avg_tickets_per_active_technician` | number | Average ticket load per active technician |
| `by_work_type` | array | Breakdown by work type (PM, RMA, Sales, etc.) - uses Thai names |
| `by_appointment_type` | array | Breakdown by appointment type |
| `generated_at` | string | Timestamp when the report was generated |

#### Example Request

```bash
curl -X GET "https://api.example.com/api-analytics/technicians/utilization?date=2026-01-15" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Utilization Summary

Retrieves aggregated utilization summary over a date range, including top performers and underutilized technicians.

**Endpoint:** `GET /api-analytics/technicians/utilization/summary`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in `YYYY-MM-DD` format |
| `end_date` | string | Yes | End date in `YYYY-MM-DD` format |

**Note:** Maximum date range is 90 days.

#### Response

```json
{
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-31",
      "days": 31
    },
    "overall": {
      "total_technicians": 50,
      "avg_active_technicians": 32.5,
      "avg_utilization_rate": 65.00,
      "total_tickets_assigned": 2500,
      "total_tickets_confirmed": 2100,
      "overall_confirmation_rate": 84.00
    },
    "by_technician": [
      {
        "employee_id": "uuid-tech-1",
        "employee_name": "John Doe",
        "employee_code": "EMP001",
        "role_code": "technician_l2",
        "tickets_assigned": 85,
        "tickets_confirmed": 80,
        "days_active": 22,
        "utilization_rate": 70.97,
        "avg_tickets_per_day": 3.86,
        "key_employee_count": 45
      }
    ],
    "top_performers": [
      {
        "employee_id": "uuid-tech-1",
        "employee_name": "John Doe",
        "employee_code": "EMP001",
        "role_code": "technician_l2",
        "tickets_assigned": 85,
        "tickets_confirmed": 80,
        "days_active": 22,
        "utilization_rate": 70.97,
        "avg_tickets_per_day": 3.86,
        "key_employee_count": 45
      }
    ],
    "underutilized": [
      {
        "employee_id": "uuid-tech-10",
        "employee_name": "Jane Smith",
        "employee_code": "EMP010",
        "role_code": "technician",
        "tickets_assigned": 15,
        "tickets_confirmed": 12,
        "days_active": 8,
        "utilization_rate": 25.81,
        "avg_tickets_per_day": 1.88,
        "key_employee_count": 5
      }
    ],
    "generated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `period` | object | Date range information |
| `period.start` | string | Start date of the period |
| `period.end` | string | End date of the period |
| `period.days` | number | Number of days in the period |
| `overall` | object | Aggregated metrics for the period |
| `overall.total_technicians` | number | Total technicians in the system |
| `overall.avg_active_technicians` | number | Average active technicians per day |
| `overall.avg_utilization_rate` | number | Average utilization rate across all technicians |
| `overall.total_tickets_assigned` | number | Total tickets assigned in the period |
| `overall.total_tickets_confirmed` | number | Total tickets confirmed in the period |
| `overall.overall_confirmation_rate` | number | Overall confirmation rate percentage |
| `by_technician` | array | Full list of all technicians with their metrics |
| `top_performers` | array | Top 10 technicians by tickets assigned |
| `underutilized` | array | Bottom 10 active technicians by tickets assigned |

#### Technician Summary Object

| Field | Type | Description |
|-------|------|-------------|
| `employee_id` | string | Unique identifier (UUID) |
| `employee_name` | string | Full name |
| `employee_code` | string | Employee code |
| `role_code` | string | Role code (technician, technician_l1, technician_l2) |
| `tickets_assigned` | number | Total tickets assigned in the period |
| `tickets_confirmed` | number | Total tickets confirmed |
| `days_active` | number | Number of days with assignments |
| `utilization_rate` | number | Percentage of days active in the period |
| `avg_tickets_per_day` | number | Average tickets per active day |
| `key_employee_count` | number | Times marked as key/lead employee |

#### Example Request

```bash
curl -X GET "https://api.example.com/api-analytics/technicians/utilization/summary?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Technician Workload

Retrieves detailed workload metrics for a specific date, including distribution statistics and individual technician loads.

**Endpoint:** `GET /api-analytics/technicians/workload`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | Date in `YYYY-MM-DD` format |

#### Response

```json
{
  "data": {
    "date": "2026-01-15",
    "distribution": {
      "min_tickets": 1,
      "max_tickets": 8,
      "avg_tickets": 3.43,
      "median_tickets": 3,
      "std_deviation": 1.52,
      "quartiles": {
        "q1": 2,
        "q2": 3,
        "q3": 5
      }
    },
    "balance_score": 78.50,
    "technician_workloads": [
      {
        "employee_id": "uuid-tech-1",
        "employee_name": "John Doe",
        "employee_code": "EMP001",
        "tickets_count": 5,
        "is_key_employee_count": 3,
        "work_types": [
          { "code": "pm", "count": 3 },
          { "code": "rma", "count": 2 }
        ],
        "provinces": [
          { "code": "10", "name": "กรุงเทพมหานคร", "count": 4 },
          { "code": "11", "name": "สมุทรปราการ", "count": 1 }
        ],
        "workload_status": "normal"
      }
    ],
    "by_work_type": [
      {
        "work_type_id": "uuid-1",
        "work_type_code": "pm",
        "work_type_name": "PM",
        "ticket_count": 45,
        "avg_technicians_per_ticket": 1.5,
        "technician_ids": ["uuid-tech-1", "uuid-tech-2"]
      }
    ],
    "geographic_distribution": [
      {
        "province_code": "10",
        "province_name": "กรุงเทพมหานคร",
        "ticket_count": 50,
        "technician_count": 20,
        "avg_tickets_per_technician": 2.5
      }
    ],
    "generated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | The requested date |
| `distribution` | object | Statistical distribution of ticket counts |
| `distribution.min_tickets` | number | Minimum tickets assigned to any technician |
| `distribution.max_tickets` | number | Maximum tickets assigned to any technician |
| `distribution.avg_tickets` | number | Average tickets per technician |
| `distribution.median_tickets` | number | Median ticket count |
| `distribution.std_deviation` | number | Standard deviation of ticket distribution |
| `distribution.quartiles` | object | Quartile values (q1, q2, q3) |
| `balance_score` | number | Workload balance score (0-100, higher is better) |
| `technician_workloads` | array | Individual workload for each technician |
| `by_work_type` | array | Workload breakdown by work type |
| `geographic_distribution` | array | Workload breakdown by province |

#### Workload Status Values

| Status | Description |
|--------|-------------|
| `underloaded` | Less than 50% of average workload |
| `normal` | Between 50% and 150% of average workload |
| `overloaded` | More than 150% of average workload |

#### Example Request

```bash
curl -X GET "https://api.example.com/api-analytics/technicians/workload?date=2026-01-15" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Get Workload Distribution

Retrieves workload distribution trends over a date range, including daily balance scores and averages.

**Endpoint:** `GET /api-analytics/technicians/workload/distribution`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in `YYYY-MM-DD` format |
| `end_date` | string | Yes | End date in `YYYY-MM-DD` format |

**Note:** Maximum date range is 90 days.

#### Response

```json
{
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-31",
      "days": 31
    },
    "daily_averages": {
      "avg_tickets_per_day": 95.5,
      "avg_active_technicians": 32.5,
      "avg_tickets_per_technician": 2.94
    },
    "workload_balance": {
      "avg_balance_score": 75.80,
      "best_day": {
        "date": "2026-01-15",
        "score": 92.50
      },
      "worst_day": {
        "date": "2026-01-08",
        "score": 45.30
      }
    },
    "distribution_trend": [
      {
        "date": "2026-01-01",
        "active_technicians": 30,
        "total_tickets": 90,
        "avg_tickets_per_technician": 3.0,
        "balance_score": 78.50
      },
      {
        "date": "2026-01-02",
        "active_technicians": 35,
        "total_tickets": 105,
        "avg_tickets_per_technician": 3.0,
        "balance_score": 82.30
      }
    ],
    "generated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `period` | object | Date range information |
| `daily_averages` | object | Average metrics across the period |
| `daily_averages.avg_tickets_per_day` | number | Average total tickets per day |
| `daily_averages.avg_active_technicians` | number | Average active technicians per day |
| `daily_averages.avg_tickets_per_technician` | number | Average tickets per technician |
| `workload_balance` | object | Balance score analysis |
| `workload_balance.avg_balance_score` | number | Average balance score for the period |
| `workload_balance.best_day` | object | Day with highest balance score |
| `workload_balance.worst_day` | object | Day with lowest balance score |
| `distribution_trend` | array | Daily distribution data points |

#### Example Request

```bash
curl -X GET "https://api.example.com/api-analytics/technicians/workload/distribution?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer <token>"
```

---

### 5. Get Utilization Trends

Retrieves utilization trend data over a date range with configurable intervals (daily or weekly).

**Endpoint:** `GET /api-analytics/technicians/trends`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in `YYYY-MM-DD` format |
| `end_date` | string | Yes | End date in `YYYY-MM-DD` format |
| `interval` | string | No | Aggregation interval: `daily` (default) or `weekly` |

**Note:**
- Maximum 90 days for `daily` interval
- Maximum 365 days for `weekly` interval

#### Response

```json
{
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-31",
      "interval": "daily"
    },
    "data_points": [
      {
        "date": "2026-01-01",
        "label": "1 ม.ค.",
        "active_technicians": 30,
        "total_tickets_assigned": 90,
        "total_tickets_confirmed": 75,
        "utilization_rate": 60.00,
        "confirmation_rate": 83.33,
        "avg_tickets_per_technician": 3.0
      },
      {
        "date": "2026-01-02",
        "label": "2 ม.ค.",
        "active_technicians": 35,
        "total_tickets_assigned": 105,
        "total_tickets_confirmed": 90,
        "utilization_rate": 70.00,
        "confirmation_rate": 85.71,
        "avg_tickets_per_technician": 3.0
      }
    ],
    "summary": {
      "total_technicians": 50,
      "avg_active_technicians": 32.5,
      "peak_active_technicians": {
        "value": 42,
        "date": "2026-01-15"
      },
      "lowest_active_technicians": {
        "value": 20,
        "date": "2026-01-01"
      },
      "avg_utilization_rate": 65.00,
      "avg_confirmation_rate": 84.50,
      "total_tickets_period": 2500
    },
    "comparisons": {
      "utilization_change": 16.67,
      "tickets_change": 25.00,
      "trend_direction": "increasing"
    },
    "generated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `period` | object | Period and interval information |
| `data_points` | array | Time series data points |
| `data_points[].date` | string | Date (or week start date for weekly) |
| `data_points[].label` | string | Thai-formatted date label |
| `data_points[].active_technicians` | number | Active technicians for this period |
| `data_points[].total_tickets_assigned` | number | Tickets assigned |
| `data_points[].total_tickets_confirmed` | number | Tickets confirmed |
| `data_points[].utilization_rate` | number | Utilization rate percentage |
| `data_points[].confirmation_rate` | number | Confirmation rate percentage |
| `data_points[].avg_tickets_per_technician` | number | Average tickets per technician |
| `summary` | object | Summary statistics for the period |
| `summary.peak_active_technicians` | object | Highest active technician count |
| `summary.lowest_active_technicians` | object | Lowest active technician count |
| `comparisons` | object | Period-over-period comparisons |
| `comparisons.utilization_change` | number | Percentage change in utilization |
| `comparisons.tickets_change` | number | Percentage change in tickets |
| `comparisons.trend_direction` | string | Overall trend: `increasing`, `decreasing`, or `stable` |

#### Trend Direction Logic

| Change | Direction |
|--------|-----------|
| > 5% increase | `increasing` |
| > 5% decrease | `decreasing` |
| Between -5% and +5% | `stable` |

#### Example Requests

```bash
# Daily trends for January
curl -X GET "https://api.example.com/api-analytics/technicians/trends?start_date=2026-01-01&end_date=2026-01-31&interval=daily" \
  -H "Authorization: Bearer <token>"

# Weekly trends for Q1
curl -X GET "https://api.example.com/api-analytics/technicians/trends?start_date=2026-01-01&end_date=2026-03-31&interval=weekly" \
  -H "Authorization: Bearer <token>"
```

---

### 6. Get Technician Detail

Retrieves detailed analytics for a specific technician over a date range, including daily breakdown, work type distribution, and geographic coverage.

**Endpoint:** `GET /api-analytics/technicians/:id`

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Technician's employee ID |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in `YYYY-MM-DD` format |
| `end_date` | string | Yes | End date in `YYYY-MM-DD` format |

**Note:** Maximum date range is 90 days.

#### Response

```json
{
  "data": {
    "employee_id": "550e8400-e29b-41d4-a716-446655440000",
    "employee_name": "John Doe",
    "employee_code": "EMP001",
    "role_code": "technician_l2",
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-31"
    },
    "summary": {
      "total_tickets_assigned": 85,
      "total_tickets_confirmed": 80,
      "days_active": 22,
      "avg_tickets_per_day": 3.86,
      "most_common_work_type": {
        "code": "pm",
        "count": 45
      },
      "most_common_province": {
        "code": "10",
        "name": "กรุงเทพมหานคร",
        "count": 50
      }
    },
    "daily_breakdown": [
      {
        "date": "2026-01-02",
        "tickets_assigned": 4,
        "tickets_confirmed": 4,
        "is_key_employee_count": 2,
        "work_types": ["pm", "rma"]
      },
      {
        "date": "2026-01-03",
        "tickets_assigned": 3,
        "tickets_confirmed": 3,
        "is_key_employee_count": 1,
        "work_types": ["pm"]
      }
    ],
    "work_type_breakdown": [
      { "code": "pm", "name": "PM", "count": 45 },
      { "code": "rma", "name": "RMA", "count": 25 },
      { "code": "sales", "name": "Sales", "count": 15 }
    ],
    "geographic_breakdown": [
      { "province_code": "10", "province_name": "กรุงเทพมหานคร", "count": 50 },
      { "province_code": "11", "province_name": "สมุทรปราการ", "count": 20 },
      { "province_code": "12", "province_name": "นนทบุรี", "count": 15 }
    ],
    "generated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `employee_id` | string | Technician's unique identifier |
| `employee_name` | string | Full name |
| `employee_code` | string | Employee code |
| `role_code` | string | Role code |
| `period` | object | Requested date range |
| `summary` | object | Summary statistics |
| `summary.total_tickets_assigned` | number | Total tickets in the period |
| `summary.total_tickets_confirmed` | number | Confirmed tickets |
| `summary.days_active` | number | Days with assignments |
| `summary.avg_tickets_per_day` | number | Average daily ticket load |
| `summary.most_common_work_type` | object | Most frequently handled work type |
| `summary.most_common_province` | object | Most frequently visited province |
| `daily_breakdown` | array | Day-by-day breakdown |
| `work_type_breakdown` | array | Ticket counts by work type |
| `geographic_breakdown` | array | Ticket counts by province |

#### Example Request

```bash
curl -X GET "https://api.example.com/api-analytics/technicians/550e8400-e29b-41d4-a716-446655440000?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All endpoints return consistent error responses in the following format:

```json
{
  "error": "Error message in Thai"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |

### Common Error Messages

| Thai Message | English Meaning |
|--------------|-----------------|
| `กรุณาระบุวันที่ (date)` | Please specify a date |
| `กรุณาระบุ start_date และ end_date` | Please specify start_date and end_date |
| `รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)` | Invalid date format (must be YYYY-MM-DD) |
| `start_date ต้องน้อยกว่าหรือเท่ากับ end_date` | start_date must be less than or equal to end_date |
| `ช่วงเวลาต้องไม่เกิน 90 วัน` | Date range must not exceed 90 days |
| `ช่วงเวลาสำหรับ daily ต้องไม่เกิน 90 วัน` | Daily interval range must not exceed 90 days |
| `ช่วงเวลาสำหรับ weekly ต้องไม่เกิน 365 วัน` | Weekly interval range must not exceed 365 days |
| `interval ต้องเป็น "daily" หรือ "weekly"` | Interval must be "daily" or "weekly" |
| `รหัสพนักงานไม่ถูกต้อง` | Invalid employee ID |
| `ไม่พบข้อมูลช่างเทคนิค` | Technician not found |
| `ไม่พบ endpoint ที่ร้องขอ` | Requested endpoint not found |

---

## Key Concepts

### Utilization Rate

The percentage of technicians who had at least one assignment on a given date:

```
Utilization Rate = (Active Technicians / Total Technicians) x 100
```

### Confirmation Rate

The percentage of assigned tickets that were confirmed by technicians:

```
Confirmation Rate = (Confirmed Tickets / Assigned Tickets) x 100
```

### Balance Score

A score from 0-100 indicating how evenly workload is distributed among technicians. Higher scores mean more balanced distribution:

- **100** = Perfectly balanced (all technicians have equal tickets)
- **0** = Extremely unbalanced (high variance in ticket distribution)

The balance score is calculated using the coefficient of variation (CV):

```
Balance Score = (1 - CV) x 100
Where CV = Standard Deviation / Mean
```

### Workload Status

Each technician's workload is classified based on comparison to average:

- **underloaded**: Less than 50% of average
- **normal**: Between 50% and 150% of average
- **overloaded**: More than 150% of average

### Technician Roles

The API tracks technicians with the following role codes:

| Role Code | Description |
|-----------|-------------|
| `technician` | Standard Technician |
| `technician_l1` | Technician Level 1 |
| `technician_l2` | Technician Level 2 (Senior) |

### Data Sources

The analytics endpoints aggregate data from multiple sources:

| Endpoint | Primary Data Source |
|----------|---------------------|
| `/technicians/utilization` | `jct_ticket_employees` (assigned) + `jct_ticket_employees_cf` (confirmed) by assignment date |
| `/technicians/utilization/summary` | Same as above, aggregated over date range |
| `/technicians/workload` | `main_appointments` (by `appointment_date`) + `jct_ticket_employees_cf` |
| `/technicians/workload/distribution` | Same as above, with daily aggregation |
| `/technicians/trends` | `jct_ticket_employees` + `jct_ticket_employees_cf` by assignment date |
| `/technicians/:id` | Uses `get_technician_detail_data` RPC function |

### Work Type Names

Different endpoints return work type names in different formats:

| Endpoint | `work_type_name` Field |
|----------|------------------------|
| `/technicians/utilization` | Thai name (`name_th`) - e.g., "บำรุงรักษา" |
| `/technicians/workload` | English name (`name`) - e.g., "PM" |

---

## Usage Examples

### Dashboard Overview

To display a manager dashboard with key metrics:

1. Call `/technicians/utilization?date=<today>` for current day metrics
2. Call `/technicians/utilization/summary?start_date=<month_start>&end_date=<today>` for monthly summary
3. Call `/technicians/trends?start_date=<week_start>&end_date=<today>` for weekly trend chart

### Workload Balancing

To identify workload imbalances:

1. Call `/technicians/workload?date=<today>` to see current distribution
2. Check `balance_score` - scores below 70 indicate significant imbalance
3. Review `technician_workloads` array for `overloaded` and `underloaded` technicians

### Performance Tracking

To track individual technician performance:

1. Call `/technicians/<id>?start_date=<period_start>&end_date=<period_end>`
2. Compare `avg_tickets_per_day` with team average from `/technicians/utilization/summary`
3. Review `work_type_breakdown` and `geographic_breakdown` for specialization patterns

---

## Notes for Frontend Integration

1. **Date Formatting**: All dates use `YYYY-MM-DD` format in both requests and responses
2. **Thai Labels**: The `label` field in trends data is pre-formatted in Thai (e.g., "1 ม.ค.")
3. **Pagination**: These endpoints do not support pagination - all data is returned in a single response
4. **Rate Limits**: Consider caching responses for dashboard views to reduce API calls
5. **Generated Timestamp**: Use `generated_at` to display when data was last refreshed
