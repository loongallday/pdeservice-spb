/**
 * List contacts handler
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view contacts
  await requireMinLevel(employee, 0);

  // Parse pagination and filters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const site_id = url.searchParams.get('site_id') || undefined;

  // Fetch contacts
  const result = await ContactService.getAll({ page, limit, site_id });

  return successWithPagination(result.data, result.pagination);
}

