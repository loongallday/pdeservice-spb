/**
 * Remove item from model package handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function removePackageItem(req: Request, employee: Employee, modelId: string, itemId: string) {
  // Check permissions - Level 1 and above can remove items from packages
  await requireMinLevel(employee, 1);

  // Validate IDs
  validateUUID(modelId, 'Model ID');
  validateUUID(itemId, 'Item ID');

  // Remove item from package
  await ModelService.removePackageItem(modelId, itemId);

  return success({ message: 'ลบอุปกรณ์จากแพ็คเกจสำเร็จ' });
}

