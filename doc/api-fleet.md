# Fleet Management API

## Overview
Real-time vehicle tracking API that fetches GPS data from external fleet management system, stores in database, and provides garage/base detection.

## Base URL
```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet
```

## Authentication
Requires valid JWT token in Authorization header.
```
Authorization: Bearer <token>
```

## Endpoints

### Vehicles

#### GET /api-fleet
List all vehicles with real-time GPS data.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `group` | string | `-1` | Vehicle group ID. Use `-1` for all groups |

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
        { "id": "uuid", "name": "สมชาย ใจดี" },
        { "id": "uuid", "name": "สมหญิง ดีใจ" }
      ],
      "status": "parked_at_base",
      "latitude": 13.7325,
      "longitude": 100.7309,
      "speed": 0,
      "heading": 140,
      "signal_strength": 100,
      "address": "123 ถนนสุขุมวิท แขวงบางจาก เขตพระโขนง กรุงเทพมหานคร 10260",
      "garage": {
        "id": "uuid",
        "name": "สำนักงานใหญ่ PDE",
        "distance_meters": 15
      },
      "last_sync_at": "2026-01-12T08:00:00Z"
    }
  ]
}
```

#### GET /api-fleet/:id
Get single vehicle by ID.

#### PUT /api-fleet/:id
Update vehicle (Level 2+). Currently supports updating driver name override.

**Request Body:**
```json
{
  "driver_name_override": "คุณสมชาย ใจดี"
}
```

#### GET /api-fleet/:id/route
Get route history for a vehicle. Data is logged every 5 minutes (288 points/day).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string | today | Single date in YYYY-MM-DD format |
| `start_date` | string | - | Start datetime for range query |
| `end_date` | string | - | End datetime for range query |

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
      "recorded_at": "2026-01-12T08:00:00Z"
    },
    {
      "latitude": 13.7350,
      "longitude": 100.7320,
      "speed": 0,
      "heading": 180,
      "status": "stopped",
      "address": "ซอยสุขุมวิท 77 กรุงเทพมหานคร",
      "recorded_at": "2026-01-12T08:05:00Z"
    }
  ]
}
```

#### GET /api-fleet/:id/work-locations
Get work locations for a vehicle based on assigned tickets. Returns site coordinates for all employees assigned to this vehicle.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string | today | Date in YYYY-MM-DD format |

**Response:**
```json
{
  "data": [
    {
      "ticket_id": "uuid",
      "ticket_code": "TK-2026-0001",
      "site_id": "uuid",
      "site_name": "บริษัท ABC จำกัด",
      "latitude": 13.7500,
      "longitude": 100.5000,
      "address_detail": "123 ถนนสุขุมวิท",
      "appointment_date": "2026-01-14",
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

### Vehicle Employees

#### PUT /api-fleet/:id/employees
Set all employees for a vehicle (replaces existing assignments). Level 2+ required.

**Request Body:**
```json
{
  "employee_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response:**
```json
{
  "data": {
    "employees": [
      { "id": "uuid-1", "name": "สมชาย ใจดี" },
      { "id": "uuid-2", "name": "สมหญิง ดีใจ" },
      { "id": "uuid-3", "name": "ณรงค์ชัย ฤทธิ์เรือง" }
    ]
  }
}
```

#### POST /api-fleet/:id/employees
Add a single employee to a vehicle. Level 2+ required.

**Request Body:**
```json
{
  "employee_id": "uuid"
}
```

**Response:**
```json
{
  "data": {
    "employees": [
      { "id": "uuid-1", "name": "สมชาย ใจดี" },
      { "id": "uuid-2", "name": "สมหญิง ดีใจ" }
    ]
  }
}
```

#### DELETE /api-fleet/:id/employees/:employeeId
Remove an employee from a vehicle. Level 2+ required.

**Response:**
```json
{
  "data": {
    "message": "ลบพนักงานออกจากรถสำเร็จ"
  }
}
```

### Garages

#### GET /api-fleet/garages
List all garages/bases.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
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

#### POST /api-fleet/garages
Create a new garage (Level 2+).

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

#### PUT /api-fleet/garages/:id
Update a garage (Level 2+).

#### DELETE /api-fleet/garages/:id
Delete a garage (Level 2+).

## Data Types

### VehicleInfo
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique vehicle identifier |
| `name` | string | Full name (plate + driver) |
| `plate_number` | string \| null | Vehicle plate number |
| `driver_name` | string \| null | Driver name |
| `employees` | EmployeeInfo[] | Employees assigned to this vehicle |
| `status` | `"moving"` \| `"stopped"` \| `"parked_at_base"` | Current status |
| `latitude` | number | GPS latitude |
| `longitude` | number | GPS longitude |
| `speed` | number | Current speed (km/h) |
| `heading` | number | Direction (0-360 degrees) |
| `signal_strength` | number | GPS signal (0-100%) |
| `address` | string \| null | Reverse geocoded address (Thai) |
| `garage` | GarageInfo \| null | Garage info if parked at base |
| `last_sync_at` | string | Last sync timestamp |

### EmployeeInfo
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Employee UUID |
| `name` | string | Employee name |

### GarageInfo
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Garage UUID |
| `name` | string | Garage name |
| `distance_meters` | number | Distance from vehicle to garage |

### WorkLocation
| Field | Type | Description |
|-------|------|-------------|
| `ticket_id` | string | Ticket UUID |
| `ticket_code` | string \| null | Ticket code (e.g., TK-2026-0001) |
| `site_id` | string | Site UUID |
| `site_name` | string | Site/customer name |
| `latitude` | number \| null | Site latitude |
| `longitude` | number \| null | Site longitude |
| `address_detail` | string \| null | Site address |
| `appointment_date` | string \| null | Appointment date (YYYY-MM-DD) |
| `appointment_time_start` | string \| null | Start time (HH:MM) |
| `appointment_time_end` | string \| null | End time (HH:MM) |
| `work_type_code` | string \| null | Work type code |
| `work_type_name` | string \| null | Work type name (Thai) |
| `status_code` | string \| null | Ticket status code |
| `status_name` | string \| null | Ticket status name (Thai) |

### Status Values
| Status | Thai | Description |
|--------|------|-------------|
| `moving` | กำลังวิ่ง | Vehicle is moving (speed > 0) |
| `stopped` | จอดนิ่ง | Vehicle stopped, not at any garage |
| `parked_at_base` | จอดที่โรงรถ | Vehicle parked within garage radius |

## Database Tables

### fleet_vehicles
Stores synced vehicle data from external GPS system.

### fleet_garages
Stores garage/base locations with detection radius.

### fleet_vehicle_history
Stores historical tracking data (optional).

### jct_fleet_vehicle_employees
Junction table for many-to-many relationship between vehicles and employees.

| Column | Type | Description |
|--------|------|-------------|
| `vehicle_id` | TEXT | Vehicle ID (FK to fleet_vehicles) |
| `employee_id` | UUID | Employee ID (FK to main_employees) |
| `created_at` | TIMESTAMPTZ | Assignment timestamp |

**Composite Primary Key**: (vehicle_id, employee_id)

## Configuration

### Required Secrets
```bash
# Fleet GPS system credentials
npx supabase secrets set FLEET_USERNAME=xxx FLEET_PASSWORD=xxx

# Google Maps API key for reverse geocoding (optional)
npx supabase secrets set GOOGLE_MAPS_API_KEY=xxx
```

## TypeScript Interface

```typescript
type VehicleStatus = 'moving' | 'stopped' | 'parked_at_base';

interface EmployeeInfo {
  id: string;
  name: string;
}

interface GarageInfo {
  id: string;
  name: string;
  distance_meters: number;
}

interface VehicleInfo {
  id: string;
  name: string;
  plate_number: string | null;
  driver_name: string | null;
  employees: EmployeeInfo[];
  status: VehicleStatus;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  signal_strength: number;
  address: string | null;
  garage: GarageInfo | null;
  last_sync_at: string;
}

interface WorkLocation {
  ticket_id: string;
  ticket_code: string | null;
  site_id: string;
  site_name: string;
  latitude: number | null;
  longitude: number | null;
  address_detail: string | null;
  appointment_date: string | null;
  appointment_time_start: string | null;
  appointment_time_end: string | null;
  work_type_code: string | null;
  work_type_name: string | null;
  status_code: string | null;
  status_name: string | null;
}
```

## Usage Examples

### React Query Hook
```typescript
export function useFleet(group = '-1') {
  return useQuery({
    queryKey: ['fleet', group],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/api-fleet?group=${group}`,
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );
      const json = await res.json();
      return json.data as VehicleInfo[];
    },
    refetchInterval: 30000,
  });
}
```

### Vehicle Status Badge
```typescript
function StatusBadge({ status }: { status: VehicleStatus }) {
  const config = {
    moving: { label: 'กำลังวิ่ง', color: 'green' },
    stopped: { label: 'จอดนิ่ง', color: 'gray' },
    parked_at_base: { label: 'จอดที่โรงรถ', color: 'blue' },
  };
  const { label, color } = config[status];
  return <Badge color={color}>{label}</Badge>;
}
```

### Filter Vehicles at Base
```typescript
const vehiclesAtBase = vehicles.filter(v => v.status === 'parked_at_base');
const vehiclesOnRoad = vehicles.filter(v => v.status !== 'parked_at_base');
```

## Frontend Implementation Guide

### API Service
```typescript
// services/fleetService.ts
import { supabase } from '@/lib/supabase';

const API_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Authorization': `Bearer ${session?.access_token}` };
}

export const fleetService = {
  // Get all vehicles
  async getVehicles(group = '-1'): Promise<VehicleInfo[]> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet?group=${group}`, {
      headers: await getAuthHeader(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  // Get all garages
  async getGarages(): Promise<GarageDetail[]> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/garages`, {
      headers: await getAuthHeader(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  // Create garage
  async createGarage(input: GarageInput): Promise<{ id: string; name: string }> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/garages`, {
      method: 'POST',
      headers: { ...await getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  // Update garage
  async updateGarage(id: string, input: Partial<GarageInput>): Promise<{ id: string; name: string }> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/garages/${id}`, {
      method: 'PUT',
      headers: { ...await getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  },

  // Delete garage
  async deleteGarage(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/garages/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeader(),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error);
    }
  },

  // Get work locations for a vehicle
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

  // Set employees for a vehicle (replaces all)
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

  // Add employee to a vehicle
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

  // Remove employee from a vehicle
  async removeVehicleEmployee(vehicleId: string, employeeId: string): Promise<void> {
    const res = await fetch(`${API_URL}/functions/v1/api-fleet/${vehicleId}/employees/${employeeId}`, {
      method: 'DELETE',
      headers: await getAuthHeader(),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error);
    }
  },
};
```

### React Query Hooks
```typescript
// hooks/useFleet.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fleetService } from '@/services/fleetService';

export function useFleet(group = '-1') {
  return useQuery({
    queryKey: ['fleet', 'vehicles', group],
    queryFn: () => fleetService.getVehicles(group),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000,
  });
}

export function useGarages() {
  return useQuery({
    queryKey: ['fleet', 'garages'],
    queryFn: () => fleetService.getGarages(),
  });
}

export function useCreateGarage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fleetService.createGarage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });
}

export function useUpdateGarage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<GarageInput> }) =>
      fleetService.updateGarage(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });
}

export function useDeleteGarage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fleetService.deleteGarage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });
}

export function useWorkLocations(vehicleId: string, date?: string) {
  return useQuery({
    queryKey: ['fleet', 'work-locations', vehicleId, date],
    queryFn: () => fleetService.getWorkLocations(vehicleId, date),
    enabled: !!vehicleId,
  });
}

export function useSetVehicleEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, employeeIds }: { vehicleId: string; employeeIds: string[] }) =>
      fleetService.setVehicleEmployees(vehicleId, employeeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });
}

export function useAddVehicleEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, employeeId }: { vehicleId: string; employeeId: string }) =>
      fleetService.addVehicleEmployee(vehicleId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });
}

export function useRemoveVehicleEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, employeeId }: { vehicleId: string; employeeId: string }) =>
      fleetService.removeVehicleEmployee(vehicleId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });
}
```

### Vehicle List Component
```typescript
// components/fleet/VehicleList.tsx
import { useFleet } from '@/hooks/useFleet';

const STATUS_CONFIG = {
  moving: { label: 'กำลังวิ่ง', color: 'bg-green-100 text-green-800', icon: '🚗' },
  stopped: { label: 'จอดนิ่ง', color: 'bg-gray-100 text-gray-800', icon: '🅿️' },
  parked_at_base: { label: 'จอดที่โรงรถ', color: 'bg-blue-100 text-blue-800', icon: '🏠' },
};

export function VehicleList() {
  const { data: vehicles, isLoading, error } = useFleet();

  if (isLoading) return <div>กำลังโหลด...</div>;
  if (error) return <div>เกิดข้อผิดพลาด: {error.message}</div>;

  const atBase = vehicles?.filter(v => v.status === 'parked_at_base') || [];
  const onRoad = vehicles?.filter(v => v.status !== 'parked_at_base') || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          title="รถทั้งหมด"
          count={vehicles?.length || 0}
          color="blue"
        />
        <SummaryCard
          title="กำลังวิ่ง"
          count={vehicles?.filter(v => v.status === 'moving').length || 0}
          color="green"
        />
        <SummaryCard
          title="จอดที่โรงรถ"
          count={atBase.length}
          color="purple"
        />
      </div>

      {/* Vehicle List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">รายการรถ</h2>
        </div>
        <div className="divide-y">
          {vehicles?.map((vehicle) => (
            <VehicleRow key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VehicleRow({ vehicle }: { vehicle: VehicleInfo }) {
  const status = STATUS_CONFIG[vehicle.status];

  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex items-center space-x-4">
        <span className="text-2xl">{status.icon}</span>
        <div>
          <div className="font-medium">{vehicle.plate_number || vehicle.name}</div>
          <div className="text-sm text-gray-500">{vehicle.driver_name}</div>
          {vehicle.address && (
            <div className="text-xs text-gray-400 mt-1">{vehicle.address}</div>
          )}
        </div>
      </div>
      <div className="text-right">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
        {vehicle.garage && (
          <div className="text-xs text-blue-600 mt-1">
            📍 {vehicle.garage.name} ({vehicle.garage.distance_meters}m)
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">
          {vehicle.speed} km/h
        </div>
      </div>
    </div>
  );
}
```

### Google Maps Integration
```typescript
// components/fleet/FleetMap.tsx
import { GoogleMap, Marker, Circle, InfoWindow } from '@react-google-maps/api';
import { useFleet, useGarages } from '@/hooks/useFleet';
import { useState } from 'react';

const mapContainerStyle = { width: '100%', height: '500px' };
const defaultCenter = { lat: 13.7563, lng: 100.5018 }; // Bangkok

const VEHICLE_ICONS = {
  moving: '/icons/truck-green.png',
  stopped: '/icons/truck-gray.png',
  parked_at_base: '/icons/truck-blue.png',
};

export function FleetMap() {
  const { data: vehicles } = useFleet();
  const { data: garages } = useGarages();
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleInfo | null>(null);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={defaultCenter}
      zoom={11}
    >
      {/* Garage circles */}
      {garages?.map((garage) => (
        <Circle
          key={garage.id}
          center={{ lat: garage.latitude, lng: garage.longitude }}
          radius={garage.radius_meters}
          options={{
            fillColor: '#3B82F6',
            fillOpacity: 0.1,
            strokeColor: '#3B82F6',
            strokeOpacity: 0.8,
            strokeWeight: 2,
          }}
        />
      ))}

      {/* Garage markers */}
      {garages?.map((garage) => (
        <Marker
          key={`garage-${garage.id}`}
          position={{ lat: garage.latitude, lng: garage.longitude }}
          icon={{
            url: '/icons/garage.png',
            scaledSize: new google.maps.Size(32, 32),
          }}
          title={garage.name}
        />
      ))}

      {/* Vehicle markers */}
      {vehicles?.map((vehicle) => (
        <Marker
          key={vehicle.id}
          position={{ lat: vehicle.latitude, lng: vehicle.longitude }}
          icon={{
            url: VEHICLE_ICONS[vehicle.status],
            scaledSize: new google.maps.Size(40, 40),
            rotation: vehicle.heading,
          }}
          onClick={() => setSelectedVehicle(vehicle)}
        />
      ))}

      {/* Info window */}
      {selectedVehicle && (
        <InfoWindow
          position={{ lat: selectedVehicle.latitude, lng: selectedVehicle.longitude }}
          onCloseClick={() => setSelectedVehicle(null)}
        >
          <div className="p-2">
            <div className="font-bold">{selectedVehicle.plate_number}</div>
            <div className="text-sm">{selectedVehicle.driver_name}</div>
            <div className="text-sm text-gray-500">
              {selectedVehicle.speed} km/h
            </div>
            {selectedVehicle.address && (
              <div className="text-xs text-gray-400 mt-1">
                {selectedVehicle.address}
              </div>
            )}
            {selectedVehicle.garage && (
              <div className="text-xs text-blue-600 mt-1">
                🏠 {selectedVehicle.garage.name}
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
```

### Garage Management Component
```typescript
// components/fleet/GarageManager.tsx
import { useGarages, useCreateGarage, useDeleteGarage } from '@/hooks/useFleet';
import { useState } from 'react';

export function GarageManager() {
  const { data: garages, isLoading } = useGarages();
  const createGarage = useCreateGarage();
  const deleteGarage = useDeleteGarage();
  const [isAdding, setIsAdding] = useState(false);

  const handleCreate = async (input: GarageInput) => {
    await createGarage.mutateAsync(input);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('ต้องการลบโรงรถนี้?')) {
      await deleteGarage.mutateAsync(id);
    }
  };

  if (isLoading) return <div>กำลังโหลด...</div>;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">จัดการโรงรถ</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          + เพิ่มโรงรถ
        </button>
      </div>

      <div className="divide-y">
        {garages?.map((garage) => (
          <div key={garage.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{garage.name}</div>
              <div className="text-sm text-gray-500">{garage.description}</div>
              <div className="text-xs text-gray-400">
                พิกัด: {garage.latitude}, {garage.longitude} |
                รัศมี: {garage.radius_meters}m
              </div>
            </div>
            <button
              onClick={() => handleDelete(garage.id)}
              className="text-red-600 hover:text-red-800"
            >
              ลบ
            </button>
          </div>
        ))}
      </div>

      {isAdding && (
        <GarageForm
          onSubmit={handleCreate}
          onCancel={() => setIsAdding(false)}
          isLoading={createGarage.isPending}
        />
      )}
    </div>
  );
}

function GarageForm({ onSubmit, onCancel, isLoading }: {
  onSubmit: (input: GarageInput) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    latitude: 13.7325,
    longitude: 100.7309,
    radius_meters: 100,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">เพิ่มโรงรถใหม่</h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="ชื่อโรงรถ"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="รายละเอียด"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <input
            type="number"
            placeholder="รัศมี (เมตร)"
            value={form.radius_meters}
            onChange={(e) => setForm({ ...form, radius_meters: parseInt(e.target.value) })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg">
            ยกเลิก
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={isLoading || !form.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Types Definition
```typescript
// types/fleet.ts
export type VehicleStatus = 'moving' | 'stopped' | 'parked_at_base';

export interface EmployeeInfo {
  id: string;
  name: string;
}

export interface GarageInfo {
  id: string;
  name: string;
  distance_meters: number;
}

export interface VehicleInfo {
  id: string;
  name: string;
  plate_number: string | null;
  driver_name: string | null;
  employees: EmployeeInfo[];
  status: VehicleStatus;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  signal_strength: number;
  address: string | null;
  garage: GarageInfo | null;
  last_sync_at: string;
}

export interface WorkLocation {
  ticket_id: string;
  ticket_code: string | null;
  site_id: string;
  site_name: string;
  latitude: number | null;
  longitude: number | null;
  address_detail: string | null;
  appointment_date: string | null;
  appointment_time_start: string | null;
  appointment_time_end: string | null;
  work_type_code: string | null;
  work_type_name: string | null;
  status_code: string | null;
  status_name: string | null;
}

export interface GarageDetail {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export interface GarageInput {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
}

export interface VehicleHistoryPoint {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  status: VehicleStatus;
  address: string | null;
  recorded_at: string;
}
```

### Route History Hook
```typescript
// hooks/useVehicleRoute.ts
import { useQuery } from '@tanstack/react-query';
import { fleetService } from '@/services/fleetService';

export function useVehicleRoute(vehicleId: string, date?: string) {
  return useQuery({
    queryKey: ['fleet', 'route', vehicleId, date],
    queryFn: () => fleetService.getVehicleRoute(vehicleId, date),
    enabled: !!vehicleId,
  });
}

// Add to fleetService.ts
async getVehicleRoute(vehicleId: string, date?: string): Promise<VehicleHistoryPoint[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);

  const res = await fetch(
    `${API_URL}/functions/v1/api-fleet/${vehicleId}/route?${params}`,
    { headers: await getAuthHeader() }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}
```

### Route Map Component
```typescript
// components/fleet/VehicleRouteMap.tsx
import { GoogleMap, Polyline, Marker, InfoWindow } from '@react-google-maps/api';
import { useVehicleRoute } from '@/hooks/useVehicleRoute';
import { useState } from 'react';

interface Props {
  vehicleId: string;
  vehicleName: string;
  date: string; // YYYY-MM-DD
}

export function VehicleRouteMap({ vehicleId, vehicleName, date }: Props) {
  const { data: route, isLoading } = useVehicleRoute(vehicleId, date);
  const [selectedPoint, setSelectedPoint] = useState<VehicleHistoryPoint | null>(null);

  if (isLoading) return <div>กำลังโหลดเส้นทาง...</div>;
  if (!route?.length) return <div>ไม่พบข้อมูลเส้นทาง</div>;

  // Create path from route points
  const path = route.map(p => ({ lat: p.latitude, lng: p.longitude }));

  // Center on first point
  const center = path[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          เส้นทาง {vehicleName} - {date}
        </h3>
        <div className="text-sm text-gray-500">
          {route.length} จุด (ทุก 5 นาที)
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '500px' }}
        center={center}
        zoom={13}
      >
        {/* Route polyline */}
        <Polyline
          path={path}
          options={{
            strokeColor: '#3B82F6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
          }}
        />

        {/* Start marker (green) */}
        <Marker
          position={path[0]}
          icon={{
            url: '/icons/marker-start.png',
            scaledSize: new google.maps.Size(32, 32),
          }}
          title="จุดเริ่มต้น"
          onClick={() => setSelectedPoint(route[0])}
        />

        {/* End marker (red) */}
        <Marker
          position={path[path.length - 1]}
          icon={{
            url: '/icons/marker-end.png',
            scaledSize: new google.maps.Size(32, 32),
          }}
          title="จุดสิ้นสุด"
          onClick={() => setSelectedPoint(route[route.length - 1])}
        />

        {/* Stop markers (gray) - only show stopped points */}
        {route
          .filter((p, i) => p.status === 'stopped' && i > 0 && i < route.length - 1)
          .map((point, i) => (
            <Marker
              key={i}
              position={{ lat: point.latitude, lng: point.longitude }}
              icon={{
                url: '/icons/marker-stop.png',
                scaledSize: new google.maps.Size(24, 24),
              }}
              onClick={() => setSelectedPoint(point)}
            />
          ))}

        {/* Info window */}
        {selectedPoint && (
          <InfoWindow
            position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
            onCloseClick={() => setSelectedPoint(null)}
          >
            <div className="p-2 min-w-[200px]">
              <div className="font-semibold">
                {new Date(selectedPoint.recorded_at).toLocaleTimeString('th-TH')}
              </div>
              <div className="text-sm text-gray-600">
                {selectedPoint.speed} km/h | {getStatusLabel(selectedPoint.status)}
              </div>
              {selectedPoint.address && (
                <div className="text-xs text-gray-500 mt-1">
                  {selectedPoint.address}
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Route timeline */}
      <RouteTimeline route={route} />
    </div>
  );
}

function RouteTimeline({ route }: { route: VehicleHistoryPoint[] }) {
  // Group by hour
  const hourlyGroups = route.reduce((acc, point) => {
    const hour = new Date(point.recorded_at).getHours();
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(point);
    return acc;
  }, {} as Record<number, VehicleHistoryPoint[]>);

  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h4 className="font-semibold mb-3">สรุปเส้นทางรายชั่วโมง</h4>
      <div className="space-y-2">
        {Object.entries(hourlyGroups).map(([hour, points]) => {
          const moving = points.filter(p => p.status === 'moving').length;
          const stopped = points.filter(p => p.status !== 'moving').length;
          const avgSpeed = points.reduce((sum, p) => sum + p.speed, 0) / points.length;

          return (
            <div key={hour} className="flex items-center text-sm">
              <div className="w-16 font-medium">{hour}:00</div>
              <div className="flex-1 flex items-center space-x-4">
                <span className="text-green-600">{moving} วิ่ง</span>
                <span className="text-gray-600">{stopped} จอด</span>
                <span className="text-blue-600">เฉลี่ย {avgSpeed.toFixed(0)} km/h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatusLabel(status: VehicleStatus): string {
  const labels = {
    moving: 'กำลังวิ่ง',
    stopped: 'จอดนิ่ง',
    parked_at_base: 'จอดที่โรงรถ',
  };
  return labels[status];
}
```

### Route Date Picker Component
```typescript
// components/fleet/RouteDatePicker.tsx
import { useState } from 'react';

interface Props {
  vehicleId: string;
  vehicleName: string;
}

export function RouteDatePicker({ vehicleId, vehicleName }: Props) {
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <label className="font-medium">เลือกวันที่:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2"
        />
      </div>

      <VehicleRouteMap
        vehicleId={vehicleId}
        vehicleName={vehicleName}
        date={date}
      />
    </div>
  );
}
```

## Architecture

### Data Flow
```
pg_cron (every 5 min)
       ↓
   pg_net HTTP POST
       ↓
api-fleet-sync (Edge Function)
       ↓
External GPS API (bgfleet.loginto.me)
       ↓
┌──────────────────────────────┐
│  fleet_vehicles (current)    │ ← api-fleet reads from here
│  fleet_vehicle_history       │ ← route data stored here
└──────────────────────────────┘
```

### Sync Schedule
- **Frequency**: Every 5 minutes
- **Data points per day**: 288 per vehicle
- **History retention**: Configurable (recommend 30-90 days)

## Notes
- Data syncs automatically every 5 minutes via pg_cron
- Vehicle data is stored in database for fast reads
- Route history logged every 5 minutes for route mapping
- Address geocoding only runs for stopped vehicles (to save API costs)
- Address is cached if vehicle hasn't moved >50 meters
- Garage detection uses configurable radius (default 100m)
- Auto-refresh recommended every 30 seconds for real-time tracking
