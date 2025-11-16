/**
 * Update contact handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 (non-technician_l1) and above can update contacts
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Contact ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update contact
  const contact = await ContactService.update(id, body);

  return success(contact);
}

