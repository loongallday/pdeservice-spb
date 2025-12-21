/**
 * Delete package item handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { PackageItemService } from '../services/packageItemService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deletePackageItem(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 and above can delete package items
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Package Item ID');

  // Delete package item
  await PackageItemService.delete(id);

  return success({ message: 'ลบรายการอุปกรณ์สำเร็จ' });
}

