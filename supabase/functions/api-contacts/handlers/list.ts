/**
 * List contacts handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  console.log('[list handler] Called - this should NOT be called for getById!');
  // Check permissions - Level 0 (all authenticated users) and above can view contacts
  await requireMinLevel(employee, 0);

  // Parse pagination and filters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const site_id = url.searchParams.get('site_id') || undefined;

  console.log('[list handler] Fetching contacts with:', { page, limit, site_id });

  // Fetch contacts
  const result = await ContactService.getAll({ page, limit, site_id });

  console.log('[list handler] Returning result:', {
    hasData: !!result.data,
    dataLength: Array.isArray(result.data) ? result.data.length : 'not array',
    hasPagination: !!result.pagination,
  });

  return success(result);
}

