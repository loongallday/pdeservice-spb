# Polls API

## Overview

The Polls API handles poll creation, management, and voting functionality.

**Base URL**: `/functions/v1/api-polls`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Polls

Get a paginated list of all polls.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Get Poll by ID

Get a single poll with its options and vote counts.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Poll ID (UUID)

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "question": "What's your favorite feature?",
    "poll_type": "single_choice",
    "expires_at": "2025-12-31T23:59:59Z",
    "options": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "option_text": "Feature A",
        "display_order": 1,
        "vote_count": 5
      }
    ]
  }
}
```

---

### Create Poll

Create a new poll.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "question": "What's your favorite feature?",
  "poll_type": "single_choice",
  "options": [
    {
      "option_text": "Feature A",
      "display_order": 1
    },
    {
      "option_text": "Feature B",
      "display_order": 2
    }
  ],
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Required Fields**:
- `question`: Poll question text
- `poll_type`: Type of poll (`single_choice`, `multiple_choice`, `text`)
- `options`: Array of poll options (for choice types)

**Poll Types**:
- `single_choice`: Users can select one option
- `multiple_choice`: Users can select multiple options
- `text`: Users provide text answers

---

### Vote on Poll

Cast a vote on a poll.

**Endpoint**: `POST /:id/vote`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Poll ID (UUID)

**Request Body** (for choice polls):
```json
{
  "option_id": "123e4567-e89b-12d3-a456-426614174001"
}
```

**Request Body** (for text polls):
```json
{
  "text_answer": "My answer here"
}
```

**Notes**:
- Each employee can only vote once per poll
- For `multiple_choice`, provide array of `option_id`s
- Votes are automatically linked to the authenticated employee

---

### Update Poll

Update an existing poll (only if no votes cast).

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

---

### Delete Poll

Delete a poll and all associated votes.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

**Special Errors**:
- `409 Conflict`: User has already voted on this poll
- `400 Bad Request`: Poll has expired

---

## Notes

- Polls can have expiration dates
- Each employee can only vote once per poll
- Vote counts are included in poll responses
- Text polls don't require options

