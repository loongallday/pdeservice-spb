/**
 * Link auth account to employee handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired, validateEmail } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function linkAuth(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can link auth accounts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Parse request body
  const body = await parseRequestBody<{
    email: string;
    password: string;
  }>(req);

  // Validate required fields
  validateRequired(body.email, 'อีเมล');
  validateRequired(body.password, 'รหัสผ่าน');
  validateEmail(body.email);

  // Link auth account
  const updatedEmployee = await EmployeeService.linkAuth(id, body.email, body.password);

  return success(updatedEmployee);
}

