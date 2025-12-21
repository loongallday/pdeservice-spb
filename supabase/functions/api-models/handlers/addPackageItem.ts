/**
 * Add item to model package handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function addPackageItem(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 1 and above can add items to packages
  await requireMinLevel(employee, 1);

  // Validate model ID
  validateUUID(modelId, 'Model ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.item_id, 'Item ID');
  validateUUID(body.item_id as string, 'Item ID');

  // Prepare data
  const data: Record<string, unknown> = {
    model_id: modelId,
    item_id: body.item_id,
    quantity: body.quantity ?? 1,
    note: body.note ?? null,
    display_order: body.display_order ?? 0,
  };

  // Add item to package
  const result = await ModelService.addPackageItem(data);

  return success(result, HTTP_STATUS.CREATED);
}

