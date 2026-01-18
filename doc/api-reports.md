# API Reports Documentation

## Overview

The Reports API (`api-reports`) provides analytics and reporting capabilities for the Field Service Management system. It offers comprehensive daily analytics dashboards with week-over-week comparisons, as well as exportable Excel reports for different work types (RMA, PM, Sales).

This API is designed for management and supervisory roles who need to monitor operations, track technician assignments, and analyze service ticket distribution across regions and work types.

---

## Base URL

```
/api-reports
```

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header.

```
Authorization: Bearer <JWT_TOKEN>
```

### Required Permission Level

| Level | Role | Access |
|-------|------|--------|
| 1+ | Assigner, PM, Sales, Admin, Superadmin | Full access to all report endpoints |

Technician (Level 0) users do not have access to this API.

---

## Endpoints

### 1. Get Daily Report

Returns comprehensive analytics for a single day, including ticket summaries, geographic distribution, technician performance, appointment data, chart-ready data, and system alerts.

#### Request

```
GET /api-reports/daily?date={YYYY-MM-DD}
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | Report date in ISO format (YYYY-MM-DD) |

#### Validation Rules

- `date` parameter is required
- Format must be `YYYY-MM-DD`
- Date must be valid (parseable)
- Cannot request dates more than 3 months in the future

#### Response

```json
{
  "data": {
    "meta": {
      "report_date": "2026-01-15",
      "report_date_display": "วันพุธที่ 15 มกราคม 2569",
      "comparison_date": "2026-01-08",
      "comparison_date_display": "วันพุธที่ 8 มกราคม 2569",
      "generated_at": "2026-01-15T10:30:00.000Z"
    },
    "summary": {
      "total_tickets": 45,
      "total_tickets_prev": 38,
      "tickets_created_today": 12,
      "tickets_completed_today": 8,
      "by_status": [
        {
          "status_id": "uuid-...",
          "status_code": "pending",
          "status_name": "รอดำเนินการ",
          "count": 15,
          "count_prev": 12
        },
        {
          "status_id": "uuid-...",
          "status_code": "in_progress",
          "status_name": "กำลังดำเนินการ",
          "count": 22,
          "count_prev": 18
        },
        {
          "status_id": "uuid-...",
          "status_code": "completed",
          "status_name": "เสร็จสิ้น",
          "count": 8,
          "count_prev": 8
        }
      ],
      "by_work_type": [
        {
          "work_type_id": "uuid-...",
          "work_type_code": "pm",
          "work_type_name": "บำรุงรักษา",
          "count": 20,
          "count_prev": 15
        },
        {
          "work_type_id": "uuid-...",
          "work_type_code": "rma",
          "work_type_name": "เคลม/ซ่อม",
          "count": 15,
          "count_prev": 14
        },
        {
          "work_type_id": "uuid-...",
          "work_type_code": "sales",
          "work_type_name": "ขาย/ติดตั้ง",
          "count": 10,
          "count_prev": 9
        }
      ]
    },
    "geographic": {
      "by_region": [
        {
          "region_id": 2,
          "region_name": "ภาคกลาง",
          "count": 25,
          "count_prev": 20,
          "provinces": [
            {
              "province_code": 1,
              "province_name": "กรุงเทพมหานคร",
              "count": 15
            },
            {
              "province_code": 2,
              "province_name": "สมุทรปราการ",
              "count": 5
            }
          ]
        },
        {
          "region_id": 3,
          "region_name": "ภาคตะวันออกเฉียงเหนือ",
          "count": 10,
          "count_prev": 8,
          "provinces": [
            {
              "province_code": 19,
              "province_name": "นครราชสีมา",
              "count": 6
            }
          ]
        }
      ],
      "top_provinces": [
        {
          "province_code": 1,
          "province_name": "กรุงเทพมหานคร",
          "count": 15,
          "count_prev": 12
        },
        {
          "province_code": 19,
          "province_name": "นครราชสีมา",
          "count": 6,
          "count_prev": 5
        }
      ]
    },
    "technicians": {
      "active_count": 18,
      "active_count_prev": 15,
      "team_count": 12,
      "top_performers": [
        {
          "employee_id": "uuid-...",
          "employee_name": "สมชาย ใจดี",
          "employee_code": "EMP001",
          "tickets_assigned": 8,
          "tickets_confirmed": 6
        },
        {
          "employee_id": "uuid-...",
          "employee_name": "สมหญิง รักงาน",
          "employee_code": "EMP002",
          "tickets_assigned": 6,
          "tickets_confirmed": 5
        }
      ]
    },
    "appointments": {
      "total_approved": 35,
      "total_approved_prev": 30,
      "total_pending": 10,
      "by_type": [
        {
          "type_code": "full_day",
          "type_name": "เต็มวัน",
          "count": 15,
          "count_prev": 12
        },
        {
          "type_code": "time_range",
          "type_name": "ช่วงเวลา",
          "count": 12,
          "count_prev": 10
        },
        {
          "type_code": "half_morning",
          "type_name": "ครึ่งเช้า",
          "count": 8,
          "count_prev": 8
        }
      ],
      "time_distribution": {
        "morning": 18,
        "afternoon": 15,
        "evening": 2
      }
    },
    "charts": {
      "status_pie": [
        {
          "label": "รอดำเนินการ",
          "value": 15,
          "color": "#FFA500"
        },
        {
          "label": "กำลังดำเนินการ",
          "value": 22,
          "color": "#3B82F6"
        },
        {
          "label": "เสร็จสิ้น",
          "value": 8,
          "color": "#22C55E"
        }
      ],
      "work_type_bar": [
        {
          "label": "บำรุงรักษา",
          "current": 20,
          "previous": 15
        },
        {
          "label": "เคลม/ซ่อม",
          "current": 15,
          "previous": 14
        }
      ],
      "region_donut": [
        {
          "label": "ภาคกลาง",
          "value": 25,
          "percentage": 56,
          "color": "#3B82F6"
        },
        {
          "label": "ภาคตะวันออกเฉียงเหนือ",
          "value": 10,
          "percentage": 22,
          "color": "#F59E0B"
        }
      ],
      "week_trend": [
        {
          "date": "2026-01-09",
          "date_display": "พฤ",
          "count": 32
        },
        {
          "date": "2026-01-10",
          "date_display": "ศ",
          "count": 28
        },
        {
          "date": "2026-01-11",
          "date_display": "ส",
          "count": 10
        }
      ]
    },
    "precautions": [
      {
        "type": "warning",
        "message": "มีนัดหมายรออนุมัติ 15 รายการ",
        "metric": "pending_approval",
        "value": 15
      },
      {
        "type": "info",
        "message": "จำนวนงานเพิ่มขึ้น 58% จากสัปดาห์ก่อน",
        "metric": "week_change",
        "value": 58
      }
    ]
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `meta` | object | Report metadata including dates and generation timestamp |
| `meta.report_date` | string | The requested report date (ISO format) |
| `meta.report_date_display` | string | Thai-formatted display date (Buddhist year) |
| `meta.comparison_date` | string | Previous week date for comparison (7 days before) |
| `meta.generated_at` | string | Timestamp when report was generated |
| `summary` | object | Ticket summary statistics |
| `summary.total_tickets` | number | Total tickets with appointments on this date |
| `summary.total_tickets_prev` | number | Total tickets from comparison date |
| `summary.tickets_created_today` | number | New tickets created on this date |
| `summary.tickets_completed_today` | number | Tickets marked completed on this date |
| `summary.by_status` | array | Ticket count breakdown by status |
| `summary.by_work_type` | array | Ticket count breakdown by work type |
| `geographic` | object | Geographic distribution data |
| `geographic.by_region` | array | Ticket counts by Thai region (6 regions) |
| `geographic.top_provinces` | array | Top 10 provinces by ticket count |
| `technicians` | object | Technician performance data |
| `technicians.active_count` | number | Unique technicians assigned on this date |
| `technicians.team_count` | number | Unique technician team combinations |
| `technicians.top_performers` | array | Top 10 technicians by assignments (with confirmed counts) |
| `appointments` | object | Appointment-related statistics |
| `appointments.total_approved` | number | Count of approved appointments |
| `appointments.total_pending` | number | Count of pending approval appointments |
| `appointments.by_type` | array | Breakdown by appointment type |
| `appointments.time_distribution` | object | Distribution of appointments by time of day |
| `charts` | object | Pre-formatted data for frontend charts |
| `charts.status_pie` | array | Pie chart data for status distribution (with colors) |
| `charts.work_type_bar` | array | Bar chart data for work type comparison |
| `charts.region_donut` | array | Donut chart data for region distribution |
| `charts.week_trend` | array | Line chart data for 7-day ticket trend |
| `precautions` | array | System alerts and warnings |

#### Precaution Types

| Type | Description |
|------|-------------|
| `info` | Informational message (no action required) |
| `warning` | Warning that may require attention |
| `critical` | Critical issue requiring immediate action |

#### Precaution Trigger Conditions

| Condition | Type | Message Example |
|-----------|------|-----------------|
| No tickets for date | `info` | ไม่มีข้อมูลงานสำหรับวันที่เลือก |
| Pending approvals > 10 | `warning` | มีนัดหมายรออนุมัติ X รายการ |
| Week-over-week change > 50% | `info` | จำนวนงานเพิ่มขึ้น/ลดลง X% จากสัปดาห์ก่อน |
| Region concentration > 50% | `info` | งานกระจุกตัวใน{ภาค} X% |
| No completions with 10+ tickets | `warning` | ยังไม่มีงานที่เสร็จสิ้นในวันนี้ |

#### Time Distribution Periods

| Period | Time Range |
|--------|------------|
| `morning` | 06:00 - 12:00 |
| `afternoon` | 12:00 - 18:00 |
| `evening` | 18:00+ |

#### Example Request

```bash
curl -X GET \
  "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reports/daily?date=2026-01-15" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

### 2. Export RMA Report (Excel)

Exports RMA (Return Merchandise Authorization / warranty repair) technician assignment schedule as an Excel file.

#### Request

```
GET /api-reports/rma/excel?start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in ISO format (YYYY-MM-DD) |
| `end_date` | string | Yes | End date in ISO format (YYYY-MM-DD) |

#### Validation Rules

- Both `start_date` and `end_date` are required
- Format must be `YYYY-MM-DD`
- Both dates must be valid (parseable)
- `start_date` must not be greater than `end_date`
- Date range cannot exceed 31 days

#### Response

Returns an Excel file (`.xlsx`) as a binary download.

**Response Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="RMA_Report_2026-01-01_to_2026-01-15.xlsx"
```

#### Excel File Structure

The generated Excel file contains:

| Column | Thai Header | Description |
|--------|-------------|-------------|
| A | ลำดับ | Sequential order number |
| B | วันที่ | Appointment date (DD/M/YYYY format) |
| C | ประเภทงาน | Work description / ticket details |
| D | ชื่อบริษัท | Company name with province |
| E | ชื่อเจ้าหน้าที่ | Assigned technician names (format: K'Name + K'Name) |
| F | ทะเบียนรถ | Vehicle registration (if available) |
| G | เวลา | Appointment time (e.g., "09:00 - 12:00" or "ทั้งวัน") |
| H | Remark | Additional remarks |

**Appointment Time Display:**

| Type Code | Display |
|-----------|---------|
| `full_day` | ทั้งวัน |
| `time_range` | HH:mm - HH:mm |
| `half_morning` | ครึ่งเช้า |
| `half_afternoon` | ครึ่งบ่าย |
| `call_to_schedule` | โทรนัด |
| `backlog` | Backlog |
| `scheduled` | นัดแล้ว |

#### Example Request

```bash
curl -X GET \
  "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reports/rma/excel?start_date=2026-01-01&end_date=2026-01-15" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  --output RMA_Report.xlsx
```

---

### 3. Export PM Report (Excel)

Exports PM (Preventive Maintenance) technician assignment schedule as an Excel file.

#### Request

```
GET /api-reports/pm/excel?start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
```

#### Query Parameters

Same as RMA Excel export.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in ISO format (YYYY-MM-DD) |
| `end_date` | string | Yes | End date in ISO format (YYYY-MM-DD) |

#### Validation Rules

Same as RMA Excel export.

#### Response

Returns an Excel file (`.xlsx`) as a binary download.

**Response Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="PM_Report_2026-01-01_to_2026-01-15.xlsx"
```

The file structure is identical to the RMA report.

#### Example Request

```bash
curl -X GET \
  "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reports/pm/excel?start_date=2026-01-01&end_date=2026-01-15" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  --output PM_Report.xlsx
```

---

### 4. Export Sales Report (Excel)

Exports Sales (installation and sales) technician assignment schedule as an Excel file.

#### Request

```
GET /api-reports/sales/excel?start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
```

#### Query Parameters

Same as RMA Excel export.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date in ISO format (YYYY-MM-DD) |
| `end_date` | string | Yes | End date in ISO format (YYYY-MM-DD) |

#### Validation Rules

Same as RMA Excel export.

#### Response

Returns an Excel file (`.xlsx`) as a binary download.

**Response Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="Sales_Report_2026-01-01_to_2026-01-15.xlsx"
```

The file structure is identical to the RMA and PM reports.

#### Example Request

```bash
curl -X GET \
  "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reports/sales/excel?start_date=2026-01-01&end_date=2026-01-15" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  --output Sales_Report.xlsx
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "ข้อความข้อผิดพลาด"
}
```

### Common Error Codes

#### Validation Errors (400)

| Error Message | Cause |
|---------------|-------|
| กรุณาระบุวันที่ (date parameter) | Missing required `date` parameter (daily report) |
| รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD | Invalid date format (daily report) |
| วันที่ไม่ถูกต้อง | Invalid/unparseable date (daily report) |
| ไม่สามารถสร้างรายงานสำหรับวันที่ในอนาคตที่ไกลเกินไป | Date more than 3 months in future |
| กรุณาระบุวันที่เริ่มต้น (start_date) | Missing `start_date` for Excel exports |
| กรุณาระบุวันที่สิ้นสุด (end_date) | Missing `end_date` for Excel exports |
| รูปแบบวันที่เริ่มต้นไม่ถูกต้อง ต้องเป็น YYYY-MM-DD | Invalid start date format |
| รูปแบบวันที่สิ้นสุดไม่ถูกต้อง ต้องเป็น YYYY-MM-DD | Invalid end date format |
| วันที่เริ่มต้นไม่ถูกต้อง | Invalid/unparseable start date |
| วันที่สิ้นสุดไม่ถูกต้อง | Invalid/unparseable end date |
| วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด | start_date > end_date |
| ช่วงวันที่ต้องไม่เกิน 31 วัน | Date range exceeds 31 days |

#### Authentication/Authorization Errors

| HTTP Status | Error Message | Cause |
|-------------|---------------|-------|
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | ไม่มีสิทธิ์เข้าถึง | User permission level too low (Level 0) |

#### Not Found Errors (404)

| Error Message | Cause |
|---------------|-------|
| ไม่พบ endpoint ที่ร้องขอ | Invalid endpoint path |
| ไม่พบประเภทงาน {type} ในระบบ | Work type not found in database (e.g., RMA, PM, Sales) |

#### Database Errors (500)

| Error Message | Cause |
|---------------|-------|
| ไม่สามารถดึงข้อมูลตั๋วงานได้ | Database error fetching tickets |
| ไม่สามารถดึงข้อมูลสถานะได้ | Database error fetching statuses |
| ไม่สามารถดึงข้อมูลประเภทงานได้ | Database error fetching work types |
| ไม่สามารถดึงข้อมูลแนวโน้มได้ | Database error fetching week trend data |
| ไม่สามารถนับตั๋วงานที่สร้างได้ | Database error counting created tickets |
| ไม่สามารถนับตั๋วงานที่เสร็จสิ้นได้ | Database error counting completed tickets |
| ไม่สามารถดึงข้อมูลช่างที่ได้รับมอบหมายได้ | Database error fetching assigned technicians |
| ไม่สามารถดึงข้อมูลช่างที่ยืนยันแล้วได้ | Database error fetching confirmed technicians |

---

## Comparison Data

The Daily Report includes week-over-week comparison data. The comparison date is automatically calculated as 7 days before the requested report date.

For each metric, the response includes:
- Current value (e.g., `count`)
- Previous week value (e.g., `count_prev`)

This enables frontend developers to display:
- Trend indicators (up/down arrows)
- Percentage change calculations
- Week-over-week comparison charts

---

## Chart Data Colors

The API provides pre-defined hex colors for consistent frontend rendering:

### Status Colors

| Status Code | Color | Hex |
|-------------|-------|-----|
| pending | Orange | #FFA500 |
| in_progress | Blue | #3B82F6 |
| completed | Green | #22C55E |
| cancelled | Red | #EF4444 |
| on_hold | Gray | #9CA3AF |

### Work Type Colors

| Work Type Code | Color | Hex |
|----------------|-------|-----|
| pm | Purple | #8B5CF6 |
| rma | Pink | #EC4899 |
| sales | Teal | #14B8A6 |
| account | Amber | #F59E0B |
| ags_battery | Indigo | #6366F1 |
| survey | Emerald | #10B981 |
| pickup | Orange | #F97316 |
| start_up | Cyan | #06B6D4 |

### Region Colors

| Region ID | Region Name | Color | Hex |
|-----------|-------------|-------|-----|
| 1 | ภาคเหนือ | Green | #10B981 |
| 2 | ภาคกลาง | Blue | #3B82F6 |
| 3 | ภาคตะวันออกเฉียงเหนือ | Amber | #F59E0B |
| 4 | ภาคตะวันตก | Pink | #EC4899 |
| 5 | ภาคตะวันออก | Purple | #8B5CF6 |
| 6 | ภาคใต้ | Cyan | #06B6D4 |

---

## Thai Date Formatting

The API formats dates in Thai Buddhist Era (BE = CE + 543).

Example: `2026-01-15` becomes `วันพุธที่ 15 มกราคม 2569`

### Day Names

| Number | Thai Day |
|--------|----------|
| 0 | อาทิตย์ |
| 1 | จันทร์ |
| 2 | อังคาร |
| 3 | พุธ |
| 4 | พฤหัสบดี |
| 5 | ศุกร์ |
| 6 | เสาร์ |

### Day Abbreviations (for charts)

| Number | Abbreviation |
|--------|--------------|
| 0 | อา |
| 1 | จ |
| 2 | อ |
| 3 | พ |
| 4 | พฤ |
| 5 | ศ |
| 6 | ส |

---

## Usage Notes

### Performance Considerations

1. **Daily Report Caching**: The daily report fetches data in parallel for optimal performance. For frequently accessed dates, consider implementing client-side caching.

2. **Excel Export Limits**: Excel exports are limited to 31-day ranges to prevent excessive data processing and memory usage.

3. **Province Data**: Province and region data is embedded in the service for faster lookups without additional database queries.

### Frontend Integration Tips

1. **Chart Libraries**: The `charts` object in the daily report response is pre-formatted for common chart libraries (Chart.js, Recharts, etc.). Use the provided colors for consistent styling.

2. **Precautions Display**: Display precautions as notification banners or alerts. Use the `type` field to determine severity styling (info = blue, warning = yellow, critical = red).

3. **Excel Downloads**: For Excel file downloads in the browser:
   ```javascript
   const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
   const blob = await response.blob();
   const downloadUrl = window.URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.href = downloadUrl;
   link.download = 'Report.xlsx';
   link.click();
   ```

4. **Week Trend Chart**: The `week_trend` array always contains 7 days ending on the report date. Days with no tickets show `count: 0`.

---

## Related APIs

- **api-tickets**: Manage and query individual tickets
- **api-appointments**: Manage appointment scheduling
- **api-employees**: Access technician/employee data

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.1 | 2026-01-18 | Added backlog and scheduled appointment types; documented precaution trigger conditions |
| 1.0.0 | 2026-01-15 | Initial documentation |
