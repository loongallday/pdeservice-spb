/**
 * Update employee-site training handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/error.ts';
import { EmployeeSiteTrainingService } from '../services/employeeSiteTrainingService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Level 1+: update training records
  await requireMinLevel(employee, 1);

  const body = await req.json();

  if (body.trained_at) {
    const date = Date.parse(body.trained_at);
    if (Number.isNaN(date)) {
      throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง');
    }
  }

  const result = await EmployeeSiteTrainingService.update(id, body);

  return success(result);
}

