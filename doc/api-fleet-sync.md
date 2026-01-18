# Fleet Sync API (Background Service)

## Overview

`api-fleet-sync` is an internal background synchronization service that automatically pulls real-time GPS data from an external fleet management system (BGFleet) and stores it in the Supabase database. This function is designed to be triggered by `pg_cron` every 5 minutes and is not intended for direct frontend access.

The synced data is then consumed by the `api-fleet` endpoint for real-time vehicle tracking and fleet management.

## Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet-sync
```

## Authentication

**This function does NOT require authentication** as it is designed to be called internally by `pg_cron` scheduler. It should not be exposed to public access.

> **Note**: The function is triggered automatically by the database scheduler. Direct calls are not recommended for normal operations.

## HTTP Methods

The function accepts both GET and POST requests. Both methods trigger the same sync operation.

---

## How It Works

### Data Flow

```
pg_cron (every 5 minutes)
        |
        v
  api-fleet-sync
        |
        v
  BGFleet External API
  (http://bgfleet.loginto.me)
        |
        v
+----------------------------------+
|  Database Storage                |
|  - fleet_vehicles (current)      |
|  - fleet_vehicle_history (route) |
+----------------------------------+
        |
        v
  api-fleet (reads data)
        |
        v
  Frontend Application
```

### Sync Process

1. **Login to External System**: Authenticates with BGFleet GPS tracking system using stored credentials
2. **Fetch Vehicle Data**: Retrieves current GPS positions for all vehicles
3. **Process Each Vehicle**:
   - Parse plate number and driver name from vehicle name
   - Calculate nearest garage and check if vehicle is within garage radius
   - Determine vehicle status (moving, stopped, parked_at_base)
   - Reverse geocode address if vehicle has moved >50 meters
4. **Update Database**:
   - Upsert current vehicle state to `fleet_vehicles`
   - Insert history record to `fleet_vehicle_history` (skip if parked at base)

---

## Endpoints

### GET / POST /api-fleet-sync

Triggers a sync of fleet data from the external GPS system.

**Permission Level**: Internal only (no authentication required, but should be restricted)

**Request Body**: None required (body is ignored)

**Response**:

```json
{
  "data": {
    "synced": 15,
    "history_logged": 8
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `synced` | number | Number of vehicles successfully updated |
| `history_logged` | number | Number of history records created (excludes parked vehicles) |

---

## External API Integration

### BGFleet GPS System

The function integrates with BGFleet mobile tracking API:

- **Login URL**: `http://bgfleet.loginto.me/Tracking/mobile/main.php`
- **Data URL**: `http://bgfleet.loginto.me/Tracking/mobile/ajax_listInfo.php`

### Authentication Flow

1. **Get Session Cookie**: Initial GET request to obtain `PHPSESSID`
2. **Login**: POST with Base64-encoded username and MD5-hashed password
3. **Fetch Data**: GET request with session cookie to retrieve vehicle array

### Raw Data Format

The external API returns an array where each vehicle is represented as:

```javascript
[
  vehicleId,      // [0] Unique ID (string)
  fullName,       // [1] "plate_number driver_name" format
  isMoving,       // [2] 1 or 0
  latitude,       // [3] GPS latitude
  unknown,        // [4] (unused)
  longitude,      // [5] GPS longitude
  unknown,        // [6] (unused)
  speed,          // [7] Current speed (km/h)
  heading,        // [8] Direction (0-360)
  signalStrength  // [9] GPS signal (0-100)
]
```

---

## Database Tables

### fleet_vehicles

Stores the current state of each vehicle (upserted on every sync).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Vehicle ID from external system (PK) |
| `name` | TEXT | Full name from GPS system |
| `plate_number` | TEXT | Parsed plate number |
| `plate_number_override` | TEXT | Manual override for plate number |
| `driver_name` | TEXT | Parsed driver name |
| `driver_name_override` | TEXT | Manual override for driver name |
| `status` | TEXT | `moving`, `stopped`, or `parked_at_base` |
| `latitude` | FLOAT | Current GPS latitude |
| `longitude` | FLOAT | Current GPS longitude |
| `speed` | FLOAT | Current speed (km/h) |
| `heading` | INT | Direction in degrees (0-360) |
| `signal_strength` | INT | GPS signal strength (0-100) |
| `address` | TEXT | Reverse geocoded address (Thai) |
| `current_garage_id` | UUID | FK to `fleet_garages` if parked at base |
| `last_sync_at` | TIMESTAMPTZ | Last successful sync timestamp |
| `updated_at` | TIMESTAMPTZ | Record update timestamp |

### fleet_vehicle_history

Stores historical GPS points for route tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `vehicle_id` | TEXT | FK to `fleet_vehicles` |
| `latitude` | FLOAT | GPS latitude |
| `longitude` | FLOAT | GPS longitude |
| `speed` | FLOAT | Speed at this point |
| `heading` | INT | Direction at this point |
| `status` | TEXT | Status at this point |
| `address` | TEXT | Address at this point |
| `recorded_at` | TIMESTAMPTZ | Timestamp of this record |

**Note**: History is NOT logged when `status = 'parked_at_base'` to conserve database storage.

### fleet_garages

Stores garage/base locations for proximity detection.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Garage name |
| `description` | TEXT | Optional description |
| `latitude` | FLOAT | Garage GPS latitude |
| `longitude` | FLOAT | Garage GPS longitude |
| `radius_meters` | INT | Detection radius (default: 100m) |
| `is_active` | BOOL | Whether garage is active |

---

## Status Detection Logic

### Vehicle Status

| Status | Condition |
|--------|-----------|
| `moving` | External API reports vehicle is moving (speed > 0) |
| `parked_at_base` | Stopped AND within garage radius |
| `stopped` | Stopped AND NOT within any garage radius |

### Garage Proximity

Uses Haversine formula to calculate distance between vehicle and each garage:

```
distance = 2 * R * arcsin(sqrt(sin^2((lat2-lat1)/2) + cos(lat1) * cos(lat2) * sin^2((lng2-lng1)/2)))
```

Where R = 6,371,000 meters (Earth's radius)

Vehicle is considered "at base" if distance <= garage's `radius_meters`.

---

## Address Geocoding

### Google Maps Reverse Geocoding

The function uses Google Maps Geocoding API to convert GPS coordinates to Thai addresses.

**Optimization**:
- Only geocodes if vehicle has moved >50 meters from last known position
- Caches address in database to reduce API calls
- Returns Thai addresses (`language=th`)

**API URL**:
```
https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&language=th&key={API_KEY}
```

---

## Configuration

### Required Environment Variables

```bash
# BGFleet GPS System Credentials
FLEET_USERNAME=your_username
FLEET_PASSWORD=your_password

# Google Maps API Key (optional, for reverse geocoding)
GOOGLE_MAPS_API_KEY=your_api_key

# Cron secret (optional, reserved for future cron authentication)
CRON_SECRET=your_secret
```

### Setting Secrets

```bash
# Set fleet credentials
npx supabase secrets set FLEET_USERNAME=xxx FLEET_PASSWORD=xxx --project-ref ogzyihacqbasolfxymgo

# Set Google Maps API key (optional)
npx supabase secrets set GOOGLE_MAPS_API_KEY=xxx --project-ref ogzyihacqbasolfxymgo

# Set cron secret (optional, for future use)
npx supabase secrets set CRON_SECRET=xxx --project-ref ogzyihacqbasolfxymgo
```

---

## Scheduling (pg_cron)

The function is designed to be called by `pg_cron` every 5 minutes:

```sql
-- Create cron job (run once during setup)
SELECT cron.schedule(
  'fleet-sync',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet-sync',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
```

### Checking Cron Jobs

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- Check recent job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Error Handling

### Error Responses

| HTTP Code | Error | Cause |
|-----------|-------|-------|
| 500 | `Fleet credentials not configured` | Missing `FLEET_USERNAME` or `FLEET_PASSWORD` |
| 500 | `Failed to get initial session cookie` | BGFleet server unreachable or no `set-cookie` header |
| 500 | `Failed to parse session cookie` | `PHPSESSID` not found in cookie header |
| 500 | `Fleet login failed - invalid credentials` | Wrong username/password |
| 500 | `Session expired - got HTML instead of JSON` | Session timeout during fetch |
| 500 | `Invalid response from fleet API` | Unexpected data format (not an array) |
| 500 | `Sync failed` | Generic error (check logs for details) |

### Error Response Format

```json
{
  "error": "Error message here"
}
```

### Logging

The function logs progress to Supabase Edge Function logs:

```
[fleet-sync] Starting sync...
[fleet-sync] Completed: 15 vehicles synced, 8 history records
```

To view logs:

```bash
npx supabase functions logs api-fleet-sync --project-ref ogzyihacqbasolfxymgo
```

Or use MCP:

```typescript
mcp__supabase__get_logs({ service: 'edge-function' })
```

---

## Performance Considerations

### Sync Frequency

- **Every 5 minutes**: 288 data points per vehicle per day
- **Recommended retention**: 30-90 days of history
- **Storage estimation**: ~500 bytes/record = ~140KB/vehicle/day

### Optimization Strategies

1. **Skip history for parked vehicles**: Reduces database writes by ~40%
2. **Geocode only on movement**: Saves API calls when vehicles are stationary
3. **Distance threshold (50m)**: Prevents redundant geocoding for minor GPS drift

---

## Testing

### Manual Trigger

For testing purposes, you can manually trigger the sync using either GET or POST:

```bash
# Using POST
curl -X POST \
  https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet-sync \
  -H "Content-Type: application/json"

# Using GET
curl https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet-sync
```

### Expected Response

```json
{
  "data": {
    "synced": 15,
    "history_logged": 8
  }
}
```

### Verify Data

```sql
-- Check recent vehicle updates
SELECT id, name, plate_number, status, speed, last_sync_at
FROM fleet_vehicles
ORDER BY last_sync_at DESC
LIMIT 10;

-- Check history records
SELECT vehicle_id, status, speed, recorded_at
FROM fleet_vehicle_history
ORDER BY recorded_at DESC
LIMIT 20;
```

---

## Deployment

### Deploy Function

```bash
npx supabase functions deploy api-fleet-sync --no-verify-jwt --project-ref ogzyihacqbasolfxymgo
```

**Note**: The `--no-verify-jwt` flag is required because this function is called internally by pg_cron without authentication.

---

## Related Documentation

- [api-fleet](./api-fleet.md) - Frontend-facing API for reading fleet data
- [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pg_cron)

---

## Architecture Summary

| Component | Purpose |
|-----------|---------|
| **api-fleet-sync** | Background job - fetches and stores GPS data |
| **api-fleet** | REST API - reads stored data for frontend |
| **fleet_vehicles** | Current vehicle states |
| **fleet_vehicle_history** | Historical GPS points for routes |
| **fleet_garages** | Garage locations for base detection |
| **pg_cron** | Scheduler for automatic sync |
