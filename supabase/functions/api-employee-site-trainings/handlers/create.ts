/**
 * Create employee-site training handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/error.ts';
import { EmployeeSiteTrainingService } from '../services/employeeSiteTrainingService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Level 1+: create training records
  await requireMinLevel(employee, 1);

  const body = await req.json();

  if (!body?.employee_id) {
    throw new ValidationError('กรุณาระบุ employee_id');
  }

  if (!body?.site_id) {
    throw new ValidationError('กรุณาระบุ site_id');
  }

  if (body.trained_at) {
    const date = Date.parse(body.trained_at);
    if (Number.isNaN(date)) {
      throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง');
    }
  }

  const result = await EmployeeSiteTrainingService.create(body);

  return success(result, 201);
}

