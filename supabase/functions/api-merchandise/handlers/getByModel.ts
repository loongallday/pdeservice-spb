/**
 * Get merchandise by model handler
 */

import { success, error } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getByModel(req: Request, employee: Employee, modelId: string) {
  // Check permissions - Level 0 and above can view merchandise
  await requireMinLevel(employee, 0);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(modelId)) {
    return error('Not found', 404);
  }

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Get merchandise by model
  const result = await MerchandiseService.getByModel(modelId, { page, limit });

  return success(result);
}

