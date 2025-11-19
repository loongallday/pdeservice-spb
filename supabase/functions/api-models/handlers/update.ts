/**
 * Update model handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update models
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await req.json();

  // Update model
  const result = await ModelService.update(id, body);

  return success(result);
}

