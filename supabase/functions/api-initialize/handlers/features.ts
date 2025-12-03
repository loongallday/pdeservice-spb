/**
 * Features handler - Returns enabled features for current user
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { InitializeService } from '../services/initializeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function features(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get features
  await requireMinLevel(employee, 0);

  // Get enabled features for current user
  const features = await InitializeService.getFeatures(employee);

  return success(features);
}

