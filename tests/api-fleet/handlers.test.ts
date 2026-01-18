/**
 * Unit tests for Fleet API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  listFleet,
  getVehicle,
  updateVehicle,
  setVehicleEmployees,
  addVehicleEmployee,
  removeVehicleEmployee,
  getVehicleRoute,
  getWorkLocations,
  listGarages,
  createGarage,
  updateGarage,
  deleteGarage,
} from '../../supabase/functions/api-fleet/handlers/fleet.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockVehicle = {
  id: '123',
  name: 'กท-1234 คุณสมชาย',
  plate_number: 'กท-1234',
  driver_name: 'คุณสมชาย',
  employees: [],
  status: 'moving',
  latitude: 13.7563,
  longitude: 100.5018,
  speed: 45,
  heading: 90,
  signal_strength: 100,
  address: 'ถนนพหลโยธิน กรุงเทพมหานคร',
  garage: null,
  last_sync_at: '2025-01-01T12:00:00Z',
};

const mockGarage = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Main Garage',
  description: null,
  latitude: 13.7563,
  longitude: 100.5018,
  radius_meters: 100,
  is_active: true,
};

Deno.test('listFleet - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-fleet');

  await assertRejects(
    async () => await listFleet(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('listFleet - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', 'http://localhost/api-fleet');

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalList = module.FleetService.list;
  module.FleetService.list = async () => [mockVehicle];

  try {
    const response = await listFleet(request, employee);
    const data = await assertSuccessResponse<typeof mockVehicle[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
  } finally {
    module.FleetService.list = originalList;
  }
});

Deno.test('getVehicle - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', `http://localhost/api-fleet/${mockVehicle.id}`);

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalGetById = module.FleetService.getById;
  module.FleetService.getById = async () => mockVehicle;

  try {
    const response = await getVehicle(request, employee, mockVehicle.id);
    const data = await assertSuccessResponse<typeof mockVehicle>(response);
    assertEquals(data.id, mockVehicle.id);
  } finally {
    module.FleetService.getById = originalGetById;
  }
});

Deno.test('getVehicleRoute - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', `http://localhost/api-fleet/${mockVehicle.id}/route?date=2025-01-01`);

  const mockHistory = [
    { ...mockVehicle, recorded_at: '2025-01-01T12:00:00Z' },
  ];

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalGetRouteHistory = module.FleetService.getRouteHistory;
  module.FleetService.getRouteHistory = async () => mockHistory;

  try {
    const response = await getVehicleRoute(request, employee, mockVehicle.id);
    const data = await assertSuccessResponse<typeof mockHistory>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    module.FleetService.getRouteHistory = originalGetRouteHistory;
  }
});

Deno.test('listGarages - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', 'http://localhost/api-fleet/garages');

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalListGarages = module.FleetService.listGarages;
  module.FleetService.listGarages = async () => [mockGarage];

  try {
    const response = await listGarages(request, employee);
    const data = await assertSuccessResponse<typeof mockGarage[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    module.FleetService.listGarages = originalListGarages;
  }
});

Deno.test('createGarage - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-fleet/garages', {
    name: 'New Garage',
    latitude: 13.7563,
    longitude: 100.5018,
    radius_meters: 100,
  });

  await assertRejects(
    async () => await createGarage(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('createGarage - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-fleet/garages', {
    name: 'New Garage',
    latitude: 13.7563,
    longitude: 100.5018,
    radius_meters: 100,
  });

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalCreateGarage = module.FleetService.createGarage;
  module.FleetService.createGarage = async () => ({ id: mockGarage.id, name: 'New Garage' });

  try {
    const response = await createGarage(request, employee);
    const data = await assertSuccessResponse<{ id: string; name: string }>(response, 201);
    assertEquals(data.id, mockGarage.id);
  } finally {
    module.FleetService.createGarage = originalCreateGarage;
  }
});

Deno.test('deleteGarage - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-fleet/garages/${mockGarage.id}`);

  await assertRejects(
    async () => await deleteGarage(request, employee, mockGarage.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============ Handler Existence Tests ============

Deno.test('listFleet handler exists', () => {
  assertEquals(typeof listFleet, 'function');
});

Deno.test('getVehicle handler exists', () => {
  assertEquals(typeof getVehicle, 'function');
});

Deno.test('updateVehicle handler exists', () => {
  assertEquals(typeof updateVehicle, 'function');
});

Deno.test('setVehicleEmployees handler exists', () => {
  assertEquals(typeof setVehicleEmployees, 'function');
});

Deno.test('addVehicleEmployee handler exists', () => {
  assertEquals(typeof addVehicleEmployee, 'function');
});

Deno.test('removeVehicleEmployee handler exists', () => {
  assertEquals(typeof removeVehicleEmployee, 'function');
});

Deno.test('getVehicleRoute handler exists', () => {
  assertEquals(typeof getVehicleRoute, 'function');
});

Deno.test('getWorkLocations handler exists', () => {
  assertEquals(typeof getWorkLocations, 'function');
});

Deno.test('listGarages handler exists', () => {
  assertEquals(typeof listGarages, 'function');
});

Deno.test('createGarage handler exists', () => {
  assertEquals(typeof createGarage, 'function');
});

Deno.test('updateGarage handler exists', () => {
  assertEquals(typeof updateGarage, 'function');
});

Deno.test('deleteGarage handler exists', () => {
  assertEquals(typeof deleteGarage, 'function');
});

// ============ Additional Permission Tests ============

Deno.test('getVehicle - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-fleet/${mockVehicle.id}`);

  await assertRejects(
    async () => await getVehicle(request, employee, mockVehicle.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('updateVehicle - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/${mockVehicle.id}`, {
    driver_name_override: 'New Driver',
  });

  await assertRejects(
    async () => await updateVehicle(request, employee, mockVehicle.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('setVehicleEmployees - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/${mockVehicle.id}/employees`, {
    employee_ids: [],
  });

  await assertRejects(
    async () => await setVehicleEmployees(request, employee, mockVehicle.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('addVehicleEmployee - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', `http://localhost/api-fleet/${mockVehicle.id}/employees`, {
    employee_id: mockGarage.id,
  });

  await assertRejects(
    async () => await addVehicleEmployee(request, employee, mockVehicle.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('removeVehicleEmployee - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-fleet/${mockVehicle.id}/employees/${mockGarage.id}`);

  await assertRejects(
    async () => await removeVehicleEmployee(request, employee, mockVehicle.id, mockGarage.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('getVehicleRoute - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-fleet/${mockVehicle.id}/route`);

  await assertRejects(
    async () => await getVehicleRoute(request, employee, mockVehicle.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('getWorkLocations - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-fleet/${mockVehicle.id}/work-locations`);

  await assertRejects(
    async () => await getWorkLocations(request, employee, mockVehicle.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('listGarages - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-fleet/garages');

  await assertRejects(
    async () => await listGarages(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('updateGarage - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/garages/${mockGarage.id}`, {
    name: 'Updated Garage',
  });

  await assertRejects(
    async () => await updateGarage(request, employee, mockGarage.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============ Validation Tests ============

Deno.test('setVehicleEmployees - missing employee_ids throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/${mockVehicle.id}/employees`, {});

  await assertRejects(
    async () => await setVehicleEmployees(request, employee, mockVehicle.id),
    Error,
    'กรุณาระบุ employee_ids เป็น array'
  );
});

Deno.test('setVehicleEmployees - non-array employee_ids throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/${mockVehicle.id}/employees`, {
    employee_ids: 'not-an-array',
  });

  await assertRejects(
    async () => await setVehicleEmployees(request, employee, mockVehicle.id),
    Error,
    'กรุณาระบุ employee_ids เป็น array'
  );
});

Deno.test('addVehicleEmployee - missing employee_id throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', `http://localhost/api-fleet/${mockVehicle.id}/employees`, {});

  await assertRejects(
    async () => await addVehicleEmployee(request, employee, mockVehicle.id),
    Error,
    'กรุณาระบุ employee_id'
  );
});

Deno.test('removeVehicleEmployee - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-fleet/${mockVehicle.id}/employees/invalid-uuid`);

  await assertRejects(
    async () => await removeVehicleEmployee(request, employee, mockVehicle.id, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('createGarage - missing name throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-fleet/garages', {
    latitude: 13.7563,
    longitude: 100.5018,
  });

  await assertRejects(
    async () => await createGarage(request, employee),
    Error,
    'กรุณาระบุชื่อโรงรถ'
  );
});

Deno.test('createGarage - missing coordinates throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-fleet/garages', {
    name: 'New Garage',
  });

  await assertRejects(
    async () => await createGarage(request, employee),
    Error,
    'กรุณาระบุพิกัด'
  );
});

Deno.test('updateGarage - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-fleet/garages/invalid-uuid', {
    name: 'Updated',
  });

  await assertRejects(
    async () => await updateGarage(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('deleteGarage - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-fleet/garages/invalid-uuid');

  await assertRejects(
    async () => await deleteGarage(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

// ============ Additional Mocked Success Tests ============

Deno.test('listFleet - with status filter success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', 'http://localhost/api-fleet?status=moving');

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalList = module.FleetService.list;
  module.FleetService.list = async () => [mockVehicle];

  try {
    const response = await listFleet(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.FleetService.list = originalList;
  }
});

Deno.test('updateVehicle - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/${mockVehicle.id}`, {
    driver_name_override: 'New Driver',
  });

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalUpdate = module.FleetService.updateVehicle;
  module.FleetService.updateVehicle = async () => ({ ...mockVehicle, driver_name: 'New Driver' });

  try {
    const response = await updateVehicle(request, employee, mockVehicle.id);
    assertEquals(response.status, 200);
  } finally {
    module.FleetService.updateVehicle = originalUpdate;
  }
});

Deno.test('getWorkLocations - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', `http://localhost/api-fleet/${mockVehicle.id}/work-locations`);

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalGetWorkLocations = module.FleetService.getWorkLocations;
  module.FleetService.getWorkLocations = async () => [];

  try {
    const response = await getWorkLocations(request, employee, mockVehicle.id);
    assertEquals(response.status, 200);
  } finally {
    module.FleetService.getWorkLocations = originalGetWorkLocations;
  }
});

Deno.test('updateGarage - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', `http://localhost/api-fleet/garages/${mockGarage.id}`, {
    name: 'Updated Garage',
  });

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalUpdate = module.FleetService.updateGarage;
  module.FleetService.updateGarage = async () => ({ ...mockGarage, name: 'Updated Garage' });

  try {
    const response = await updateGarage(request, employee, mockGarage.id);
    assertEquals(response.status, 200);
  } finally {
    module.FleetService.updateGarage = originalUpdate;
  }
});

Deno.test('deleteGarage - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-fleet/garages/${mockGarage.id}`);

  const module = await import('../../supabase/functions/api-fleet/services/fleetService.ts');
  const originalDelete = module.FleetService.deleteGarage;
  module.FleetService.deleteGarage = async () => undefined;

  try {
    const response = await deleteGarage(request, employee, mockGarage.id);
    assertEquals(response.status, 200);
  } finally {
    module.FleetService.deleteGarage = originalDelete;
  }
});

