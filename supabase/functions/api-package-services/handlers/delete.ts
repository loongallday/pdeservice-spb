/**
 * Delete package service handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { PackageServiceService } from '../services/packageServiceService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deletePackageService(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 and above can delete package services
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Package Service ID');

  // Delete package service
  await PackageServiceService.delete(id);

  return success({ message: 'ลบรายการบริการสำเร็จ' });
}

