/**
 * Delete contact handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteContact(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 (non-technician_l1) and above can delete contacts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Contact ID');

  // Delete contact
  await ContactService.delete(id);

  return success({ message: 'ลบผู้ติดต่อสำเร็จ' });
}

