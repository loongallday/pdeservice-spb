/**
 * Me handler - Returns current user information
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { InitializeService } from '../services/initializeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function me(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get their info
  await requireMinLevel(employee, 0);

  // Get current user info (employee with role and department)
  const userInfo = await InitializeService.getCurrentUserInfo(employee);

  return success(userInfo);
}

