/**
 * Update employee handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

// Fields that employees can update on their own profile
const ALLOWED_SELF_UPDATE_FIELDS = ['name', 'nickname', 'email', 'profile_image_url'];

export async function update(req: Request, employee: Employee, id: string) {
  // Validate ID
  validateUUID(id, 'Employee ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Check if employee is updating themselves
  const isUpdatingSelf = employee.id === id;

  if (isUpdatingSelf) {
    // Employees can update their own profile, but only certain fields
    // Check if they're trying to update restricted fields
    const restrictedFields = Object.keys(body).filter(
      (key) => !ALLOWED_SELF_UPDATE_FIELDS.includes(key)
    );

    if (restrictedFields.length > 0) {
      // If trying to update restricted fields, require admin permissions
      await requireMinLevel(employee, 2);
    }
    // Otherwise, allow the update (no permission check needed for self-update of allowed fields)
  } else {
    // Updating another employee requires admin permissions
    await requireMinLevel(employee, 2);
  }

  // Update employee
  const updatedEmployee = await EmployeeService.update(id, body);

  return success(updatedEmployee);
}

