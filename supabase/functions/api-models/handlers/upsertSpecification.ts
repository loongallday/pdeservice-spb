/**
 * Create or update model specification handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function upsertSpecification(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 1 and above can create/update specifications
  await requireMinLevel(employee, 1);

  // Validate model ID
  validateUUID(modelId, 'Model ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Upsert specification
  const result = await ModelService.upsertSpecification(modelId, body);

  return success(result, result.created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK);
}

