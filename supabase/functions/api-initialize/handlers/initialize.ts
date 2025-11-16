/**
 * Initialize handler - Returns all initial app data
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { InitializeService } from '../services/initializeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function initialize(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can initialize
  await requireMinLevel(employee, 0);

  // Get all initialization data
  const data = await InitializeService.getInitializeData(employee);

  return success(data);
}

