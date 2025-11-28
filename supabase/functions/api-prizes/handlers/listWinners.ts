/**
 * Handler: List prize winners (assignments)
 * GET /api-prizes/winners?page=1&limit=50&user_id=xxx&prize_id=xxx
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { successWithPagination } from '../_shared/response.ts';
import { getWinners } from '../services/prizeService.ts';

export async function handleListWinners(req: Request): Promise<Response> {
  // Authenticate user (level 0+)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 0);

  // Parse pagination and filter params
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const userId = url.searchParams.get('user_id') || undefined;
  const prizeId = url.searchParams.get('prize_id') || undefined;

  // Get winners with filters
  const result = await getWinners(page, limit, { userId, prizeId });

  return successWithPagination(result.data, result.pagination);
}
