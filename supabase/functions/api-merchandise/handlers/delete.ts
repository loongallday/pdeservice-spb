/**
 * Delete merchandise handler
 */

import { success, error } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deleteMerchandise(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 and above can delete merchandise
  await requireMinLevel(employee, 2);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return error('Not found', 404);
  }

  // Delete merchandise
  await MerchandiseService.delete(id);

  return success({ message: 'ลบข้อมูลสำเร็จ' });
}

