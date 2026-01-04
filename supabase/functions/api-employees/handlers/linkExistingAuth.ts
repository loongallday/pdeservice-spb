/**
 * Link existing auth account to employee handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired, validateEmail } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function linkExistingAuth(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can link auth accounts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Parse request body
  const body = await parseRequestBody<{
    auth_user_id: string;
    email: string;
  }>(req);

  // Validate required fields
  validateRequired(body.auth_user_id, 'Auth User ID');
  validateRequired(body.email, 'อีเมล');
  validateEmail(body.email);

  // Link existing auth account
  const updatedEmployee = await EmployeeService.linkExistingAuth(id, body.auth_user_id, body.email);

  return success(updatedEmployee);
}

