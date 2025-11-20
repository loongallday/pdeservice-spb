# Work Results API

## Overview

The Work Results API handles work result documentation including photos, documents, and multi-page documents.

**Base URL**: `/functions/v1/api-work-results`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Get Work Result by Ticket

Get work result(s) associated with a specific ticket.

**Endpoint**: `GET /ticket/:ticketId`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `ticketId` (required): Ticket ID (UUID)

---

### Get Work Result by ID

Get a single work result with all associated photos and documents.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Work result ID (UUID)

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "description": "Work completed",
    "result_note": "All tasks finished",
    "created_by": "123e4567-e89b-12d3-a456-426614174002",
    "photos": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174003",
        "url": "https://...",
        "display_order": 1
      }
    ],
    "documents": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174004",
        "name": "Report.pdf",
        "url": "https://...",
        "pages": [
          {
            "id": "123e4567-e89b-12d3-a456-426614174005",
            "page_number": 1,
            "url": "https://..."
          }
        ]
      }
    ]
  }
}
```

---

### Create Work Result

Create a new work result.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
  "description": "Work completed successfully",
  "result_note": "All tasks finished"
}
```

**Required Fields**:
- `ticket_id`: Ticket ID (UUID)
- `description`: Work result description

---

### Update Work Result

Update an existing work result.

**Endpoint**: `PUT /:id`

**Required Level**: 0 (all authenticated users)

---

### Delete Work Result

Delete a work result and all associated photos/documents.

**Endpoint**: `DELETE /:id`

**Required Level**: 0 (all authenticated users)

---

### Add Photo

Upload a photo to a work result.

**Endpoint**: `POST /photos`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body** (multipart/form-data):
- `file`: Image file
- `work_result_id`: Work result ID (UUID)
- `display_order` (optional): Display order number

**Example Request**:
```http
POST /functions/v1/api-work-results/photos
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [binary image data]
work_result_id: 123e4567-e89b-12d3-a456-426614174000
display_order: 1
```

---

### Delete Photo

Delete a photo from a work result.

**Endpoint**: `DELETE /photos/:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Photo ID (UUID)

---

### Add Document

Upload a document to a work result.

**Endpoint**: `POST /documents`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body** (multipart/form-data):
- `file`: Document file (PDF, etc.)
- `work_result_id`: Work result ID (UUID)
- `name`: Document name

---

### Delete Document

Delete a document and all its pages.

**Endpoint**: `DELETE /documents/:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Document ID (UUID)

---

### Add Document Page

Add a page to a multi-page document.

**Endpoint**: `POST /documents/pages`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body** (multipart/form-data):
- `file`: Page image/file
- `document_id`: Document ID (UUID)
- `page_number`: Page number

---

### Delete Document Page

Delete a page from a document.

**Endpoint**: `DELETE /documents/pages/:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Document page ID (UUID)

---

## File Uploads

- Photos: Images (JPG, PNG, etc.)
- Documents: PDFs and other document formats
- Files are stored in Supabase Storage
- URLs are returned in responses

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

**Special Errors**:
- `400 Bad Request`: Invalid file format or missing required fields
- `413 Payload Too Large`: File size exceeds limit

---

## Notes

- Photos and documents are stored in Supabase Storage
- Documents can have multiple pages
- Files are automatically processed and URLs generated
- Display order determines photo/document ordering

