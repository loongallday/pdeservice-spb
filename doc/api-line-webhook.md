# API LINE Webhook - LINE Bot Integration

## Overview

Edge Function ที่รับ webhook จาก LINE Platform สำหรับให้ช่างเทคนิคส่งรูปภาพ/ไฟล์ผ่าน LINE แล้วเชื่อมต่อกับตั๋วงาน

## Workflow

```
1. ช่างเทคนิคส่งรูป/ไฟล์ผ่าน LINE
2. Bot อัพโหลดไฟล์ไป staging bucket
3. Bot ส่ง carousel ให้เลือกตั๋วงาน
4. ช่างเทคนิคเลือกตั๋ว → ไฟล์เชื่อมกับตั๋ว (status: linked)
5. ผู้อนุมัติอนุมัติใน web app → สร้าง comment บนตั๋ว
```

---

## Setup Guide

### 1. LINE Developers Console

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง **Provider** (ถ้ายังไม่มี)
3. สร้าง **Messaging API Channel**

### 2. Get Credentials

| Credential | Location | Description |
|------------|----------|-------------|
| Channel ID | Basic settings | ใช้ระบุ channel |
| Channel Secret | Basic settings | ใช้ verify webhook signature |
| Channel Access Token | Messaging API > Issue | ใช้เรียก LINE API |

### 3. Configure Webhook

ใน **Messaging API** tab:

| Setting | Value |
|---------|-------|
| Webhook URL | `https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-line-webhook` |
| Use webhook | Enabled |
| Webhook redelivery | Disabled (recommended) |
| Auto-reply messages | Disabled |
| Greeting messages | Disabled |

### 4. Set Environment Variables

ใน Supabase Dashboard > Settings > Edge Functions > Secrets:

```
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
```

หรือใช้ CLI:
```bash
npx supabase secrets set LINE_CHANNEL_SECRET=your_channel_secret
npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
```

---

## Webhook Endpoint

```
POST https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-line-webhook
```

### Headers

| Header | Description |
|--------|-------------|
| `x-line-signature` | HMAC-SHA256 signature for verification |
| `Content-Type` | `application/json` |

### Signature Verification

```
signature = Base64(HMAC-SHA256(channel_secret, request_body))
```

---

## Supported Events

### Message Events

| Type | Action |
|------|--------|
| `image` | อัพโหลดรูปไป staging → ส่ง carousel เลือกตั๋ว |
| `file` | อัพโหลดไฟล์ไป staging → ส่ง carousel เลือกตั๋ว |
| `video` | แจ้งว่าไม่รองรับ |
| `text` | แนะนำให้ส่งรูปหรือไฟล์ |
| `sticker` | ไม่ตอบ |

### Postback Events

| Action | Description |
|--------|-------------|
| `select_ticket` | เชื่อมไฟล์กับตั๋วที่เลือก |
| `cancel` | ยกเลิกและลบไฟล์ |

### Follow/Unfollow Events

| Event | Action |
|-------|--------|
| `follow` | ส่งข้อความต้อนรับ + คำแนะนำการใช้งาน |
| `unfollow` | Log เท่านั้น (ไม่ลบ mapping) |

---

## User Flow

### 1. ส่งรูปภาพ

```
User → ส่งรูปภาพ
Bot  → "✅ อัพโหลดสำเร็จ"
       + Carousel ตั๋วงาน
```

### 2. เลือกตั๋ว

```
User → กดปุ่ม "เลือกตั๋วนี้"
Bot  → "✅ เชื่อมต่อสำเร็จ
        ไฟล์: photo.jpg
        ตั๋ว: TK-2601-0001

        รอผู้อนุมัติตรวจสอบและอนุมัติ"
```

### 3. ไม่มีตั๋วงาน

```
User → ส่งรูปภาพ
Bot  → "❌ ไม่พบตั๋วงาน
        คุณไม่มีตั๋วงานที่กำลังดำเนินการ
        ไฟล์จะถูกเก็บไว้ 30 วัน"
```

### 4. บัญชียังไม่เชื่อมต่อ

```
User → ส่งรูปภาพ
Bot  → "❌ ไม่พบบัญชี
        บัญชี LINE ของคุณยังไม่ได้เชื่อมต่อกับระบบ
        กรุณาติดต่อผู้ดูแลระบบ"
```

---

## Flex Message Examples

### Ticket Carousel

```json
{
  "type": "carousel",
  "contents": [
    {
      "type": "bubble",
      "size": "kilo",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "TK-2601-0001", "weight": "bold", "color": "#1DB446" }
        ]
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "ซ่อมเครื่อง UPS", "weight": "bold", "wrap": true },
          { "type": "text", "text": "บริษัท ABC จำกัด", "size": "xs", "color": "#666666" },
          { "type": "text", "text": "📅 2026-01-15", "size": "xs", "color": "#888888" }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "เลือกตั๋วนี้",
              "data": "{\"action\":\"select_ticket\",\"fileId\":\"...\",\"ticketId\":\"...\"}"
            },
            "style": "primary",
            "color": "#1DB446"
          }
        ]
      }
    }
  ]
}
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Invalid signature | HTTP 401 |
| Missing LINE account | Flex: "ไม่พบบัญชี" |
| No active tickets | Flex: "ไม่พบตั๋วงาน" |
| Upload failed | Flex: "เกิดข้อผิดพลาด" |
| File already linked | Flex: "ไฟล์ถูกใช้แล้ว" |

---

## Files Structure

```
supabase/functions/api-line-webhook/
├── index.ts                 # Main webhook handler
├── types.ts                 # TypeScript types
├── utils/
│   └── signature.ts         # Signature verification
├── services/
│   └── lineApiService.ts    # LINE API calls
└── handlers/
    ├── messageHandler.ts    # Handle message events
    ├── postbackHandler.ts   # Handle postback events
    └── followHandler.ts     # Handle follow/unfollow
```

---

## LINE Account Management

ผู้ดูแลระบบต้องเชื่อมต่อบัญชี LINE กับพนักงานก่อนใช้งาน:

```
POST /api-staging/line-accounts
Authorization: Bearer {JWT}

{
  "employee_id": "uuid",
  "line_user_id": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "display_name": "ชื่อใน LINE"
}
```

---

## Debugging

### Check Logs

```bash
# View Edge Function logs
npx supabase functions logs api-line-webhook --project-ref ogzyihacqbasolfxymgo
```

### Test Webhook Locally

```bash
# Start local function
supabase functions serve api-line-webhook --env-file .env.local

# Use ngrok to expose local endpoint
ngrok http 54321
```

### Verify Signature Manually

```bash
echo -n '{"events":[]}' | openssl dgst -sha256 -hmac 'YOUR_CHANNEL_SECRET' -binary | base64
```

---

## Security Notes

1. **Signature Verification**: ทุก request ต้องผ่านการ verify signature
2. **Channel Secret**: เก็บเป็น secret ใน Supabase
3. **Storage**: ไฟล์เก็บใน private bucket (staging-files)
4. **Expiry**: ไฟล์ที่ไม่ได้เชื่อมตั๋วจะหมดอายุใน 30 วัน

---

## Related Documentation

- [API Staging](./api-staging.md) - Staging file management
- [LINE Messaging API](https://developers.line.biz/en/reference/messaging-api/)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
