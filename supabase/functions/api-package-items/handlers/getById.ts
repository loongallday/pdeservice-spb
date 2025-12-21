/**
 * Get single package item handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { PackageItemService } from '../services/packageItemService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view package items
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Package Item ID');

  // Fetch package item
  const item = await PackageItemService.getById(id);

  return success(item);
}

