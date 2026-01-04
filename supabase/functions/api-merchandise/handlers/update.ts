/**
 * Update merchandise handler
 */

import { success, error } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update merchandise
  await requireMinLevel(employee, 1);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return error('Not found', 404);
  }

  // Parse request body
  const body = await req.json();

  // Update merchandise
  const result = await MerchandiseService.update(id, body);

  return success(result);
}

