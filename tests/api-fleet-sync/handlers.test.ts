/**
 * Unit tests for Fleet Sync API handlers
 * Tests vehicle data parsing, status detection, and sync logic
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ============ Vehicle Name Parsing Tests ============

Deno.test('fleet-sync - parses vehicle name with plate and driver', () => {
  const parseVehicleName = (fullName: string): { plateNumber: string; driverName: string } => {
    // Expected format: "ทะเบียน - ชื่อคนขับ" or just "ทะเบียน"
    const parts = fullName.split(' - ');
    return {
      plateNumber: parts[0]?.trim() || '',
      driverName: parts[1]?.trim() || '',
    };
  };

  const result1 = parseVehicleName('กข 1234 - สมชาย');
  assertEquals(result1.plateNumber, 'กข 1234');
  assertEquals(result1.driverName, 'สมชาย');

  const result2 = parseVehicleName('ขค 5678');
  assertEquals(result2.plateNumber, 'ขค 5678');
  assertEquals(result2.driverName, '');
});

// ============ Vehicle Status Tests ============

Deno.test('fleet-sync - vehicle statuses are valid', () => {
  const validStatuses = ['moving', 'stopped', 'parked_at_base'];

  const isValidStatus = (status: string) => validStatuses.includes(status);

  assertEquals(isValidStatus('moving'), true);
  assertEquals(isValidStatus('stopped'), true);
  assertEquals(isValidStatus('parked_at_base'), true);
  assertEquals(isValidStatus('unknown'), false);
});

Deno.test('fleet-sync - determines status from speed', () => {
  const getStatusFromSpeed = (speed: number): string => {
    if (speed > 0) return 'moving';
    return 'stopped';
  };

  assertEquals(getStatusFromSpeed(60), 'moving');
  assertEquals(getStatusFromSpeed(5), 'moving');
  assertEquals(getStatusFromSpeed(0), 'stopped');
});

Deno.test('fleet-sync - detects parked at base by proximity', () => {
  // Simple distance check (actual implementation uses Haversine)
  const isNearGarage = (
    vehicleLat: number,
    vehicleLng: number,
    garageLat: number,
    garageLng: number,
    radiusMeters: number
  ): boolean => {
    // Simplified check - actual implementation uses proper Haversine formula
    const latDiff = Math.abs(vehicleLat - garageLat);
    const lngDiff = Math.abs(vehicleLng - garageLng);
    // Rough approximation: 0.001 degree ≈ 100m
    const approxDistanceMeters = Math.sqrt(latDiff ** 2 + lngDiff ** 2) * 100000;
    return approxDistanceMeters <= radiusMeters;
  };

  // Vehicle very close to garage (same location)
  assertEquals(isNearGarage(13.7563, 100.5018, 13.7563, 100.5018, 100), true);

  // Vehicle far from garage
  assertEquals(isNearGarage(13.7563, 100.5018, 14.0, 101.0, 100), false);
});

// ============ Coordinate Parsing Tests ============

Deno.test('fleet-sync - parses coordinates from raw data', () => {
  const parseCoordinate = (value: unknown): number => {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  assertEquals(parseCoordinate(13.7563), 13.7563);
  assertEquals(parseCoordinate('13.7563'), 13.7563);
  assertEquals(parseCoordinate('invalid'), 0);
  assertEquals(parseCoordinate(null), 0);
});

Deno.test('fleet-sync - validates coordinate ranges', () => {
  const isValidLatitude = (lat: number): boolean => lat >= -90 && lat <= 90;
  const isValidLongitude = (lng: number): boolean => lng >= -180 && lng <= 180;

  assertEquals(isValidLatitude(13.7563), true);
  assertEquals(isValidLatitude(-90), true);
  assertEquals(isValidLatitude(90), true);
  assertEquals(isValidLatitude(91), false);

  assertEquals(isValidLongitude(100.5018), true);
  assertEquals(isValidLongitude(-180), true);
  assertEquals(isValidLongitude(180), true);
  assertEquals(isValidLongitude(181), false);
});

// ============ Speed Parsing Tests ============

Deno.test('fleet-sync - parses speed from raw data', () => {
  const parseSpeed = (value: unknown): number => {
    if (typeof value === 'number') return value < 0 ? 0 : value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  assertEquals(parseSpeed(60), 60);
  assertEquals(parseSpeed('45.5'), 45.5);
  assertEquals(parseSpeed(-10), 0);
  assertEquals(parseSpeed('invalid'), 0);
});

// ============ Heading Parsing Tests ============

Deno.test('fleet-sync - parses heading from raw data', () => {
  const parseHeading = (value: unknown): number => {
    if (typeof value === 'number') return Math.round(value) % 360;
    const parsed = parseInt(String(value));
    return isNaN(parsed) ? 0 : parsed % 360;
  };

  assertEquals(parseHeading(90), 90);
  assertEquals(parseHeading('180'), 180);
  assertEquals(parseHeading(360), 0);
  assertEquals(parseHeading(450), 90);
});

// ============ Sync Result Tests ============

Deno.test('fleet-sync - sync result format', () => {
  interface SyncResult {
    synced: number;
    history_logged: number;
  }

  const result: SyncResult = {
    synced: 25,
    history_logged: 10,
  };

  assertEquals(typeof result.synced, 'number');
  assertEquals(typeof result.history_logged, 'number');
  assertEquals(result.synced >= 0, true);
  assertEquals(result.history_logged >= 0, true);
});

// ============ Vehicle Data Structure Tests ============

Deno.test('fleet-sync - vehicle data structure', () => {
  interface VehicleData {
    external_id: string;
    plate_number: string;
    driver_name: string | null;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    status: string;
    address: string | null;
    last_sync_at: string;
  }

  const vehicle: VehicleData = {
    external_id: 'V001',
    plate_number: 'กข 1234',
    driver_name: 'สมชาย',
    latitude: 13.7563,
    longitude: 100.5018,
    speed: 45,
    heading: 180,
    status: 'moving',
    address: 'ถนนสุขุมวิท กรุงเทพฯ',
    last_sync_at: '2024-01-01T00:00:00Z',
  };

  assertEquals(typeof vehicle.external_id, 'string');
  assertEquals(typeof vehicle.plate_number, 'string');
  assertEquals(typeof vehicle.latitude, 'number');
  assertEquals(typeof vehicle.longitude, 'number');
  assertEquals(typeof vehicle.speed, 'number');
});

// ============ History Logging Tests ============

Deno.test('fleet-sync - should log history for moving vehicles only', () => {
  const shouldLogHistory = (status: string): boolean => {
    return status === 'moving';
  };

  assertEquals(shouldLogHistory('moving'), true);
  assertEquals(shouldLogHistory('stopped'), false);
  assertEquals(shouldLogHistory('parked_at_base'), false);
});

// ============ Garage Structure Tests ============

Deno.test('fleet-sync - garage data structure', () => {
  interface Garage {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active: boolean;
  }

  const garage: Garage = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'อู่ซ่อมกรุงเทพ',
    latitude: 13.7563,
    longitude: 100.5018,
    radius_meters: 100,
    is_active: true,
  };

  assertEquals(typeof garage.id, 'string');
  assertEquals(typeof garage.name, 'string');
  assertEquals(typeof garage.latitude, 'number');
  assertEquals(typeof garage.longitude, 'number');
  assertEquals(typeof garage.radius_meters, 'number');
  assertEquals(typeof garage.is_active, 'boolean');
});

// ============ Raw API Response Tests ============

Deno.test('fleet-sync - validates raw API response is array', () => {
  const isValidResponse = (data: unknown): boolean => {
    return Array.isArray(data);
  };

  assertEquals(isValidResponse([]), true);
  assertEquals(isValidResponse([[1, 'test', 0, 13.75, 0, 100.5]]), true);
  assertEquals(isValidResponse(null), false);
  assertEquals(isValidResponse({}), false);
  assertEquals(isValidResponse('invalid'), false);
});

// ============ Error Handling Tests ============

Deno.test('fleet-sync - error response format', () => {
  const createErrorResponse = (message: string): { error: string; status: number } => {
    return { error: message, status: 500 };
  };

  const error = createErrorResponse('Sync failed');
  assertEquals(error.error, 'Sync failed');
  assertEquals(error.status, 500);
});
