/**
 * Get menu items handler
 * Returns menu items grouped by group_label, filtered by user permissions
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel, getEmployeeLevel } from '../../_shared/auth.ts';
import { FeatureService } from '../services/featureService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getMenuItems(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view menu
  await requireMinLevel(employee, 0);

  // Get employee level and role
  const employeeLevel = getEmployeeLevel(employee);
  const employeeRole = employee.role_data?.code?.trim().toLowerCase() || null;

  // Fetch menu items for this employee
  const menuItems = await FeatureService.getMenuItems(employeeLevel, employeeRole);

  return success(menuItems);
}

