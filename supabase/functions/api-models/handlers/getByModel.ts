/**
 * Get model by model code handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getByModel(req: Request, employee: Employee, model: string) {
  // Check permissions - Level 0 and above can view models
  await requireMinLevel(employee, 0);

  // Get model by code
  const result = await ModelService.getByModel(model);

  return success(result);
}

