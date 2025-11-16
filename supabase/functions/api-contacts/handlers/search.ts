/**
 * Search contacts handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can search contacts
  await requireMinLevel(employee, 0);

  // Parse search parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const site_id = url.searchParams.get('site_id') || undefined;

  // Search contacts
  const contacts = await ContactService.search(query, site_id);

  return success(contacts);
}

