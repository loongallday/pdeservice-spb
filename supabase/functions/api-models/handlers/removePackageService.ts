/**
 * Remove service from model package handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function removePackageService(req: Request, employee: Employee, modelId: string, serviceId: string) {
  // Check permissions - Level 1 and above can remove services from packages
  await requireMinLevel(employee, 1);

  // Validate IDs
  validateUUID(modelId, 'Model ID');
  validateUUID(serviceId, 'Service ID');

  // Remove service from package
  await ModelService.removePackageService(modelId, serviceId);

  return success({ message: 'ลบบริการจากแพ็คเกจสำเร็จ' });
}

