/**
 * Get single model handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view models
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Model ID');

  // Fetch model
  const model = await ModelService.getById(id);

  return success(model);
}

