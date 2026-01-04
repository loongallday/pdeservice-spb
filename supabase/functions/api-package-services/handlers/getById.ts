/**
 * Get single package service handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { PackageServiceService } from '../services/packageServiceService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view package services
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Package Service ID');

  // Fetch package service
  const service = await PackageServiceService.getById(id);

  return success(service);
}

