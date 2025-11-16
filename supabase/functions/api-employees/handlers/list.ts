/**
 * List employees handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can list employees
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  const role = url.searchParams.get('role') || undefined;
  const department_id = url.searchParams.get('department_id') || undefined;
  const is_active = url.searchParams.get('is_active') === 'true' ? true : 
                    url.searchParams.get('is_active') === 'false' ? false : undefined;

  // Get employees from service
  const result = await EmployeeService.getAll({
    page,
    limit,
    role,
    department_id,
    is_active,
  });

  return success(result);
}

