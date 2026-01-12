/**
 * Location handlers for merchandise location CRUD
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID, parseRequestBody } from '../../_shared/validation.ts';
import { LocationService, LocationInput } from '../services/locationService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /merchandise/:merchandiseId/location
 * Get location for a merchandise
 */
export async function getLocation(
  _req: Request,
  employee: Employee,
  merchandiseId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(merchandiseId, 'Merchandise ID');

  const location = await LocationService.getByMerchandiseId(merchandiseId);

  return success(location);
}

/**
 * POST /merchandise/:merchandiseId/location
 * Create or update location for a merchandise (upsert)
 */
export async function upsertLocation(
  req: Request,
  employee: Employee,
  merchandiseId: string
): Promise<Response> {
  await requireMinLevel(employee, 1);
  validateUUID(merchandiseId, 'Merchandise ID');

  const body = await parseRequestBody<LocationInput>(req);

  const location = await LocationService.upsert(merchandiseId, body);

  return success(location, 201);
}

/**
 * PUT /merchandise/:merchandiseId/location
 * Update location for a merchandise
 */
export async function updateLocation(
  req: Request,
  employee: Employee,
  merchandiseId: string
): Promise<Response> {
  await requireMinLevel(employee, 1);
  validateUUID(merchandiseId, 'Merchandise ID');

  const body = await parseRequestBody<LocationInput>(req);

  const location = await LocationService.update(merchandiseId, body);

  return success(location);
}

/**
 * DELETE /merchandise/:merchandiseId/location
 * Delete location for a merchandise
 */
export async function deleteLocation(
  _req: Request,
  employee: Employee,
  merchandiseId: string
): Promise<Response> {
  await requireMinLevel(employee, 1);
  validateUUID(merchandiseId, 'Merchandise ID');

  await LocationService.delete(merchandiseId);

  return success({ message: 'ลบตำแหน่งสำเร็จ' });
}
