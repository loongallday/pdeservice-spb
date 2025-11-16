/**
 * Create contact handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { ContactService } from '../services/contactService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 (non-technician_l1) and above can create contacts
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.person_name, 'ชื่อผู้ติดต่อ');

  // Create contact
  const contact = await ContactService.create(body);

  return success(contact, HTTP_STATUS.CREATED);
}

