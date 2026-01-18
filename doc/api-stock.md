# API Stock Documentation

## Overview

The Stock Management API provides comprehensive inventory management capabilities for tracking both quantity-based stock items and serialized equipment. It supports warehouse operations including receiving, transferring, adjusting, and consuming stock, with full audit trails for all movements.

**Base URL:** `/api-stock`

**Authentication:** All endpoints require a valid JWT token in the `Authorization` header.

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [Stock Locations](#stock-locations)
3. [Stock Items (Quantity-based)](#stock-items-quantity-based)
4. [Stock Movements](#stock-movements)
5. [Serial Items (Serialized Tracking)](#serial-items-serialized-tracking)
6. [Error Responses](#error-responses)
7. [Permission Levels Reference](#permission-levels-reference)

---

## Dashboard

### Get Dashboard Summary

Returns an overview of stock system status including location counts, low stock alerts, and recent movements.

**Endpoint:** `GET /dashboard`

**Permission Level:** 0 (All authenticated users)

**Response:**

```json
{
  "data": {
    "summary": {
      "total_locations": 15,
      "total_items": 234,
      "low_stock_count": 5
    },
    "low_stock_items": [
      {
        "stock_item_id": "uuid",
        "location_id": "uuid",
        "location_name": "Main Warehouse",
        "location_code": "WH-001",
        "model_id": "uuid",
        "item_code": "UPS-1000",
        "item_name": "UPS 1000VA",
        "quantity": 2,
        "minimum_quantity": 10,
        "deficit": 8
      }
    ],
    "recent_movements": [
      {
        "id": "uuid",
        "movement_type": "receive",
        "quantity": 10,
        "performed_at": "2024-01-15T10:30:00Z",
        "stock_item": {
          "id": "uuid",
          "location": { "id": "uuid", "name": "Main Warehouse", "code": "WH-001" },
          "model": { "id": "uuid", "model": "UPS-1000", "name_th": "UPS 1000VA" }
        },
        "performer": { "id": "uuid", "name": "John Doe" }
      }
    ]
  }
}
```

---

## Stock Locations

Stock locations represent physical storage areas such as warehouses, technician vehicles, or customer sites.

### List Locations

Returns a list of all stock locations with optional filters.

**Endpoint:** `GET /locations`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type_id` | UUID | Filter by location type ID |
| `site_id` | UUID | Filter by associated site |
| `employee_id` | UUID | Filter by associated employee (e.g., technician's vehicle) |
| `is_active` | boolean | Filter by active status (`true` or `false`) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Main Warehouse",
      "code": "WH-001",
      "location_type_id": "uuid",
      "site_id": null,
      "employee_id": null,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "location_type": {
        "id": "uuid",
        "code": "warehouse",
        "name_th": "คลังสินค้า"
      }
    }
  ]
}
```

---

### Get Location by ID

Retrieves detailed information about a specific location.

**Endpoint:** `GET /locations/:id`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Location ID |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "Main Warehouse",
    "code": "WH-001",
    "location_type_id": "uuid",
    "site_id": null,
    "employee_id": null,
    "address": "123 Industrial Road, Bangkok",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "location_type": {
      "id": "uuid",
      "code": "warehouse",
      "name_th": "คลังสินค้า"
    },
    "site": null,
    "employee": null
  }
}
```

---

### Get Items by Location

Returns all stock items at a specific location.

**Endpoint:** `GET /locations/:id/items`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Location ID |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "model_id": "uuid",
      "quantity": 50,
      "minimum_quantity": 10,
      "reserved_quantity": 5,
      "available_quantity": 45,
      "model": {
        "id": "uuid",
        "model": "UPS-1000",
        "name_th": "UPS 1000VA",
        "unit": "unit"
      }
    }
  ]
}
```

---

### Create Location

Creates a new stock location.

**Endpoint:** `POST /locations`

**Permission Level:** 2 (Admin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Location name |
| `code` | string | Yes | Unique location code |
| `location_type_id` | UUID or string | Yes | Location type ID or code (e.g., "warehouse", "vehicle") |
| `site_id` | UUID | No | Associated site ID |
| `employee_id` | UUID | No | Associated employee ID |
| `address` | string | No | Physical address |
| `is_active` | boolean | No | Active status (default: `true`) |

**Example Request:**

```json
{
  "name": "New Warehouse",
  "code": "WH-002",
  "location_type_id": "warehouse",
  "address": "456 Industrial Road"
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "name": "New Warehouse",
    "code": "WH-002",
    "location_type_id": "uuid",
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "location_type": {
      "id": "uuid",
      "code": "warehouse",
      "name_th": "คลังสินค้า"
    }
  }
}
```

---

### Update Location

Updates an existing stock location.

**Endpoint:** `PUT /locations/:id`

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Location ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Location name |
| `code` | string | No | Unique location code |
| `location_type_id` | UUID or string | No | Location type ID or code |
| `site_id` | UUID | No | Associated site ID (null to clear) |
| `employee_id` | UUID | No | Associated employee ID (null to clear) |
| `address` | string | No | Physical address |
| `is_active` | boolean | No | Active status |

**Example Request:**

```json
{
  "name": "Updated Warehouse Name",
  "is_active": false
}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "Updated Warehouse Name",
    "code": "WH-002",
    "is_active": false,
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### Delete Location

Deletes a stock location. Only locations with no stock items can be deleted.

**Endpoint:** `DELETE /locations/:id`

**Permission Level:** 3 (Superadmin)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Location ID |

**Response:**

```json
{
  "data": {
    "deleted": true
  }
}
```

**Error (Location has items):**

```json
{
  "error": "ไม่สามารถลบตำแหน่งที่มีสินค้าคงคลังได้"
}
```

---

## Stock Items (Quantity-based)

Stock items track quantity-based inventory (items without serial numbers).

### List Stock Items

Returns a paginated list of stock items.

**Endpoint:** `GET /items`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `location_id` | UUID | Filter by location |
| `model_id` | UUID | Filter by model/product |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20) |

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "location_id": "uuid",
        "model_id": "uuid",
        "quantity": 50,
        "minimum_quantity": 10,
        "reserved_quantity": 5,
        "available_quantity": 45,
        "model": {
          "id": "uuid",
          "model": "UPS-1000",
          "name_th": "UPS 1000VA",
          "unit": "unit"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "total_pages": 5,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

### Get Stock Item by ID

Retrieves detailed information about a specific stock item.

**Endpoint:** `GET /items/:id`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Stock item ID |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "location_id": "uuid",
    "model_id": "uuid",
    "quantity": 50,
    "minimum_quantity": 10,
    "reserved_quantity": 5,
    "available_quantity": 45,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "location": {
      "id": "uuid",
      "name": "Main Warehouse",
      "code": "WH-001"
    },
    "model": {
      "id": "uuid",
      "model": "UPS-1000",
      "name": "UPS 1000VA",
      "name_th": "UPS 1000VA",
      "name_en": "UPS 1000VA",
      "category": "ups",
      "unit": "unit"
    }
  }
}
```

---

### Search Stock Items

Searches stock items by model code or name.

**Endpoint:** `GET /items/search`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (matches model code or name) |
| `limit` | integer | No | Maximum results (default: 20, max: 50) |

**Example Request:**

```
GET /items/search?q=UPS&limit=10
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "model_id": "uuid",
      "quantity": 50,
      "minimum_quantity": 10,
      "reserved_quantity": 5,
      "available_quantity": 45,
      "location": {
        "id": "uuid",
        "name": "Main Warehouse",
        "code": "WH-001"
      },
      "model": {
        "id": "uuid",
        "model": "UPS-1000",
        "name_th": "UPS 1000VA",
        "unit": "unit"
      }
    }
  ]
}
```

---

### Get Low Stock Items

Returns items where current quantity is below the minimum threshold.

**Endpoint:** `GET /items/low-stock`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Response:**

```json
{
  "data": [
    {
      "stock_item_id": "uuid",
      "location_id": "uuid",
      "location_name": "Main Warehouse",
      "location_code": "WH-001",
      "model_id": "uuid",
      "item_code": "UPS-1000",
      "item_name": "UPS 1000VA",
      "quantity": 2,
      "minimum_quantity": 10,
      "deficit": 8
    }
  ]
}
```

---

### Get Movement History for Stock Item

Returns the movement history for a specific stock item.

**Endpoint:** `GET /items/:id/movements`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Stock item ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20) |

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "stock_item_id": "uuid",
        "movement_type": "receive",
        "quantity": 10,
        "quantity_before": 40,
        "quantity_after": 50,
        "reference_id": null,
        "reference_type": null,
        "related_location_id": null,
        "notes": "Initial stock",
        "performed_by": "uuid",
        "performed_at": "2024-01-15T10:00:00Z",
        "created_at": "2024-01-15T10:00:00Z",
        "performer": {
          "id": "uuid",
          "name": "John Doe"
        },
        "related_location": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### Stock Movement Types

| Type | Description |
|------|-------------|
| `receive` | Stock received into inventory |
| `consume` | Stock consumed for ticket work |
| `transfer_out` | Stock transferred out to another location |
| `transfer_in` | Stock transferred in from another location |
| `adjust_add` | Manual adjustment adding quantity |
| `adjust_remove` | Manual adjustment removing quantity |
| `reserve` | Stock reserved for a job |
| `unreserve` | Stock reservation cancelled |

---

## Stock Movements

### Receive Stock

Adds new stock to a location. Use this for quantity-based items only. For serialized items, use `/serials/receive`.

**Endpoint:** `POST /receive`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | UUID | Yes | Destination location ID |
| `model_id` | UUID | Yes | Model/product ID |
| `quantity` | integer | Yes | Quantity to receive (must be > 0) |
| `notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "location_id": "uuid",
  "model_id": "uuid",
  "quantity": 10,
  "notes": "PO #12345"
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "stock_item_id": "uuid",
    "new_quantity": 60
  }
}
```

**Notes:**
- If the model has `has_serial = true`, this endpoint will return an error directing you to use the serial receive endpoint (`POST /serials/receive`).
- Creates a new stock item record if one doesn't exist for the model/location combination.

---

### Transfer Stock

Transfers stock from one location to another.

**Endpoint:** `POST /transfer`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from_location_id` | UUID | Yes | Source location ID |
| `to_location_id` | UUID | Yes | Destination location ID |
| `model_id` | UUID | Yes | Model/product ID |
| `quantity` | integer | Yes | Quantity to transfer (must be > 0) |
| `notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "from_location_id": "uuid",
  "to_location_id": "uuid",
  "model_id": "uuid",
  "quantity": 5,
  "notes": "Replenishing technician vehicle"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "from_remaining": 45,
    "to_new_quantity": 15
  }
}
```

**Validation:**
- Source and destination locations must be different
- Sufficient stock must be available at source location
- Creates destination stock item if it doesn't exist

---

### Adjust Stock

Adjusts stock quantity (increase or decrease) with a required reason.

**Endpoint:** `POST /items/:id/adjust`

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Stock item ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adjustment` | integer | Yes | Adjustment amount (positive to add, negative to remove) |
| `reason` | string | Yes | Reason for adjustment |

**Example Request (Add):**

```json
{
  "adjustment": 5,
  "reason": "Found items during inventory audit"
}
```

**Example Request (Remove):**

```json
{
  "adjustment": -3,
  "reason": "Damaged items disposed"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "new_quantity": 55
  }
}
```

**Note:** Adjustment of 0 is not allowed.

---

### Consume Stock for Ticket

Records stock consumption for a service ticket (work order).

**Endpoint:** `POST /tickets/:ticketId/consume`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | Yes | Array of items to consume |
| `items[].stock_item_id` | UUID | Yes | Stock item ID |
| `items[].quantity` | integer | Yes | Quantity to consume (must be > 0) |
| `notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "items": [
    {
      "stock_item_id": "uuid",
      "quantity": 2
    },
    {
      "stock_item_id": "uuid",
      "quantity": 1
    }
  ],
  "notes": "Replaced faulty components"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "consumed": [
      {
        "stock_item_id": "uuid",
        "remaining": 48
      },
      {
        "stock_item_id": "uuid",
        "remaining": 19
      }
    ]
  }
}
```

**Notes:**
- Links consumed stock to the ticket via `jct_ticket_stock_items` table
- Records movement history with reference to the ticket

---

## Serial Items (Serialized Tracking)

Serial items provide full lifecycle tracking for equipment with unique serial numbers.

### Serial Status Values

| Status | Description |
|--------|-------------|
| `in_stock` | Item is in inventory and available |
| `reserved` | Item is reserved for a job but not yet deployed |
| `deployed` | Item is installed at a customer site |
| `defective` | Item is marked as defective |
| `returned` | Item has been returned from deployment |
| `scrapped` | Item has been decommissioned |

---

### List Serial Items

Returns a paginated list of serial items.

**Endpoint:** `GET /serials`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `location_id` | UUID | Filter by location |
| `model_id` | UUID | Filter by model |
| `status` | string | Filter by status |
| `ticket_id` | UUID | Filter by associated ticket |
| `search` | string | Search by serial number (partial match) |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20) |

**Example Request:**

```
GET /serials?status=in_stock&location_id=uuid&page=1&limit=20
```

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "model_id": "uuid",
        "serial_no": "SN123456789",
        "location_id": "uuid",
        "status": "in_stock",
        "ticket_id": null,
        "received_at": "2024-01-01T00:00:00Z",
        "created_at": "2024-01-01T00:00:00Z",
        "model": {
          "id": "uuid",
          "model": "UPS-3000",
          "name_th": "UPS 3000VA"
        },
        "location": {
          "id": "uuid",
          "name": "Main Warehouse",
          "code": "WH-001"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

### Get Serial Item by ID

Retrieves detailed information about a serial item.

**Endpoint:** `GET /serials/:id`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "model_id": "uuid",
    "serial_no": "SN123456789",
    "location_id": "uuid",
    "status": "in_stock",
    "ticket_id": null,
    "site_id": null,
    "received_at": "2024-01-01T00:00:00Z",
    "received_by": "uuid",
    "notes": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "model": {
      "id": "uuid",
      "model": "UPS-3000",
      "name_th": "UPS 3000VA"
    },
    "location": {
      "id": "uuid",
      "name": "Main Warehouse",
      "code": "WH-001"
    },
    "ticket": null,
    "site": null
  }
}
```

---

### Get Serial Item by Serial Number

Looks up a serial item by its serial number.

**Endpoint:** `GET /serials/by-serial/:serialNo`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serialNo` | string | Serial number |

**Example Request:**

```
GET /serials/by-serial/SN123456789
```

**Response:** Same as Get Serial Item by ID

---

### Search Serial Items

Searches serial items by serial number (partial match).

**Endpoint:** `GET /serials/search`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 2 characters) |
| `limit` | integer | No | Maximum results (default: 20) |

**Example Request:**

```
GET /serials/search?q=SN123&limit=10
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "serial_no": "SN123456789",
      "model_id": "uuid",
      "status": "in_stock",
      "model": {
        "id": "uuid",
        "model": "UPS-3000",
        "name_th": "UPS 3000VA"
      },
      "location": {
        "id": "uuid",
        "name": "Main Warehouse",
        "code": "WH-001"
      }
    }
  ]
}
```

---

### Receive Serial Items

Receives new serialized items into inventory. The model must have `has_serial = true`.

**Endpoint:** `POST /serials/receive`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | UUID | Yes | Destination location ID |
| `items` | array | Yes | Array of items to receive |
| `items[].model_id` | UUID | Yes | Model ID |
| `items[].serial_no` | string | Yes | Serial number |
| `items[].notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "location_id": "uuid",
  "items": [
    {
      "model_id": "uuid",
      "serial_no": "SN-2024-001",
      "notes": "New shipment"
    },
    {
      "model_id": "uuid",
      "serial_no": "SN-2024-002"
    }
  ]
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "received": [
      {
        "id": "uuid",
        "serial_no": "SN-2024-001",
        "status": "in_stock",
        "model": { "id": "uuid", "model": "UPS-3000", "name_th": "UPS 3000VA" }
      },
      {
        "id": "uuid",
        "serial_no": "SN-2024-002",
        "status": "in_stock",
        "model": { "id": "uuid", "model": "UPS-3000", "name_th": "UPS 3000VA" }
      }
    ],
    "failed": []
  }
}
```

**Notes:**
- Serial numbers are automatically converted to uppercase and trimmed
- Duplicate serial numbers will be reported in the `failed` array with error message
- The model must have `has_serial = true` to receive serial items

---

### Transfer Serial Item

Transfers a serial item to another location.

**Endpoint:** `POST /serials/:id/transfer`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to_location_id` | UUID | Yes | Destination location ID |
| `notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "to_location_id": "uuid",
  "notes": "Transferred to technician vehicle"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN-2024-001",
    "location_id": "uuid",
    "status": "in_stock",
    "location": {
      "id": "uuid",
      "name": "Technician Vehicle - John",
      "code": "VH-001"
    }
  }
}
```

**Validation:** Item must be in `in_stock` or `returned` status.

---

### Deploy Serial Item

Deploys a serial item to a customer site via a ticket.

**Endpoint:** `POST /serials/:id/deploy`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | UUID | Yes | Associated ticket ID |
| `site_id` | UUID | No | Deployment site ID |
| `notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "ticket_id": "uuid",
  "site_id": "uuid",
  "notes": "Installed at customer premises"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN-2024-001",
    "status": "deployed",
    "location_id": null,
    "ticket_id": "uuid",
    "site_id": "uuid",
    "ticket": {
      "id": "uuid",
      "ticket_code": "TK-2024-0001"
    },
    "site": {
      "id": "uuid",
      "name": "Customer ABC"
    }
  }
}
```

**Validation:** Item must be in `in_stock` or `reserved` status.

---

### Return Serial Item

Returns a deployed serial item back to a stock location.

**Endpoint:** `POST /serials/:id/return`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to_location_id` | UUID | Yes | Return destination location ID |
| `notes` | string | No | Optional notes |

**Example Request:**

```json
{
  "to_location_id": "uuid",
  "notes": "Equipment replaced with newer model"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN-2024-001",
    "status": "returned",
    "location_id": "uuid",
    "ticket_id": null,
    "site_id": null,
    "location": {
      "id": "uuid",
      "name": "Main Warehouse",
      "code": "WH-001"
    }
  }
}
```

**Validation:** Item must be in `deployed` status.

---

### Mark Serial Item as Defective

Marks a serial item as defective.

**Endpoint:** `POST /serials/:id/defective`

**Permission Level:** 1 (Assigner/PM/Sales and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notes` | string | No | Reason for marking defective |

**Example Request:**

```json
{
  "notes": "Battery not holding charge"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN-2024-001",
    "status": "defective"
  }
}
```

**Note:** Can mark an item as defective from any status. The item retains its current location.

---

### Update Serial Item Status

Updates the status of a serial item (generic status update).

**Endpoint:** `POST /serials/:id/status`

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New status (see Serial Status Values) |
| `location_id` | UUID | No | New location ID (if changing location) |
| `notes` | string | No | Optional notes |

**Valid Status Values:**
- `in_stock`
- `reserved`
- `deployed`
- `defective`
- `returned`
- `scrapped`

**Example Request:**

```json
{
  "status": "in_stock",
  "location_id": "uuid",
  "notes": "Repaired and returned to stock"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN-2024-001",
    "status": "in_stock",
    "location_id": "uuid",
    "location": {
      "id": "uuid",
      "name": "Main Warehouse",
      "code": "WH-001"
    }
  }
}
```

**Notes:**
- When status changes to `in_stock` or `returned`, the `ticket_id` and `site_id` are automatically cleared.
- If `location_id` is not provided, the item keeps its current location.

---

### Get Serial Item Movement History

Returns the complete movement history for a serial item.

**Endpoint:** `GET /serials/:id/movements`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Serial item ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Maximum movements to return (default: 50) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "serial_item_id": "uuid",
      "movement_type": "deploy",
      "from_location_id": "uuid",
      "to_location_id": null,
      "from_status": "in_stock",
      "to_status": "deployed",
      "ticket_id": "uuid",
      "performed_by": "uuid",
      "performed_at": "2024-01-15T10:00:00Z",
      "notes": "Installed at customer site",
      "performer": {
        "id": "uuid",
        "name": "John Doe"
      },
      "from_location": {
        "id": "uuid",
        "name": "Main Warehouse"
      },
      "to_location": null
    },
    {
      "id": "uuid",
      "serial_item_id": "uuid",
      "movement_type": "receive",
      "from_location_id": null,
      "to_location_id": "uuid",
      "from_status": null,
      "to_status": "in_stock",
      "ticket_id": null,
      "performed_by": "uuid",
      "performed_at": "2024-01-01T00:00:00Z",
      "notes": "Initial receipt",
      "performer": {
        "id": "uuid",
        "name": "Admin User"
      },
      "from_location": null,
      "to_location": {
        "id": "uuid",
        "name": "Main Warehouse"
      }
    }
  ]
}
```

### Serial Movement Types

| Type | Description |
|------|-------------|
| `receive` | Item received into inventory |
| `transfer` | Item transferred between locations |
| `reserve` | Item reserved for a job |
| `unreserve` | Item reservation cancelled |
| `deploy` | Item deployed to customer |
| `return` | Item returned from deployment |
| `defective` | Item marked as defective |
| `repair` | Item sent for repair |
| `scrap` | Item scrapped/decommissioned |
| `adjust` | Status manually adjusted |

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message in Thai or English"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid input or validation error |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Insufficient permission level |
| `404` | Not Found - Resource does not exist |
| `500` | Internal Server Error - Database or server error |

### Common Error Messages (Thai)

| Error Message | Description |
|---------------|-------------|
| `กรุณาระบุชื่อตำแหน่ง` | Location name is required |
| `กรุณาระบุรหัสตำแหน่ง` | Location code is required |
| `กรุณาระบุประเภทตำแหน่ง` | Location type is required |
| `รหัสตำแหน่งซ้ำกับที่มีอยู่แล้ว` | Location code already exists |
| `ไม่สามารถลบตำแหน่งที่มีสินค้าคงคลังได้` | Cannot delete location with stock |
| `กรุณาระบุตำแหน่งจัดเก็บ` | Storage location is required |
| `กรุณาระบุตำแหน่งรับสินค้า` | Receiving location is required |
| `กรุณาระบุตำแหน่งรับคืน` | Return location is required |
| `กรุณาระบุรายการสินค้า` | Product item is required |
| `กรุณาระบุรายการสต็อกที่ต้องการใช้` | Stock items to consume are required |
| `กรุณาระบุรหัสสต็อก` | Stock item ID is required |
| `จำนวนต้องมากกว่า 0` | Quantity must be greater than 0 |
| `กรุณาระบุตำแหน่งต้นทาง` | Source location is required |
| `กรุณาระบุตำแหน่งปลายทาง` | Destination location is required |
| `ตำแหน่งต้นทางและปลายทางต้องไม่เหมือนกัน` | Source and destination must be different |
| `กรุณาระบุจำนวนที่ต้องการปรับปรุง` | Adjustment quantity is required |
| `กรุณาระบุเหตุผลในการปรับปรุง` | Adjustment reason is required |
| `ไม่พบรายการสต็อก` | Stock item not found |
| `ไม่พบรายการสินค้า` | Serial item not found |
| `ไม่พบตำแหน่งจัดเก็บ` | Location not found |
| `กรุณาระบุคำค้นหา` | Search query is required |
| `กรุณาระบุคำค้นหาอย่างน้อย 2 ตัวอักษร` | Search query must be at least 2 characters |
| `กรุณาระบุประเภทสินค้า` | Model type is required |
| `กรุณาระบุหมายเลขซีเรียล` | Serial number is required |
| `กรุณาระบุตั๋วงาน` | Ticket is required (for deploy) |
| `กรุณาระบุสถานะ` | Status is required |
| `สถานะไม่ถูกต้อง` | Invalid status |
| `หมายเลขซีเรียลนี้มีอยู่แล้ว` | Serial number already exists |
| `สินค้านี้ไม่ได้อยู่ในสถานะติดตั้ง` | Item is not in deployed status |
| `ไม่สามารถโอนย้ายสินค้าที่มีสถานะ "X" ได้` | Cannot transfer item with status "X" |
| `ไม่สามารถติดตั้งสินค้าที่มีสถานะ "X" ได้` | Cannot deploy item with status "X" |
| `สินค้า "X" ไม่ต้องการซีเรียล กรุณาใช้หน้ารับสต็อกแบบจำนวน` | Model "X" doesn't require serial, use quantity receive |

---

## Permission Levels Reference

| Level | Role | Access |
|-------|------|--------|
| 0 | Technician L1 | Read-only access (view locations, items, serials, movements) |
| 1 | Assigner, PM, Sales | Create/update operations (receive, transfer, deploy, return) |
| 2 | Admin | Administrative operations (create/update locations, adjust stock, update status) |
| 3 | Superadmin | Full access (delete locations) |
