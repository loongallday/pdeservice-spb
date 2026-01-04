/**
 * Create merchandise handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create merchandise
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await req.json();

  // Create merchandise
  const result = await MerchandiseService.create(body);

  return success(result, 201);
}

