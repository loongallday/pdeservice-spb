/**
 * Get single model handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view models
  await requireMinLevel(employee, 0);

  // Get model from service
  const result = await ModelService.getById(id);

  return success(result);
}

