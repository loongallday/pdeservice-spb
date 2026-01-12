# Ticket Backfill Summaries API

## Overview

The backfill summaries endpoint regenerates AI summaries for existing tickets. It processes tickets asynchronously in the background and returns immediately with a job ID for tracking progress.

## Endpoint

```
POST /api-tickets/backfill-summaries
```

**Authentication Required:** Yes (Admin level 2+)

---

## Request

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Maximum tickets to process (max: 500) |
| `forceRefresh` | boolean | false | Regenerate even if summary already exists |
| `ticketIds` | string[] | - | Specific ticket IDs or codes to process (supports both UUID and PDE-123 format) |

### Examples

**Process tickets without summaries (default):**
```json
{}
```

**Process specific tickets by UUID:**
```json
{
  "ticketIds": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]
}
```

**Process specific tickets by ticket code:**
```json
{
  "ticketIds": ["PDE-1", "PDE-42", "PDE-123"]
}
```

**Mix of UUIDs and ticket codes:**
```json
{
  "ticketIds": ["PDE-42", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "PDE-100"]
}
```

**Force refresh all recent tickets:**
```json
{
  "limit": 100,
  "forceRefresh": true
}
```

---

## Response

### Success Response (Job Started)

```json
{
  "data": {
    "message": "เริ่มประมวลผล 50 ตั๋วงานในพื้นหลัง",
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "total": 50,
    "status_url": "/api-tickets/backfill-summaries?job_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### No Tickets to Process

```json
{
  "data": {
    "message": "ไม่พบตั๋วงานที่ต้องสร้าง summary",
    "job_id": null,
    "total": 0
  }
}
```

---

## Check Job Status

```
GET /api-tickets/backfill-summaries?job_id=<job_id>
```

### Status Response

```json
{
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "running",
    "startedAt": "2026-01-11T10:30:00.000Z",
    "completedAt": null,
    "processed": 25,
    "succeeded": 20,
    "failed": 2,
    "skipped": 3,
    "total": 50,
    "errors": [
      "ticket-uuid-1: ไม่พบข้อมูลตั๋ว",
      "ticket-uuid-2: OpenAI API error"
    ]
  }
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `running` | Job is still processing tickets |
| `completed` | All tickets have been processed |
| `failed` | Job encountered a fatal error |

### Result Counters

| Counter | Description |
|---------|-------------|
| `processed` | Total tickets attempted |
| `succeeded` | Summaries generated successfully |
| `failed` | Errors during processing |
| `skipped` | Skipped (already has summary or insufficient data) |

---

## Summary Generation Details

### Data Collected for Each Ticket

The backfill process fetches **ALL** ticket-related data:

| Category | Fields Collected |
|----------|-----------------|
| **Ticket Core** | id, details, additional, created_at, updated_at |
| **Work Type** | name, code |
| **Status** | name, code |
| **Assigner** | name, nickname |
| **Company** | name_th, name_en, tax_id |
| **Site** | name, address_detail, map_url |
| **Location** | province_name, district_name, subdistrict_name, postal_code |
| **Contact** | person_name, nickname, phone[], email[], line_id, note |
| **Appointment** | date, time_start, time_end, type, is_approved |
| **Employees** | All assigned technicians with key_employee flag |
| **Confirmed Employees** | All confirmed technicians |
| **Merchandise** | serial_no, model_name, brand, capacity (for each item) |
| **Work Giver** | name |

### AI Summary Format

The AI generates a concise summary (max 300 characters) that includes:

- Work type (PM/RMA/Sales/Survey etc.)
- Equipment details (brand, model, serial number)
- Location (site name, district)
- Appointment date/time
- Assigned technicians
- Problem description
- Contact info

**Example outputs:**

```
PM UPS APC SRT3000 S/N:AS123456 @ ธ.กสิกร สาขาสยาม นัด 15 ม.ค. 09:00 ช่างสมชาย/สมหญิง ติดต่อคุณมานี 081-xxx-xxxx
```

```
RMA เปลี่ยนแบตเตอรี่ Emerson 10kVA @ โรงแรมแกรนด์ สุขุมวิท แจ้งไฟแดงกระพริบ+เสียงเตือน นัดนำแบตใหม่ 20 ม.ค. บ่าย
```

---

## Usage Examples

### cURL

**Start backfill job:**
```bash
curl -X POST \
  'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-tickets/backfill-summaries' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"limit": 100}'
```

**Check job status:**
```bash
curl -X GET \
  'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-tickets/backfill-summaries?job_id=YOUR_JOB_ID' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### JavaScript/TypeScript

```typescript
// Start backfill
const startResponse = await fetch(
  `${SUPABASE_URL}/functions/v1/api-tickets/backfill-summaries`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: 100,
      forceRefresh: false,
    }),
  }
);

const { data } = await startResponse.json();
const jobId = data.job_id;

// Poll for status
const checkStatus = async () => {
  const statusResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/api-tickets/backfill-summaries?job_id=${jobId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const { data: status } = await statusResponse.json();

  if (status.status === 'completed') {
    console.log(`Done! Succeeded: ${status.succeeded}, Failed: ${status.failed}`);
  } else {
    console.log(`Progress: ${status.processed}/${status.total}`);
    setTimeout(checkStatus, 2000); // Check again in 2 seconds
  }
};

checkStatus();
```

---

## Error Handling

### Common Errors

| Error | Description |
|-------|-------------|
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | User does not have admin level (2+) |
| `404 Not Found` | Job ID not found (for status check) |
| `500 Internal Server Error` | Database or OpenAI API error |

### Per-Ticket Errors

Errors for individual tickets are collected in the `errors` array:

```json
{
  "errors": [
    "uuid-1: ไม่พบข้อมูลตั๋ว",
    "uuid-2: OpenAI API error: 429 rate limit",
    "uuid-3: อัพเดทไม่สำเร็จ: Database connection timeout"
  ]
}
```

---

## Notes

1. **Background Processing**: The endpoint returns immediately. Processing continues even if the client disconnects.

2. **Rate Limiting**: OpenAI API has rate limits. Large batches may experience some failures due to rate limiting.

3. **Idempotency**: Running multiple times is safe. Tickets with existing summaries are skipped (unless `forceRefresh: true`).

4. **Memory**: Job status is stored in memory. If the edge function restarts, job history is lost.

5. **Recommended Batch Size**: Start with 50-100 tickets. Monitor for rate limit errors before increasing.

6. **OpenAI Model**: Uses `gpt-4o-mini` for cost efficiency (~$0.15 per 1M input tokens).
