/**
 * List models handler
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can list models
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const search = url.searchParams.get('search') || undefined;

  // Get models from service
  const result = await ModelService.getAll({ page, limit, search });

  return successWithPagination(result.data, result.pagination);
}

