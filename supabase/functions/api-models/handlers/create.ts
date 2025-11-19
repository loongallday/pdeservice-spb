/**
 * Create model handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 2 and above can create models
  await requireMinLevel(employee, 2);

  // Parse request body
  const body = await req.json();

  // Create model
  const result = await ModelService.create(body);

  return success(result, 201);
}

