/**
 * Fleet handlers - Get fleet/vehicle data and manage garages
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { NotFoundError, ValidationError } from '../../_shared/error.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { FleetService, FleetListParams, RouteHistoryParams, GarageInput, VehicleStatus } from '../services/fleetService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /fleet - List all vehicles
 */
export async function listFleet(req: Request, employee: Employee) {
  await requireMinLevel(employee, 1);

  const url = new URL(req.url);

  const params: FleetListParams = {};

  // Optional status filter
  const status = url.searchParams.get('status');
  if (status && ['moving', 'stopped', 'parked_at_base'].includes(status)) {
    params.status = status as VehicleStatus;
  }

  const vehicles = await FleetService.list(params);

  return success(vehicles);
}

/**
 * GET /fleet/:id - Get single vehicle
 */
export async function getVehicle(_req: Request, employee: Employee, vehicleId: string) {
  await requireMinLevel(employee, 1);

  const vehicle = await FleetService.getById(vehicleId);

  if (!vehicle) {
    throw new NotFoundError('ไม่พบข้อมูลรถ');
  }

  return success(vehicle);
}

/**
 * PUT /fleet/:id - Update vehicle overrides (driver name, plate number)
 */
export async function updateVehicle(req: Request, employee: Employee, vehicleId: string) {
  await requireMinLevel(employee, 2);

  const body = await parseRequestBody<Record<string, unknown>>(req);

  const vehicle = await FleetService.updateVehicle(vehicleId, {
    driver_name_override: body.driver_name_override as string | undefined,
    plate_number_override: body.plate_number_override as string | undefined,
  });

  return success(vehicle);
}

/**
 * GET /fleet/:id/route - Get route history for a vehicle
 */
export async function getVehicleRoute(req: Request, employee: Employee, vehicleId: string) {
  await requireMinLevel(employee, 1);

  const url = new URL(req.url);

  const params: RouteHistoryParams = {
    date: url.searchParams.get('date') || undefined,
    start_date: url.searchParams.get('start_date') || undefined,
    end_date: url.searchParams.get('end_date') || undefined,
  };

  const history = await FleetService.getRouteHistory(vehicleId, params);

  return success(history);
}

/**
 * GET /fleet/garages - List all garages
 */
export async function listGarages(_req: Request, employee: Employee) {
  await requireMinLevel(employee, 1);

  const garages = await FleetService.listGarages();

  return success(garages);
}

/**
 * POST /fleet/garages - Create a new garage
 */
export async function createGarage(req: Request, employee: Employee) {
  await requireMinLevel(employee, 2);

  const body = await parseRequestBody<Record<string, unknown>>(req);

  if (!body.name || typeof body.name !== 'string') {
    throw new ValidationError('กรุณาระบุชื่อโรงรถ');
  }
  if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
    throw new ValidationError('กรุณาระบุพิกัด');
  }

  const input: GarageInput = {
    name: body.name,
    description: body.description as string | undefined,
    latitude: body.latitude,
    longitude: body.longitude,
    radius_meters: typeof body.radius_meters === 'number' ? body.radius_meters : undefined,
  };

  const garage = await FleetService.createGarage(input);

  return success(garage, 201);
}

/**
 * PUT /fleet/garages/:id - Update a garage
 */
export async function updateGarage(req: Request, employee: Employee, garageId: string) {
  await requireMinLevel(employee, 2);
  validateUUID(garageId, 'Garage ID');

  const body = await parseRequestBody<Record<string, unknown>>(req);

  const input: Partial<GarageInput> = {};
  if (body.name !== undefined) input.name = body.name as string;
  if (body.description !== undefined) input.description = body.description as string;
  if (body.latitude !== undefined) input.latitude = body.latitude as number;
  if (body.longitude !== undefined) input.longitude = body.longitude as number;
  if (body.radius_meters !== undefined) input.radius_meters = body.radius_meters as number;

  const garage = await FleetService.updateGarage(garageId, input);

  return success(garage);
}

/**
 * DELETE /fleet/garages/:id - Delete a garage
 */
export async function deleteGarage(_req: Request, employee: Employee, garageId: string) {
  await requireMinLevel(employee, 2);
  validateUUID(garageId, 'Garage ID');

  await FleetService.deleteGarage(garageId);

  return success({ message: 'ลบโรงรถสำเร็จ' });
}
