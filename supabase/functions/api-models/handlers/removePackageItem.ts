/**
 * Remove component model from parent model package handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function removePackageItem(req: Request, employee: Employee, modelId: string, componentModelId: string) {
  // Check permissions - Level 1 and above can remove components from packages
  await requireMinLevel(employee, 1);

  // Validate IDs
  validateUUID(modelId, 'Model ID');
  validateUUID(componentModelId, 'Component Model ID');

  // Remove component from package
  await ModelService.removePackageComponent(modelId, componentModelId);

  return success({ message: 'ลบอุปกรณ์จากแพ็คเกจสำเร็จ' });
}

