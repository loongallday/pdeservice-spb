/**
 * Get contacts by site handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getBySite(req: Request, employee: Employee, siteId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view contacts
  await requireMinLevel(employee, 0);

  // Validate site ID
  validateUUID(siteId, 'Site ID');

  // Fetch contacts for site
  const contacts = await ContactService.getBySite(siteId);

  return success(contacts);
}

