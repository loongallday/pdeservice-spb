/**
 * Get enabled features handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel, getEmployeeLevel } from '../../_shared/auth.ts';
import { FeatureService } from '../services/featureService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getEnabled(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view enabled features
  await requireMinLevel(employee, 0);

  // Get employee level and role
  const employeeLevel = getEmployeeLevel(employee);
  const employeeRole = employee.role_data?.code || null;

  // Fetch enabled features for this employee level and role
  const features = await FeatureService.getEnabledFeatures(employeeLevel, employeeRole);

  return success(features);
}

