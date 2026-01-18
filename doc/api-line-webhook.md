# LINE Webhook API

## Overview

The LINE Webhook API receives and processes events from the LINE Messaging Platform. It enables employees to upload images and files via LINE chat, link them to service tickets, and manage file submissions. The system supports role-based features including technician file submission workflows and approver review capabilities.

### Key Features
- Receive images, files, and text messages from LINE users
- Upload files to Supabase storage automatically
- Link files to service tickets
- Technician-specific workflow with active ticket context
- File approval workflow for supervisors/approvers
- View daily assigned tickets via LINE chat

## Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-line-webhook
```

## Endpoints

### POST /

Receive LINE webhook events from the LINE Platform.

**Authentication:** LINE signature verification (not JWT)

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `x-line-signature` | Yes | HMAC-SHA256 signature of the request body using the channel secret |
| `Content-Type` | Yes | `application/json` |

**Request Body:**

```json
{
  "destination": "U1234567890abcdef",
  "events": [
    {
      "type": "message",
      "timestamp": 1704067200000,
      "source": {
        "type": "user",
        "userId": "U9876543210fedcba"
      },
      "replyToken": "reply-token-xxx",
      "webhookEventId": "event-id-xxx",
      "deliveryContext": {
        "isRedelivery": false
      },
      "message": {
        "id": "message-id-xxx",
        "type": "text",
        "text": "PDE-904"
      }
    }
  ]
}
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: text/plain

OK
```

> Note: The webhook always returns 200 OK immediately. Event processing happens asynchronously.

**Error Responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 401 | Missing signature | `x-line-signature` header not present |
| 401 | Invalid signature | Signature verification failed |
| 405 | Method not allowed | Request method is not POST |
| 500 | Internal error | Server-side processing error |

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `LINE_CHANNEL_SECRET` | LINE channel secret for webhook signature verification |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE channel access token for sending reply messages |

---

## Webhook Events

The API handles the following LINE webhook event types:

| Event Type | Description |
|------------|-------------|
| `message` | User sends a message (text, image, file, video, sticker) |
| `postback` | User taps a button or quick reply action |
| `follow` | User adds the bot as a friend |
| `unfollow` | User blocks or removes the bot |

---

## Message Events

### Image Upload

When a user sends an image, the system:
1. Downloads the image from LINE servers
2. Uploads to `staging-files` storage bucket
3. Creates a `main_staged_files` record with status `pending`
4. If technician has active ticket context, auto-links to that ticket with status `linked`

**Response (First image or single upload):**
- Flex message showing upload success with thumbnail
- Quick reply options for file management

**Response (Batch upload - multiple images within 3 seconds):**
- Silent acknowledgment (no reply to prevent spam)
- Files are stored and can be viewed with "รายการ" command

### File Upload

Same behavior as image upload, but preserves original filename.

### Video Upload

Videos are not supported. User receives:
```
ขออภัย ระบบยังไม่รองรับการอัพโหลดวิดีโอ กรุณาส่งเป็นรูปภาพหรือไฟล์แทน
```

### Sticker Message

Stickers are ignored with no response.

### Text Commands

Users can type text commands to interact with the system:

#### Ticket Code Input

| Pattern | Example | Description |
|---------|---------|-------------|
| `PDE-XXX` | `PDE-904` | Link pending files to ticket by full code |
| `XXX` (1-6 digits) | `904` | Link pending files to ticket (auto-adds PDE- prefix) |

**Behavior:**
- If files are selected, links only selected files
- If no files selected, links all pending files
- Creates `linked` status on files

#### File Management Commands

| Command (Thai) | Command (English) | Description |
|----------------|-------------------|-------------|
| `รายการ` | `list` | Show carousel of pending files |
| `ลบทั้งหมด` | `delete all` | Delete all pending files |
| `เลือกทั้งหมด` | `select all` | Select all pending files |
| `ยกเลิกเลือก` | `clear` | Clear file selection |
| `เชื่อมตั๋ว` | `link` | Show link ticket prompt |
| `เมนู` / `?` | `menu` / `help` | Show available commands (role-based) |

#### Status & Ticket Commands

| Command (Thai) | Command (English) | Description |
|----------------|-------------------|-------------|
| `รออนุมัติ` / `สถานะ` | `status` | Approvers: view all linked files pending approval (7 days) |
| `วันนี้` | `today` | View today's tickets (technicians see own, others see all) |
| `งานของฉัน` / `งานฉัน` | `my` / `mytasks` | View my assigned tickets for today |
| `เสร็จ` | `done` | Clear active ticket context (technicians only) |

---

## Postback Actions

Postback events are triggered when users tap buttons in Flex messages or quick replies.

### File Management Actions

| Action | Description | Required Data |
|--------|-------------|---------------|
| `view_files` | View pending files carousel | - |
| `view_files_page` | View specific page of files | `page` |
| `toggle_select` | Toggle file selection | `fileId` |
| `delete_file` | Delete single file | `fileId` |
| `select_all` | Select all files | - |
| `clear_selection` | Clear all selections | - |
| `delete_all` | Delete all pending files | - |

### Linked Files Actions

| Action | Description | Required Data |
|--------|-------------|---------------|
| `view_linked_files` | View files linked to tickets (own files) | - |
| `view_linked_files_page` | View specific page | `page` |
| `unlink_file` | Return file to pending status (only for `linked` status) | `fileId` |

### Ticket Actions

| Action | Description | Required Data |
|--------|-------------|---------------|
| `select_ticket` | Link file to specific ticket | `fileId`, `ticketId`, `ticketCode` |
| `submit_work` | Start submitting work to ticket (sets active ticket) | `ticketId`, `ticketCode` |
| `view_ticket_files` | View files submitted to specific ticket | `ticketId`, `ticketCode` |
| `cancel` | Cancel current action and optionally delete file | `fileId` (optional) |

### Approval Actions (Level 1+)

| Action | Description | Required Data |
|--------|-------------|---------------|
| `approve_file` | Approve a pending file | `fileId` |
| `reject_file` | Reject a pending file | `fileId` |
| `approver_files_page` | View specific page of pending files | `page` |

---

## Follow/Unfollow Events

### Follow Event

When a user adds the bot as friend:

1. **Existing linked account:** Updates profile info (display name, picture), sends welcome back message
2. **New user:** Sends welcome message with instructions to contact admin for account linking

### Unfollow Event

Logged but no action taken. Account mapping is preserved for re-follow scenario.

---

## Authorization Levels

File approval features require specific permission levels:

| Feature | Required Level |
|---------|----------------|
| Upload files | 0 (Technician) |
| View own files | 0 (Technician) |
| View all linked files for approval | 1 (Assigner/PM) |
| Approve/Reject files | 1 (Assigner/PM) |

---

## Database Tables

### main_staged_files

Stores uploaded files with workflow status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `employee_id` | uuid | Uploader employee ID |
| `ticket_id` | uuid | Linked ticket (null if pending) |
| `file_url` | text | Public URL in storage |
| `file_name` | text | Original filename |
| `file_size` | int | File size in bytes |
| `mime_type` | text | MIME type |
| `source` | text | Upload source (e.g., 'line') |
| `status` | text | `pending`, `linked`, `approved`, `rejected` |
| `metadata` | jsonb | Additional data (e.g., `selected`, `line_message_id`) |
| `approved_at` | timestamptz | Approval timestamp |
| `approved_by` | uuid | Approver employee ID |
| `rejection_reason` | text | Reason for rejection |

### child_employee_line_accounts

Links LINE users to employees.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `employee_id` | uuid | Linked employee |
| `line_user_id` | text | LINE user ID |
| `display_name` | text | LINE display name |
| `profile_picture_url` | text | LINE profile picture |
| `active_ticket_id` | uuid | Current ticket context for technicians |

---

## Workflow Examples

### Technician File Submission Flow

1. Technician types "งานของฉัน" to see assigned tickets
2. Taps "ส่งงาน" button on desired ticket
3. System sets `active_ticket_id` for the technician
4. Technician sends images - automatically linked to active ticket with status `linked`
5. Technician types "เสร็จ" when done
6. System clears active ticket context

### Standard File Upload Flow

1. User sends image(s) via LINE
2. System uploads to storage, creates pending files
3. User types ticket code (e.g., "904" or "PDE-904")
4. System links all pending files to ticket
5. Files are now in `linked` status awaiting approval

### Approver Review Flow

1. Approver types "รออนุมัติ" or "สถานะ"
2. System shows carousel of all linked files from all employees (last 7 days)
3. Approver taps "อนุมัติ" (approve) or "ปฏิเสธ" (reject) on each file
4. File status updated to `approved` or `rejected`

---

## File Status Lifecycle

```
pending --> linked --> approved
                   --> rejected
        --> (deleted)
```

| Status | Description |
|--------|-------------|
| `pending` | Uploaded, not yet linked to ticket |
| `linked` | Linked to ticket, awaiting approval |
| `approved` | Approved by supervisor |
| `rejected` | Rejected by supervisor |

---

## Supported File Types

| Type | MIME Types | Extension |
|------|------------|-----------|
| Images | image/jpeg, image/png, image/gif, image/webp | .jpg, .png, .gif, .webp |
| Documents | application/pdf | .pdf |
| Other | Any | .bin (fallback) |

---

## Rate Limiting

- LINE Platform has its own rate limits for sending messages
- Batch upload detection: Files uploaded within 3 seconds of each other are treated as batch (silent acknowledgment)
- Reply messages limited to 5 per response (LINE API limit)
- Pagination: 10 files per page in carousels

---

## Quick Reply Buttons

When pending files exist, users see quick reply options:

| Button | Action |
|--------|--------|
| ดูรายการไฟล์ | View file carousel |
| ลบล่าสุด | Delete most recent file |

---

## Error Messages

Errors during event processing are logged but do not affect the webhook response. Users receive error messages via LINE:

| Error Type | Thai Message |
|------------|--------------|
| Account not linked | บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ กรุณาติดต่อผู้ดูแลระบบ |
| Ticket not found | ไม่พบตั๋วรหัส {code} |
| No pending files | ไม่พบไฟล์ที่รอเชื่อมต่อ |
| Upload failed | ไม่สามารถอัพโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง |
| No permission | คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้ |
| Approver only | คำสั่งนี้สำหรับผู้อนุมัติเท่านั้น |

---

## Deployment

```bash
npx supabase functions deploy api-line-webhook --no-verify-jwt --project-ref ogzyihacqbasolfxymgo
```

> Note: `--no-verify-jwt` is required because LINE webhook uses its own signature verification.

---

## LINE Platform Configuration

Configure the following in LINE Developers Console:

1. **Webhook URL:** `https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-line-webhook`
2. **Use webhook:** Enabled
3. **Webhook redelivery:** Disabled (handled by code - redelivered events are skipped)

---

## Related Documentation

- [LINE Messaging API Reference](https://developers.line.biz/en/reference/messaging-api/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
