/**
 * Get single contact handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  console.log('[get handler] Called with ID:', id);
  // Check permissions - Level 0 (all authenticated users) and above can view contacts
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Contact ID');

  // Fetch contact
  const contact = await ContactService.getById(id);

  console.log('[get handler] Returning contact:', {
    id,
    hasContact: !!contact,
    contactId: contact?.id,
    contactName: contact?.person_name,
  });

  return success(contact);
}

