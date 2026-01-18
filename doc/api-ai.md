# API AI - AI Assistant Edge Function

## Overview

The `api-ai` Edge Function provides an AI-powered assistant called **"Peacey" (เพซซี่)** for the PDE Service platform. Built on OpenAI GPT-4 models, this assistant helps employees manage field service operations including tickets, appointments, customer lookup, and workforce scheduling.

### Key Features

- **Streaming Responses (SSE)** - Real-time text streaming like ChatGPT
- **Context Compression** - Smart memory management with entity extraction (RAG-like)
- **Session Persistence** - Conversation history stored in database
- **Tool Calling** - 15 integrated tools for system operations
- **File Processing** - Support for images, PDF, and Excel attachments
- **User Confirmation** - Safety checks before data modifications
- **Intelligent Model Routing** - Auto-selects GPT-4o-mini or GPT-4o based on task complexity
- **Tone Detection** - Adaptive responses for playful, urgent, or neutral conversations

---

## Base URL

```
/api-ai
```

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header.

```
Authorization: Bearer <JWT_TOKEN>
```

**Required Permission Level:** Level 0+ (All authenticated employees)

---

## Endpoints

### 1. Ask Assistant (Streaming)

**`POST /api-ai/assistant/stream`**

Send a message to the AI assistant and receive a streaming Server-Sent Events (SSE) response.

#### Request Body

```json
{
  "query": "string (required)",
  "context": {
    "page": {
      "route": "string",
      "type": "string",
      "title": "string"
    },
    "user": {
      "id": "string",
      "role": "string",
      "department": "string",
      "permissions": ["string"]
    },
    "data": {},
    "ui": {},
    "timestamp": "ISO 8601 string"
  },
  "sessionId": "string (optional)",
  "conversationHistory": [],
  "entityMemory": "string (optional)",
  "files": [
    {
      "data": "base64 encoded string",
      "mimeType": "string",
      "filename": "string"
    }
  ],
  "confirmedTools": [
    {
      "name": "string",
      "arguments": {}
    }
  ],
  "skipToolConfirmation": false
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The user's question or command |
| `context` | object | Yes | Current page and user context |
| `sessionId` | string | No | Resume a specific session (auto-creates if not provided) |
| `conversationHistory` | array | No | Previous messages for context (fallback if session has no messages) |
| `entityMemory` | string | No | Serialized entity memory from frontend (for backward compatibility) |
| `files` | array | No | File attachments (images, PDF, Excel) |
| `confirmedTools` | array | No | Pre-confirmed tools to execute immediately |
| `skipToolConfirmation` | boolean | No | Skip confirmation prompts (default: false) |

#### Supported File Types

| Type | MIME Types | Max Size |
|------|------------|----------|
| Images | `image/png`, `image/jpeg`, `image/gif`, `image/webp` | 20MB |
| PDF | `application/pdf` | 10MB |
| Excel | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv` | 5MB |

#### SSE Response Events

```javascript
// Session established
data: {"type":"session","sessionId":"uuid"}

// Model selection
data: {"type":"model","tier":"mini|standard","model":"gpt-4o-mini|gpt-4o"}

// File processing status
data: {"type":"file_processing","filename":"document.pdf","status":"start|done","fileType":"document"}

// Text streaming (word by word)
data: {"type":"text","content":"partial text..."}

// Tool execution start
data: {"type":"tool_start","tool":"search_tickets","description":"ค้นหาตั๋วงาน..."}

// Tool execution complete
data: {"type":"tool_end","tool":"search_tickets","success":true,"result":{...}}

// Tool confirmation required
data: {"type":"tool_confirmation","tools":[{"name":"create_ticket","description":"สร้างตั๋วงาน PM","arguments":{...},"schema":{}}],"assistantMessage":"optional message"}

// Stream complete
data: {"type":"done","sessionId":"uuid","entityMemory":"json","usage":{"inputTokens":500,"outputTokens":200},"contextStats":{"compressionRatio":45,"entitiesTracked":12,"filesProcessed":0},"awaitingConfirmation":false}

// Error
data: {"type":"error","message":"Error description"}
```

#### Example Request

```bash
curl -X POST /api-ai/assistant/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "งานวันนี้มีกี่งาน",
    "context": {
      "page": {"route": "/dashboard", "type": "dashboard", "title": "Dashboard"},
      "user": {"id": "uuid", "role": "assigner", "department": "service", "permissions": []},
      "timestamp": "2025-01-15T10:00:00Z"
    }
  }'
```

---

### 2. Ask Assistant (Non-Streaming)

**`POST /api-ai/assistant`**

Send a message and receive a complete JSON response (not recommended for long responses).

Also accessible via:
- **`POST /api-ai`** (root path)

#### Request Body

```json
{
  "query": "string (required)",
  "context": {
    "page": {
      "route": "string",
      "type": "string",
      "title": "string"
    },
    "user": {
      "id": "string",
      "role": "string",
      "department": "string",
      "permissions": ["string"]
    },
    "data": {},
    "ui": {},
    "timestamp": "ISO 8601 string"
  },
  "sessionId": "string (optional)",
  "conversationHistory": [],
  "entityMemory": "string (optional)"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The user's question or command |
| `context` | object | Yes | Current page and user context |
| `sessionId` | string | No | Resume a specific session |
| `conversationHistory` | array | No | Previous messages for context |
| `entityMemory` | string | No | Serialized entity memory from frontend |

#### Response

```json
{
  "data": {
    "response": {
      "message": "วันนี้มี 15 งาน แบ่งเป็น PM 8 งาน, RMA 5 งาน, Sales 2 งาน",
      "confidence": 0.85,
      "suggestions": [],
      "actions": [
        {
          "type": "get_ticket_summary",
          "description": "ดึงสรุปตั๋วงานวันที่ 2025-01-15",
          "result": {...}
        }
      ]
    },
    "model": {
      "tier": "standard",
      "name": "gpt-4o"
    },
    "usage": {
      "inputTokens": 1200,
      "outputTokens": 350
    },
    "entityMemory": "{...}",
    "sessionId": "uuid",
    "contextStats": {
      "originalTokens": 5000,
      "compressedTokens": 2500,
      "compressionRatio": 50,
      "entitiesTracked": 8
    }
  }
}
```

---

### 3. List Sessions

**`GET /api-ai/sessions`**

Get a list of all conversation sessions for the current user.

#### Response

```json
{
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "title": "งานวันนี้มีกี่งาน",
        "message_count": 12,
        "last_message_at": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### 4. Get Session Details

**`GET /api-ai/sessions/:id`**

Get details of a specific session including entity memory.

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Session UUID |

#### Response

```json
{
  "data": {
    "session": {
      "id": "uuid",
      "employee_id": "uuid",
      "entity_memory": {
        "sites": {...},
        "companies": {...},
        "employees": {...},
        "tickets": {...}
      },
      "conversation_summary": {
        "topics": ["ตั๋วงาน", "ลูกค้า"],
        "actions": ["ค้นหาข้อมูล"],
        "recentSummaries": ["Q: งานวันนี้ | Tools: get_ticket_summary | A: วันนี้มี 15 งาน"]
      },
      "recent_messages": [...],
      "title": "งานวันนี้มีกี่งาน",
      "message_count": 12,
      "total_input_tokens": 5000,
      "total_output_tokens": 1500,
      "created_at": "2025-01-15T09:00:00Z",
      "updated_at": "2025-01-15T10:30:00Z",
      "last_message_at": "2025-01-15T10:30:00Z"
    }
  }
}
```

---

### 5. Create New Session

**`POST /api-ai/sessions`**

Force create a new conversation session (doesn't reuse recent sessions).

#### Response

```json
{
  "data": {
    "session": {
      "id": "uuid",
      "employee_id": "uuid",
      "entity_memory": {},
      "conversation_summary": {},
      "recent_messages": [],
      "title": null,
      "message_count": 0,
      "created_at": "2025-01-15T11:00:00Z"
    }
  }
}
```

---

### 6. Get Session Messages

**`GET /api-ai/sessions/:id/messages`**

Retrieve the full message history for a session.

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Session UUID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Maximum messages to return (max: 500) |
| `offset` | number | 0 | Skip first N messages |
| `after` | number | - | Get messages after this sequence number |
| `recent` | boolean | false | If true, get last N messages only |

#### Response

```json
{
  "data": {
    "sessionId": "uuid",
    "messages": [
      {
        "id": "uuid",
        "session_id": "uuid",
        "sequence_number": 1,
        "role": "user",
        "content": "งานวันนี้มีกี่งาน",
        "created_at": "2025-01-15T09:00:00Z"
      },
      {
        "id": "uuid",
        "session_id": "uuid",
        "sequence_number": 2,
        "role": "assistant",
        "content": "วันนี้มี 15 งาน...",
        "tool_calls": [...],
        "input_tokens": 500,
        "output_tokens": 200,
        "created_at": "2025-01-15T09:00:05Z"
      }
    ],
    "count": 2
  }
}
```

---

### 7. Delete Session

**`DELETE /api-ai/sessions/:id`**

Delete a specific session and all its messages.

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Session UUID |

#### Response

```json
{
  "data": {
    "deleted": true
  }
}
```

---

### 8. Clear All Sessions

**`DELETE /api-ai/sessions`**

Delete all sessions for the current user.

#### Response

```json
{
  "data": {
    "deleted": true,
    "count": 5
  }
}
```

---

## Available AI Tools

The AI assistant can use the following tools to interact with the system:

### Search & Lookup

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_sites` | Search customer sites/locations by name, address, or company name | `query` (required), `company_id`, `limit` |
| `search_companies` | Search companies by name or tax ID | `query` (required), `limit` |
| `search_employees` | Search employees/technicians by name, nickname, or email | `query`, `role_code`, `role_id`, `department_id`, `is_active`, `limit` |
| `search_locations` | Search provinces/districts/subdistricts | `query`, `type` (province/district/subdistrict), `province_code`, `district_code`, `limit` |
| `get_reference_data` | Get reference data (work_types, statuses, work_givers) | `type` (required) |
| `web_search` | Search the internet for general info | `query` (required) |

### Ticket Operations

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_ticket` | Create a new work ticket | `work_type_code` (required), `status_code`, `site_id`, `site_name`, `company_tax_id`, `company_name`, `details`, `contact_name`, `contact_phone`, `appointment_date`, `employee_ids` |
| `search_tickets` | Search work tickets with filters | `query`, `work_type_code`, `status_code`, `date`, `start_date`, `end_date`, `date_type`, `employee_id`, `site_id`, `province_code`, `limit` |
| `get_ticket_summary` | Get ticket count summary by type | `date`, `start_date`, `end_date`, `date_type`, `employee_id` |
| `get_ticket_details` | Get full ticket details with attachments, comments, and audit log | `ticket_id` (required), `include_attachments`, `include_comments`, `include_audit_log`, `comments_limit`, `audit_limit` |
| `get_ticket_summary_by_location` | Summary by province | `date`, `start_date`, `end_date`, `date_type`, `work_type_code` |
| `review_ticket_safety` | Check safety requirements for a ticket | `ticket_id` (required) |

### Workforce & Planning

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_available_employees` | Get technicians with no assignments on a date | `date` (required), `role_code`, `department_id` |
| `suggest_routes` | Route optimization suggestions | `date` (required), `max_tickets_per_route`, `include_assigned` |

### Product Recommendations

| Tool | Description | Parameters |
|------|-------------|------------|
| `recommend_apc_ups` | Recommend APC UPS models | `power_load_va`, `power_load_watts`, `runtime_minutes`, `use_case`, `form_factor`, `topology`, `phase`, `budget_thb`, `features`, `equipment_details` |

---

## Work Type Codes

| Code | Name (EN) | Name (TH) |
|------|-----------|-----------|
| `pm` | Preventive Maintenance | บำรุงรักษาเชิงป้องกัน |
| `rma` | Return Merchandise Authorization | ซ่อม/เคลม |
| `sales` | Sales | ขาย/ติดตั้ง |
| `survey` | Survey | สำรวจ |
| `start_up` | Start UP | เริ่มระบบ |
| `pickup` | Package | รับ-ส่งเครื่อง |
| `account` | Account | วางบิล/เก็บเงิน |
| `ags_battery` | AGS Battery | แบตเตอรี่ AGS |

---

## Model Routing

The assistant automatically routes queries to the appropriate model based on complexity:

| Tier | Model | Use Cases | Max Tokens | Temperature |
|------|-------|-----------|------------|-------------|
| `mini` | gpt-4o-mini | Greetings, confirmations, simple lookups (< 20 chars) | 2000 | 0.3 |
| `standard` | gpt-4o | Summaries, reports, analysis, multi-step tasks | 8192 | 0.5 |
| `reasoning` | gpt-4o* | Planning, calculations, comparisons (*future: o3-mini) | 8192 | 0.2 |

### Routing Logic

- **Pattern-based**: Matches known patterns for simple/complex/reasoning tasks
- **Context-upgrade**: Upgrades to standard if conversation has multiple entities
- **Summary-task**: Forces standard for summary-related queries

---

## Tone Detection

The AI detects user tone and adapts its response style:

| Tone | Detection | Response Style |
|------|-----------|----------------|
| `playful` | Emojis, "555", casual greetings, questions about AI | Playful/teasing responses with emojis |
| `urgent` | "ด่วน", "เร่ง", "ทันที", "urgent", "asap" | Direct, concise responses |
| `neutral` | Default | Professional, helpful responses |

---

## Context Compression

The AI uses intelligent context compression to maintain long conversations efficiently:

1. **Recent Messages** - Last 3 turns kept in full
2. **Entity Memory** - Extracted sites, companies, employees, tickets stored compactly
3. **Conversation Summary** - Older turns summarized into compact format
4. **Session Persistence** - Up to 10 sessions per user, auto-cleanup

### Compression Stats

The `contextStats` in responses includes:
- `compressionRatio`: Percentage of tokens saved through compression
- `entitiesTracked`: Total entities (sites + companies + employees + tickets) in memory
- `filesProcessed`: Number of file attachments processed

---

## Error Responses

```json
{
  "error": "Error message in Thai"
}
```

| Status | Description |
|--------|-------------|
| 400 | Invalid request (missing query) |
| 401 | Unauthorized (invalid/missing token) |
| 404 | Endpoint not found / Session not found |
| 500 | Server error (AI service not configured) |

---

## Session Management

- **Auto-Resume**: Sessions within 30 minutes are automatically continued
- **Max Sessions**: 10 sessions per user (oldest auto-deleted)
- **Message Persistence**: Full message history stored in `child_ai_messages` table
- **Entity Memory**: Key entities (IDs, names) extracted and stored for context
- **Recent Messages**: Last 4 turns (8 messages) cached in session for quick retrieval

---

## Tool Confirmation

For safety, the AI requests user confirmation before executing data-modifying operations:

1. AI proposes tool execution with `tool_confirmation` event
2. Frontend displays confirmation UI with tool details and schema
3. User confirms or modifies parameters
4. Frontend sends new request with `confirmedTools` array and `skipToolConfirmation: true`

Tools requiring confirmation:
- `create_ticket` - Creating new work tickets

---

## Example Conversation Flow

```
User: "งานวันนี้มีกี่งาน"
↓
AI: [Uses get_ticket_summary tool]
AI: "วันนี้มี 15 งาน แบ่งเป็น:
     - PM: 8 งาน
     - RMA: 5 งาน
     - Sales: 2 งาน"
↓
User: "ช่างว่างมีใครบ้าง"
↓
AI: [Uses get_available_employees tool]
AI: "วันนี้มีช่างว่าง 3 คน: สมชาย, สมหญิง, สมศักดิ์"
↓
User: "สร้างงาน PM ที่ SCB สาขาสยาม มอบหมายให้สมชาย"
↓
AI: [Proposes create_ticket - awaits confirmation]
AI: "ยืนยันการสร้างงาน:
     - ประเภท: PM
     - สถานที่: SCB สาขาสยาม
     - ช่าง: สมชาย
     ต้องการดำเนินการหรือไม่?"
↓
User: "ยืนยัน"
↓
AI: [Executes create_ticket]
AI: "สร้างตั๋วงานเรียบร้อยแล้ว หมายเลข: TK-2025-0001"
```

---

## Rate Limits

- **Sessions**: Max 10 sessions per user
- **Messages per session**: Unlimited (compressed automatically)
- **File attachments**: 5 files per request
- **Token usage**: Tracked per session for analytics
- **Tool iterations**: Max 5 iterations per request

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o-mini and GPT-4o |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `main_ai_sessions` | Chat session metadata |
| `child_ai_messages` | Chat message history |

---

## Related Documentation

- [API Tickets](/doc/api-tickets.md) - Ticket management API
- [API Employees](/doc/api-employees.md) - Employee management API
- [API Sites](/doc/api-sites.md) - Site/customer management API
