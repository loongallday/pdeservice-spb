/**
 * Add component model to parent model package handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function addPackageItem(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 1 and above can add components to packages
  await requireMinLevel(employee, 1);

  // Validate model ID
  validateUUID(modelId, 'Model ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.component_model_id, 'Component Model ID');
  validateUUID(body.component_model_id as string, 'Component Model ID');

  // Prepare data
  const data: Record<string, unknown> = {
    model_id: modelId,
    component_model_id: body.component_model_id,
    quantity: body.quantity ?? 1,
    note: body.note ?? null,
    display_order: body.display_order ?? 0,
  };

  // Add component to package
  const result = await ModelService.addPackageComponent(data);

  return success(result, HTTP_STATUS.CREATED);
}

