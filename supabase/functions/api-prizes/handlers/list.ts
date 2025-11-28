/**
 * Handler: List all prizes with pagination
 * GET /api-prizes?page=1&limit=50
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { successWithPagination } from '../_shared/response.ts';
import { getAll } from '../services/prizeService.ts';

export async function handleList(req: Request): Promise<Response> {
  // Authenticate user (level 0+)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 0);

  // Parse pagination params
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Get prizes with pagination
  const result = await getAll(page, limit);

  return successWithPagination(result.data, result.pagination);
}
