/**
 * Get model specification handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getSpecification(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 0 and above can view specifications
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(modelId, 'Model ID');

  // Fetch specification
  const spec = await ModelService.getSpecification(modelId);

  return success(spec);
}

