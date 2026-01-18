/**
 * Get model package handler - returns component models and services for a model
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getPackage(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 0 and above can view packages
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(modelId, 'Model ID');

  // Fetch package (components + services)
  const packageData = await ModelService.getPackage(modelId);

  return success(packageData);
}

