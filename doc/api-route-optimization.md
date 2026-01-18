# Route Optimization API

## Overview

The Route Optimization API (`api-route-optimization`) provides route planning for field service technicians using Google Routes API for distance optimization and AI for intelligent route ordering.

**Key Features:**
- **AI-Powered Optimization**: Uses Claude AI for intelligent route ordering considering appointments and geography
- **Distance-Based Optimization**: Falls back to Google Routes API for shortest travel routes
- **Geographic Clustering**: K-means clustering for multi-route scenarios with workload balancing
- **Manual Adjustment**: Users drag/drop to rearrange stops (appointments are NOT auto-factored)
- **Recalculate After Adjustment**: Get updated travel times for user-arranged order
- **Async Processing**: Polling-based for long-running optimizations
- **Work Estimates**: Manage estimated work duration for tickets

**Important Design Decision:**
> Appointment times are **NOT** factored into route ordering. The API optimizes purely for travel distance. Users should manually rearrange stops in the UI if a ticket's appointment time causes conflicts. After rearranging, users can click "Recalculate" to get updated travel times.

---

## Complete User Flow

```
1. USER SELECTS TICKETS
   - Select date
   - Select garage (starting point)
   - Select tickets to optimize

2. OPTIMIZE (Async)
   POST /optimize/async --> Returns job_id

3. POLL FOR RESULT
   GET /jobs/{job_id} --> Returns status + result (poll every 1-2s)

4. DISPLAY OPTIMIZED ROUTE
   - Show stops with estimated arrival/departure times
   - Flag appointments that may be late

5. USER ADJUSTS (Optional)
   - Drag/drop to rearrange stops
   - Times become unknown until recalculated

6. RECALCULATE (After adjustment)
   POST /calculate --> Returns updated times for user's order

7. DISPLAY UPDATED ROUTE
   - Show recalculated arrival/departure times
```

---

## Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-route-optimization
```

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

---

## Permission Levels

| Level | Roles | Access |
|-------|-------|--------|
| 1+ | Assigner, PM, Sales, Admin | Full access to route optimization |

---

## Endpoints

### POST /optimize/async

Start async route optimization job. Returns immediately with job ID for polling.

**Request Body:**

```json
{
  "date": "2026-01-15",
  "garage_id": "uuid",
  "ticket_ids": ["uuid1", "uuid2"],
  "max_per_route": 10,
  "start_time": "08:00",
  "allow_overtime": true,
  "balance_mode": "balanced"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | Yes | Date in YYYY-MM-DD format |
| `garage_id` | string | Yes | Starting point garage UUID |
| `ticket_ids` | string[] | No | Specific tickets to optimize (default: all tickets for date) |
| `max_per_route` | number | No | Max stops per route (1-50). If set, creates multiple routes |
| `start_time` | string | No | Work start time in HH:MM format (default: "08:00") |
| `allow_overtime` | boolean | No | Allow scheduling past 17:30 (default: true) |
| `balance_mode` | string | No | Route balancing mode: "geography", "workload", or "balanced" (default: "balanced") |

**Response:**

```json
{
  "data": {
    "job_id": "uuid",
    "status": "pending",
    "message": "เริ่มคำนวณเส้นทางแล้ว กรุณาตรวจสอบสถานะ",
    "poll_url": "/api-route-optimization/jobs/{job_id}"
  }
}
```

---

### GET /jobs/:jobId

Poll for job status and result.

**Response (pending/processing):**

```json
{
  "data": {
    "job_id": "uuid",
    "status": "processing",
    "progress": 45,
    "created_at": "2026-01-15T08:00:00Z",
    "started_at": "2026-01-15T08:00:01Z",
    "completed_at": null,
    "result": null,
    "error": null
  }
}
```

**Response (completed):**

```json
{
  "data": {
    "job_id": "uuid",
    "status": "completed",
    "progress": 100,
    "created_at": "2026-01-15T08:00:00Z",
    "started_at": "2026-01-15T08:00:01Z",
    "completed_at": "2026-01-15T08:00:30Z",
    "result": {
      "routes": [...],
      "summary": {...},
      "ai_reasoning": "...",
      "suggestions": [...],
      "optimized_route": [...],
      "google_maps_url": "https://..."
    },
    "error": null
  }
}
```

**Response (failed):**

```json
{
  "data": {
    "job_id": "uuid",
    "status": "failed",
    "progress": 100,
    "created_at": "2026-01-15T08:00:00Z",
    "started_at": "2026-01-15T08:00:01Z",
    "completed_at": "2026-01-15T08:00:05Z",
    "result": null,
    "error": "Error message"
  }
}
```

---

### POST /calculate

Calculate travel times for a user-specified order (NO optimization). Use this after user drags/drops to rearrange stops.

**Request Body:**

```json
{
  "garage_id": "uuid",
  "ticket_ids": ["uuid3", "uuid1", "uuid2"],
  "start_time": "08:00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `garage_id` | string | Yes | Starting point garage UUID |
| `ticket_ids` | string[] | Yes | Tickets in user's desired order |
| `start_time` | string | No | Work start time in HH:MM format (default: "08:00") |

**Response:**

```json
{
  "data": {
    "routes": [
      {
        "route_number": 1,
        "stops": [...],
        "distance_meters": 52000,
        "travel_minutes": 140,
        "work_minutes": 360,
        "duration_minutes": 500,
        "start_time": "08:00",
        "end_time": "16:20",
        "overtime_stops": 0,
        "google_maps_url": "https://www.google.com/maps/dir/..."
      }
    ],
    "summary": {
      "total_stops": 5,
      "total_distance_meters": 52000,
      "total_travel_minutes": 140,
      "total_work_minutes": 360,
      "total_duration_minutes": 500,
      "start_time": "08:00",
      "end_time": "16:20",
      "overtime_stops": 0,
      "start_location": {
        "id": "uuid",
        "name": "Main Garage",
        "latitude": 13.7563,
        "longitude": 100.5018
      }
    },
    "optimized_route": [...],
    "google_maps_url": "https://..."
  }
}
```

---

### POST /optimize (Sync - Legacy)

Synchronous optimization. Can be slow (~60s). Prefer `/optimize/async` for better UX.

**Request Body:** Same as `/optimize/async`

**Response:** Returns result directly instead of job ID:

```json
{
  "data": {
    "routes": [...],
    "summary": {...},
    "ai_reasoning": "...",
    "suggestions": [...],
    "optimized_route": [...],
    "google_maps_url": "https://..."
  }
}
```

---

## Work Estimates Endpoints

### GET /work-estimates/ticket/:ticketId

Get work estimate for a specific ticket.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "ticket_id": "uuid",
    "estimated_minutes": 60,
    "notes": "Standard PM service",
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-01-15T08:00:00Z",
    "ticket_code": "TKT-001",
    "site_name": "Customer Site A",
    "work_type_name": "PM"
  }
}
```

**Errors:**
- 404: Work estimate not found for the specified ticket

---

### GET /work-estimates/date/:date

Get all work estimates for tickets scheduled on a specific date.

**Parameters:**
- `date` - Date in YYYY-MM-DD format

**Response:**

```json
{
  "data": [
    {
      "ticket_id": "uuid",
      "ticket_code": "TKT-001",
      "site_name": "Customer Site A",
      "work_type_name": "PM",
      "work_estimate": {
        "id": "uuid",
        "estimated_minutes": 60,
        "notes": "Standard PM service"
      }
    },
    {
      "ticket_id": "uuid2",
      "ticket_code": "TKT-002",
      "site_name": "Customer Site B",
      "work_type_name": "Installation",
      "work_estimate": null
    }
  ]
}
```

**Errors:**
- 400: Invalid date format (must be YYYY-MM-DD)

---

### POST /work-estimates

Create or update work estimate for a ticket.

**Request Body:**

```json
{
  "ticket_id": "uuid",
  "estimated_minutes": 60,
  "notes": "Standard PM service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | string | Yes | Ticket UUID |
| `estimated_minutes` | number | Yes | Estimated work duration (1-480 minutes) |
| `notes` | string | No | Optional notes |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "ticket_id": "uuid",
    "estimated_minutes": 60,
    "notes": "Standard PM service",
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-01-15T08:00:00Z",
    "is_new": true
  }
}
```

**Errors:**
- 400: Missing ticket_id or invalid estimated_minutes (must be 1-480)
- 404: Ticket not found

---

### POST /work-estimates/bulk

Bulk create/update work estimates for multiple tickets.

**Request Body:**

```json
{
  "estimates": [
    {
      "ticket_id": "uuid1",
      "estimated_minutes": 60,
      "notes": "Standard PM"
    },
    {
      "ticket_id": "uuid2",
      "estimated_minutes": 90,
      "notes": "Extended service"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `estimates` | array | Yes | Array of work estimate objects (max 100) |
| `estimates[].ticket_id` | string | Yes | Ticket UUID |
| `estimates[].estimated_minutes` | number | Yes | Estimated work duration (1-480 minutes) |
| `estimates[].notes` | string | No | Optional notes |

**Response:**

```json
{
  "data": {
    "created": 2,
    "updated": 1,
    "errors": [
      {
        "ticket_id": "uuid3",
        "error": "เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที"
      }
    ]
  }
}
```

**Errors:**
- 400: Missing or invalid estimates array, empty array, or more than 100 items

---

### DELETE /work-estimates/ticket/:ticketId

Delete work estimate for a ticket.

**Response:**

```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

---

## Data Types

### OptimizedStop

```typescript
interface OptimizedStop {
  order: number;                    // Stop order (1-based)
  ticket_id: string;                // Ticket UUID
  ticket_code: string | null;       // Ticket code (e.g., "PDE-123")
  site_name: string;                // Site name
  latitude: number;                 // Site latitude
  longitude: number;                // Site longitude
  address: string | null;           // Site address
  appointment: AppointmentInfo;     // Appointment details
  work_type: string | null;         // Work type name

  // Timing fields
  estimated_arrival: string | null;   // Arrival time (HH:MM)
  work_start: string | null;          // When work begins (may differ from arrival)
  work_end: string | null;            // When work completes
  estimated_departure: string | null; // Departure time (HH:MM)

  // Duration fields
  travel_time_minutes: number;        // Travel time to this stop
  work_duration_minutes: number;      // Work duration at this stop
  wait_time_minutes: number;          // Idle time (e.g., waiting for appointment window)
  distance_meters: number;            // Distance to this stop

  // Status fields
  is_overtime: boolean;               // True if departure is after 17:30
  lunch_break?: LunchBreakInfo;       // Present if lunch taken at/before this stop
  appointment_status: AppointmentStatus;
  is_return?: boolean;                // True for final "return to garage" stop
}
```

### AppointmentInfo

```typescript
interface AppointmentInfo {
  date: string;
  time_start: string | null;
  time_end: string | null;
  type: string | null;
}
```

### AppointmentStatus

```typescript
type AppointmentStatus = 'on_time' | 'early_wait' | 'late' | 'no_window';
```

| Status | Description |
|--------|-------------|
| `on_time` | Arrival within appointment window |
| `early_wait` | Arrived before appointment window, waiting |
| `late` | Arrived after appointment window end |
| `no_window` | No appointment time window specified |

### LunchBreakInfo

```typescript
interface LunchBreakInfo {
  start: string;   // HH:MM format
  end: string;     // HH:MM format
  duration: number; // Duration in minutes
}
```

### SingleRoute

```typescript
interface SingleRoute {
  route_number: number;           // Route number (1-based)
  stops: OptimizedStop[];         // Stops in this route
  distance_meters: number;        // Total distance for this route
  travel_minutes: number;         // Total travel time
  work_minutes: number;           // Total work time
  duration_minutes: number;       // Total duration (travel + work)
  start_time: string;             // Route start time
  end_time: string;               // Route end time
  overtime_stops: number;         // Count of overtime stops
  google_maps_url: string | null; // Google Maps navigation URL (round-trip)
}
```

### RouteSummary

```typescript
interface RouteSummary {
  total_stops: number;
  total_distance_meters: number;
  total_travel_minutes: number;
  total_work_minutes: number;
  total_duration_minutes: number;
  start_time: string;
  end_time: string;
  overtime_stops: number;
  start_location: StartLocation;
  balance?: BalanceMetrics;       // Present when multiple routes
}
```

### BalanceMetrics

```typescript
interface BalanceMetrics {
  coefficient_of_variation: number;  // CV as percentage
  is_balanced: boolean;              // CV < target threshold (20%)
  workloads: number[];               // Workload per route (minutes)
  mean_workload: number;             // Average workload
  standard_deviation: number;        // Std dev of workloads
}
```

### TimeSuggestion

AI may suggest changing appointment times to optimize routes:

```typescript
interface TimeSuggestion {
  ticket_id: string;
  ticket_code: string | null;
  site_name: string;
  current_time: string;       // Current appointment time
  suggested_time: string;     // Suggested new time
  reason: string;             // Reason in Thai
  savings_minutes: number;    // Estimated time saved
}
```

### Overtime Detection

Stops are marked as overtime (`is_overtime: true`) if `estimated_departure` is after 17:30.

---

## Multi-Route Optimization

When `max_per_route` is specified, tickets are grouped using different strategies based on `balance_mode`:

### Balance Modes

| Mode | Description |
|------|-------------|
| `geography` | Pure K-means clustering - optimal geography, ignores workload |
| `workload` | First-Fit Decreasing bin-packing - optimal workload balance, ignores geography |
| `balanced` | Hybrid approach - good geography + good workload (default) |

### Optimization Flow

1. **Clustering**: Tickets grouped into clusters using K-means++ initialization
2. **Balancing**: Apply balance mode strategy (geography/workload/balanced)
3. **Sorting**: Clusters sorted by distance from garage (nearest first)
4. **AI Optimization**: Each cluster optimized using Claude AI (falls back to Google Routes API)
5. **Result**: Multiple routes, each with Google Maps URL and timing details

**Example:** 12 tickets with `max_per_route: 5` creates 3 routes (~4 stops each).

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | Invalid date format, missing required fields, invalid time format |
| 404 | NotFoundError | Garage not found, job not found, ticket not found |
| 503 | RoutesApiError | Google Routes API failure |

---

## Frontend Implementation Guide

### 1. Optimize Button

```typescript
async function handleOptimize() {
  // Start async job
  const { data } = await api.post('/optimize/async', {
    date: selectedDate,
    garage_id: selectedGarage,
    ticket_ids: selectedTickets,
    start_time: '08:00'
  });

  // Poll for result
  const result = await pollForResult(data.job_id);
  setRoute(result.optimized_route);

  // Show AI reasoning if available
  if (result.ai_reasoning) {
    setAiReasoning(result.ai_reasoning);
  }

  // Show suggestions if available
  if (result.suggestions?.length > 0) {
    setSuggestions(result.suggestions);
  }
}

async function pollForResult(jobId: string) {
  while (true) {
    const { data } = await api.get(`/jobs/${jobId}`);

    if (data.status === 'completed') return data.result;
    if (data.status === 'failed') throw new Error(data.error);

    setProgress(data.progress);
    await sleep(1500); // Poll every 1.5 seconds
  }
}
```

### 2. Drag and Drop

```typescript
function handleDragEnd(result) {
  const newOrder = reorder(route, result.source.index, result.destination.index);
  setRoute(newOrder);
  setNeedsRecalculate(true); // Show "Recalculate" button
}
```

### 3. Recalculate Button

```typescript
async function handleRecalculate() {
  const ticketIds = route.map(stop => stop.ticket_id);

  const { data } = await api.post('/calculate', {
    garage_id: selectedGarage,
    ticket_ids: ticketIds, // In user's arranged order
    start_time: '08:00'
  });

  setRoute(data.optimized_route);
  setNeedsRecalculate(false);
}
```

### 4. Work Estimates Management

```typescript
// Get estimates for a date
const { data: estimates } = await api.get(`/work-estimates/date/${selectedDate}`);

// Update single estimate
await api.post('/work-estimates', {
  ticket_id: ticketId,
  estimated_minutes: 60,
  notes: 'Standard service'
});

// Bulk update estimates
await api.post('/work-estimates/bulk', {
  estimates: [
    { ticket_id: 'uuid1', estimated_minutes: 45 },
    { ticket_id: 'uuid2', estimated_minutes: 90 }
  ]
});
```

---

## Notes

- Maximum 100 waypoints per request
- Google Routes API supports up to 25 waypoints per route
- Routes are optimized for travel distance, with AI considering appointment times
- Work duration defaults to 0 if no estimate exists
- **Round-trip routes**: All Google Maps URLs return to the starting garage
- **Tickets without coordinates are excluded**: Sites must have lat/long to be included
- **Manual adjustment**: Users drag/drop stops, then click "Recalculate" for updated times
- **Lunch break handling**: Routes account for 12:00-13:00 lunch break (60 minutes)
- **Balance metrics**: Use Coefficient of Variation (CV) - CV < 15% is excellent, CV < 25% is acceptable
