/**
 * Delete model handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteModel(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can delete models
  await requireMinLevel(employee, 1);

  // Delete model
  await ModelService.delete(id);

  return success({ message: 'ลบข้อมูลสำเร็จ' });
}

