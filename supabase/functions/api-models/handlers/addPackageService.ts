/**
 * Add service to model package handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function addPackageService(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 1 and above can add services to packages
  await requireMinLevel(employee, 1);

  // Validate model ID
  validateUUID(modelId, 'Model ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.service_id, 'Service ID');
  validateUUID(body.service_id as string, 'Service ID');

  // Prepare data
  const data: Record<string, unknown> = {
    model_id: modelId,
    service_id: body.service_id,
    terms: body.terms ?? null,
    note: body.note ?? null,
    display_order: body.display_order ?? 0,
  };

  // Add service to package
  const result = await ModelService.addPackageService(data);

  return success(result, HTTP_STATUS.CREATED);
}

