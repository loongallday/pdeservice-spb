/**
 * Create PM log handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { PMLogService } from '../services/pmlogService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create PM logs
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await req.json();

  // Set performed_by to current employee if not specified
  if (!body.performed_by) {
    body.performed_by = employee.id;
  }

  // Create PM log
  const result = await PMLogService.create(body);

  return success(result, 201);
}

