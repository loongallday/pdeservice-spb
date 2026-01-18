/**
 * Me handler - Returns current user information with constants
 * Optimized bootstrap: combines employee data + constants in single response
 * Reduces startup API calls from 3 to 2 (this + features)
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { InitializeService } from '../services/initializeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function me(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get their info
  await requireMinLevel(employee, 0);

  // Get current user info with constants (employee + role + department + constants)
  const userInfo = await InitializeService.getCurrentUserInfo(employee);

  return success(userInfo);
}

