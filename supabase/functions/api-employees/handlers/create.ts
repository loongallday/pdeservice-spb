/**
 * Create employee handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 2 (admin) and above can create employees
  await requireMinLevel(employee, 2);

  // Parse request body
      const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.name, 'ชื่อ');
  validateRequired(body.code, 'รหัสพนักงาน');

  // Create employee
  const newEmployee = await EmployeeService.create(body);

  return success(newEmployee, HTTP_STATUS.CREATED);
}

