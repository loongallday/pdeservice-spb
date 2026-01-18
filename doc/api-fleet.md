# Fleet Management API

## Overview

The Fleet API (`api-fleet`) provides real-time vehicle tracking and fleet management capabilities for field service operations. This API enables:

- Real-time vehicle location tracking with status monitoring
- Vehicle-employee assignment management
- Override capabilities for driver name and plate number
- Route history viewing for historical tracking analysis
- Work location mapping based on assigned tickets
- Garage/base location management with proximity detection

Vehicle data is synchronized from an external GPS system and stored locally in the database. The API reads from this cached data to provide fast, reliable access without external API latency.

---

## Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet
```

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The authenticated user must be an active employee in the system.

---

## Permission Levels

| Level | Roles | Access |
|-------|-------|--------|
| 1 | Assigner, PM, Sales, Technician L2 | Read access (list, view vehicles, routes, work locations, garages) |
| 2 | Admin | Full access (update vehicles, manage employees, manage garages) |
| 3 | Superadmin | Full access |

---

## Data Types

### VehicleStatus

```typescript
type VehicleStatus = 'moving' | 'stopped' | 'parked_at_base';
```

| Status | Thai | Description |
|--------|------|-------------|
| `moving` | กำลังวิ่ง | Vehicle is currently in motion (speed > 0) |
| `stopped` | จอดนิ่ง | Vehicle is stopped, not at any garage |
| `parked_at_base` | จอดที่โรงรถ | Vehicle is parked within a garage radius |

### VehicleInfo

```typescript
interface VehicleInfo {
  id: string;                    // Vehicle ID from GPS system (string, not UUID)
  name: string;                  // Vehicle name/label
  plate_number: string | null;   // License plate (override or original)
  driver_name: string | null;    // Driver name (override or original)
  employees: EmployeeInfo[];     // Assigned employees
  status: VehicleStatus;         // Current vehicle status
  speed: number;                 // Current speed (km/h)
  latitude: number;              // Current GPS latitude
  longitude: number;             // Current GPS longitude
  heading: number;               // Direction in degrees (0-360)
  signal_strength: number;       // GPS signal strength (0-100)
  address: string | null;        // Reverse-geocoded address (Thai)
  garage: GarageInfo | null;     // Current garage info (if parked at base)
  last_sync_at: string;          // Last GPS data sync timestamp (ISO 8601)
}
```

### EmployeeInfo

```typescript
interface EmployeeInfo {
  id: string;    // Employee UUID
  name: string;  // Employee name
}
```

### GarageInfo

```typescript
interface GarageInfo {
  id: string;              // Garage UUID
  name: string;            // Garage name
  distance_meters: number; // Distance from vehicle to garage center
}
```

### GarageDetail

```typescript
interface GarageDetail {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;   // Detection radius (default: 100m)
  is_active: boolean;
}
```

### WorkLocation

```typescript
interface WorkLocation {
  ticket_id: string;                      // Ticket UUID
  ticket_code: string | null;             // Ticket code (e.g., TK-2026-0001)
  site_id: string;                        // Site UUID
  site_name: string;                      // Site/customer name
  latitude: number | null;                // Site GPS latitude
  longitude: number | null;               // Site GPS longitude
  address_detail: string | null;          // Site address
  appointment_date: string | null;        // Appointment date (YYYY-MM-DD)
  appointment_time_start: string | null;  // Start time (HH:mm)
  appointment_time_end: string | null;    // End time (HH:mm)
  work_type_code: string | null;          // Work type code
  work_type_name: string | null;          // Work type name (Thai)
  status_code: string | null;             // Ticket status code
  status_name: string | null;             // Ticket status name (Thai)
}
```

### VehicleHistoryPoint

```typescript
interface VehicleHistoryPoint {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  status: VehicleStatus;
  address: string | null;
  recorded_at: string;  // ISO 8601 timestamp
}
```

---

## Endpoints

### Utility

#### Keep Function Warm

Returns a simple status response to keep the Edge Function warm. This endpoint does not require authentication.

```
GET /api-fleet/warmup
```

**Permission Level:** None (no authentication required)

**Response:**

```json
{
  "status": "warm",
  "timestamp": "2026-01-15T08:00:00.000Z"
}
```

**Example Request:**

```bash
curl "https://api.example.com/api-fleet/warmup"
```

---

### Vehicles

#### List All Vehicles

Retrieve all tracked vehicles with current status and location.

```
GET /api-fleet
```

**Permission Level:** 1

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `moving`, `stopped`, or `parked_at_base` |

**Response:**

```json
{
  "data": [
    {
      "id": "NTQwNjMwMDE2NjYr",
      "name": "1กฮ-6591 คุณณรงค์ชัย",
      "plate_number": "1กฮ-6591",
      "driver_name": "คุณณรงค์ชัย",
      "employees": [
        { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "สมชาย ใจดี" },
        { "id": "550e8400-e29b-41d4-a716-446655440002", "name": "สมหญิง ดีใจ" }
      ],
      "status": "parked_at_base",
      "speed": 0,
      "latitude": 13.7325,
      "longitude": 100.7309,
      "heading": 140,
      "signal_strength": 100,
      "address": "123 ถนนสุขุมวิท แขวงบางจาก เขตพระโขนง กรุงเทพมหานคร 10260",
      "garage": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "สำนักงานใหญ่ PDE",
        "distance_meters": 15
      },
      "last_sync_at": "2026-01-15T08:00:00Z"
    }
  ]
}
```

**Example Request:**

```bash
# List all vehicles
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api-fleet"

# List only moving vehicles
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api-fleet?status=moving"
```

---

#### Get Single Vehicle

Retrieve detailed information for a specific vehicle.

```
GET /api-fleet/:id
```

**Permission Level:** 1

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system (not UUID) |

**Response:**

Same format as single item in List All Vehicles.

**Error Response (404):**

```json
{
  "error": "ไม่พบข้อมูลรถ"
}
```

---

#### Update Vehicle

Update vehicle override information (driver name or plate number).

```
PUT /api-fleet/:id
```

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system |

**Request Body:**

```json
{
  "driver_name_override": "คุณสมชาย ใจดี",
  "plate_number_override": "2ขก-1234"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `driver_name_override` | string | No | Override for driver name (shown instead of GPS data) |
| `plate_number_override` | string | No | Override for plate number (shown instead of GPS data) |

**Response:**

Returns the updated vehicle object.

---

### Vehicle Employees

#### Set Vehicle Employees (Replace All)

Replace all employee assignments for a vehicle with a new list.

```
PUT /api-fleet/:id/employees
```

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system |

**Request Body:**

```json
{
  "employee_ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_ids` | string[] | Yes | Array of employee UUIDs to assign (empty array clears all) |

**Response:**

```json
{
  "data": {
    "employees": [
      { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "สมชาย ใจดี" },
      { "id": "550e8400-e29b-41d4-a716-446655440002", "name": "สมหญิง ดีใจ" }
    ]
  }
}
```

**Error Response (400):**

```json
{
  "error": "กรุณาระบุ employee_ids เป็น array"
}
```

---

#### Add Employee to Vehicle

Add a single employee to a vehicle without removing existing assignments.

```
POST /api-fleet/:id/employees
```

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system |

**Request Body:**

```json
{
  "employee_id": "550e8400-e29b-41d4-a716-446655440003"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_id` | string | Yes | Employee UUID to add |

**Response:**

```json
{
  "data": {
    "employees": [
      { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "สมชาย ใจดี" },
      { "id": "550e8400-e29b-41d4-a716-446655440003", "name": "สมศักดิ์ มั่นคง" }
    ]
  }
}
```

**Note:** If the employee is already assigned, the operation succeeds silently (no error, duplicate ignored).

**Error Response (400):**

```json
{
  "error": "กรุณาระบุ employee_id"
}
```

---

#### Remove Employee from Vehicle

Remove an employee from a vehicle assignment.

```
DELETE /api-fleet/:id/employees/:employeeId
```

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system |
| `employeeId` | string | Yes | Employee UUID to remove |

**Response:**

```json
{
  "data": {
    "message": "ลบพนักงานออกจากรถสำเร็จ"
  }
}
```

---

### Route History

#### Get Vehicle Route History

Retrieve GPS tracking history for a vehicle. Data is typically logged every 5 minutes.

```
GET /api-fleet/:id/route
```

**Permission Level:** 1

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Single date (YYYY-MM-DD). Defaults to today. |
| `start_date` | string | No | Start of date range (YYYY-MM-DD) |
| `end_date` | string | No | End of date range (YYYY-MM-DD) |

**Note:** If both `start_date` and `end_date` are provided, they override the `date` parameter.

**Response:**

```json
{
  "data": [
    {
      "latitude": 13.7325,
      "longitude": 100.7309,
      "speed": 45,
      "heading": 180,
      "status": "moving",
      "address": "ถนนสุขุมวิท แขวงบางจาก กรุงเทพมหานคร",
      "recorded_at": "2026-01-15T08:00:00Z"
    },
    {
      "latitude": 13.7350,
      "longitude": 100.7320,
      "speed": 0,
      "heading": 180,
      "status": "stopped",
      "address": "ซอยสุขุมวิท 77 กรุงเทพมหานคร",
      "recorded_at": "2026-01-15T08:05:00Z"
    }
  ]
}
```

**Example Request:**

```bash
# Today's route (default)
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api-fleet/vehicle-001/route"

# Specific date
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api-fleet/vehicle-001/route?date=2026-01-10"

# Date range
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api-fleet/vehicle-001/route?start_date=2026-01-01&end_date=2026-01-15"
```

---

### Work Locations

#### Get Work Locations for Vehicle

Retrieve scheduled work locations (ticket sites) for all employees assigned to this vehicle.

```
GET /api-fleet/:id/work-locations
```

**Permission Level:** 1

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Vehicle ID from GPS system |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Date to check (YYYY-MM-DD). Defaults to today. |

**Response:**

```json
{
  "data": [
    {
      "ticket_id": "550e8400-e29b-41d4-a716-446655440010",
      "ticket_code": "TK-2026-0001",
      "site_id": "550e8400-e29b-41d4-a716-446655440020",
      "site_name": "บริษัท ABC จำกัด",
      "latitude": 13.7500,
      "longitude": 100.5000,
      "address_detail": "123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ",
      "appointment_date": "2026-01-15",
      "appointment_time_start": "09:00",
      "appointment_time_end": "12:00",
      "work_type_code": "pm",
      "work_type_name": "บำรุงรักษา",
      "status_code": "confirmed",
      "status_name": "ยืนยันแล้ว"
    }
  ]
}
```

**Notes:**
- Returns tickets only for employees confirmed on `jct_ticket_employees_cf` table
- Only includes tickets with valid site coordinates and appointment dates
- Useful for displaying planned work stops on a map overlay

---

### Garages

#### List All Garages

Retrieve all configured garage/base locations.

```
GET /api-fleet/garages
```

**Permission Level:** 1

**Response:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "สำนักงานใหญ่ PDE",
      "description": "สำนักงานใหญ่ พีดีอี เซอร์วิส",
      "latitude": 13.7325,
      "longitude": 100.7309,
      "radius_meters": 150,
      "is_active": true
    }
  ]
}
```

---

#### Create Garage

Create a new garage/base location.

```
POST /api-fleet/garages
```

**Permission Level:** 2 (Admin)

**Request Body:**

```json
{
  "name": "โรงรถสาขา 2",
  "description": "โรงรถสาขาฝั่งธนบุรี",
  "latitude": 13.7200,
  "longitude": 100.4800,
  "radius_meters": 100
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Garage name |
| `description` | string | No | Optional description |
| `latitude` | number | Yes | GPS latitude |
| `longitude` | number | Yes | GPS longitude |
| `radius_meters` | number | No | Detection radius in meters (default: 100) |

**Response (201):**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440099",
    "name": "โรงรถสาขา 2"
  }
}
```

**Error Responses (400):**

```json
{
  "error": "กรุณาระบุชื่อโรงรถ"
}
```

```json
{
  "error": "กรุณาระบุพิกัด"
}
```

---

#### Update Garage

Update an existing garage location.

```
PUT /api-fleet/garages/:id
```

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Garage UUID |

**Request Body:**

```json
{
  "name": "โรงรถสาขา 2 (อัพเดท)",
  "description": "รายละเอียดใหม่",
  "latitude": 13.7210,
  "longitude": 100.4810,
  "radius_meters": 120
}
```

All fields are optional. Only provided fields will be updated.

**Response:**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440099",
    "name": "โรงรถสาขา 2 (อัพเดท)"
  }
}
```

---

#### Delete Garage

Delete a garage location.

```
DELETE /api-fleet/garages/:id
```

**Permission Level:** 2 (Admin)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Garage UUID |

**Response:**

```json
{
  "data": {
    "message": "ลบโรงรถสำเร็จ"
  }
}
```

---

## Error Responses

### Standard Error Format

All errors return:

```json
{
  "error": "Error message (typically in Thai)"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters or validation error |
| 401 | Unauthorized - Missing or invalid authentication token |
| 403 | Forbidden - Insufficient permission level |
| 404 | Not Found - Resource does not exist |
| 500 | Internal Server Error - Database or server error |

### Common Error Messages

| Error Message (Thai) | English Meaning |
|---------------------|-----------------|
| `ไม่พบข้อมูลการยืนยันตัวตน` | Missing Authorization header |
| `Session หมดอายุกรุณาเข้าใช้งานใหม่` | JWT token expired |
| `ไม่พบข้อมูลพนักงาน` | Employee not found |
| `ต้องมีสิทธิ์ระดับ 2 ขึ้นไป` | Requires level 2+ permission |
| `ไม่พบข้อมูลรถ` | Vehicle not found |
| `กรุณาระบุชื่อโรงรถ` | Garage name required |
| `กรุณาระบุพิกัด` | Coordinates required |
| `กรุณาระบุ employee_ids เป็น array` | employee_ids must be array |
| `กรุณาระบุ employee_id` | employee_id required |
| `ลบพนักงานออกจากรถสำเร็จ` | Employee removed from vehicle successfully |
| `ลบโรงรถสำเร็จ` | Garage deleted successfully |

---

## Database Tables

### fleet_vehicles

Stores synced vehicle data from external GPS system.

### fleet_garages

Stores garage/base locations with detection radius.

### fleet_vehicle_history

Stores historical tracking data for route history.

### jct_fleet_vehicle_employees

Junction table for vehicle-employee assignments.

| Column | Type | Description |
|--------|------|-------------|
| `vehicle_id` | TEXT | Vehicle ID (FK to fleet_vehicles) |
| `employee_id` | UUID | Employee ID (FK to main_employees) |
| `created_at` | TIMESTAMPTZ | Assignment timestamp |

**Composite Primary Key:** (vehicle_id, employee_id)

---

## Frontend Integration Examples

### API Service

```typescript
// services/fleetService.ts
const API_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Authorization': `Bearer ${session?.access_token}` };
}

export const fleetService = {
  async getVehicles(status?: VehicleStatus): Promise<VehicleInfo[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);

    const res = await fetch(`${API_URL}/functions/v1/api-fleet?${params}`, {
      headers: await getAuthHeader(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  async getVehicle(id: string): Promise<VehicleInfo> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/${id}`, {
      headers: await getAuthHeader(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  async getWorkLocations(vehicleId: string, date?: string): Promise<WorkLocation[]> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);

    const res = await fetch(
      `${API_URL}/functions/v1/api-fleet/${vehicleId}/work-locations?${params}`,
      { headers: await getAuthHeader() }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  async getVehicleRoute(vehicleId: string, params: {
    date?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<VehicleHistoryPoint[]> {
    const urlParams = new URLSearchParams();
    if (params.date) urlParams.set('date', params.date);
    if (params.start_date) urlParams.set('start_date', params.start_date);
    if (params.end_date) urlParams.set('end_date', params.end_date);

    const res = await fetch(
      `${API_URL}/functions/v1/api-fleet/${vehicleId}/route?${urlParams}`,
      { headers: await getAuthHeader() }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  async setVehicleEmployees(vehicleId: string, employeeIds: string[]): Promise<EmployeeInfo[]> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/${vehicleId}/employees`, {
      method: 'PUT',
      headers: { ...await getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_ids: employeeIds }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data.employees;
  },

  async addVehicleEmployee(vehicleId: string, employeeId: string): Promise<EmployeeInfo[]> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/${vehicleId}/employees`, {
      method: 'POST',
      headers: { ...await getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data.employees;
  },

  async removeVehicleEmployee(vehicleId: string, employeeId: string): Promise<void> {
    const res = await fetch(
      `${API_URL}/functions/v1/api-fleet/${vehicleId}/employees/${employeeId}`,
      { method: 'DELETE', headers: await getAuthHeader() }
    );
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error);
    }
  },
};
```

### React Query Hook

```typescript
// hooks/useFleet.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fleetService } from '@/services/fleetService';

export function useFleet(status?: VehicleStatus) {
  return useQuery({
    queryKey: ['fleet', 'vehicles', status],
    queryFn: () => fleetService.getVehicles(status),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000,
  });
}

export function useWorkLocations(vehicleId: string, date?: string) {
  return useQuery({
    queryKey: ['fleet', 'work-locations', vehicleId, date],
    queryFn: () => fleetService.getWorkLocations(vehicleId, date),
    enabled: !!vehicleId,
  });
}

export function useVehicleRoute(vehicleId: string, date?: string) {
  return useQuery({
    queryKey: ['fleet', 'route', vehicleId, date],
    queryFn: () => fleetService.getVehicleRoute(vehicleId, { date }),
    enabled: !!vehicleId,
  });
}
```

### Status Badge Component

```typescript
// components/fleet/StatusBadge.tsx
const STATUS_CONFIG = {
  moving: { label: 'กำลังวิ่ง', color: 'bg-green-100 text-green-800' },
  stopped: { label: 'จอดนิ่ง', color: 'bg-gray-100 text-gray-800' },
  parked_at_base: { label: 'จอดที่โรงรถ', color: 'bg-blue-100 text-blue-800' },
};

export function StatusBadge({ status }: { status: VehicleStatus }) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
```

---

## Architecture Notes

### Data Flow

```
pg_cron (every 5 min)
       |
       v
   pg_net HTTP POST
       |
       v
api-fleet-sync (Edge Function)
       |
       v
External GPS API
       |
       v
+----------------------------+
| fleet_vehicles (current)   | <-- api-fleet reads from here
| fleet_vehicle_history      | <-- route history stored here
+----------------------------+
```

### Sync Schedule

- **Frequency:** Every 5 minutes via pg_cron
- **Data points per day:** ~288 per vehicle (24 hours * 12 points/hour)
- **History retention:** Configurable (recommended: 30-90 days)

### Garage Detection

Vehicles are marked as `parked_at_base` when they are within the configured radius of any garage location. The distance is calculated using the Haversine formula.

---

## Related APIs

- **api-employees** - Employee management (for employee assignments)
- **api-tickets** - Ticket management (work order data for work locations)
- **api-sites** - Site management (work location coordinates)
- **api-fleet-sync** - Internal function that syncs GPS data (not user-facing)

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-18 | Documented warmup endpoint (GET /warmup) |
| 2026-01-15 | Added vehicle employee management endpoints (PUT/POST/DELETE employees) |
| 2026-01-14 | Added work-locations endpoint |
| 2026-01-12 | Initial release with vehicle tracking and garage management |
