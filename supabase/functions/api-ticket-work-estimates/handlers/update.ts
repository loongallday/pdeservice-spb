/**
 * Update Work Estimate Handler
 */

import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { update } from '../services/workEstimateService.ts';
import type { UpdateWorkEstimateRequest } from '../types.ts';

interface Employee {
  id: string;
}

/**
 * PUT /:id - Update work estimate
 */
export async function handleUpdate(req: Request, employee: Employee, id: string): Promise<Response> {
  const body: UpdateWorkEstimateRequest = await req.json();

  // Validate at least one field is provided
  if (body.estimated_minutes === undefined && body.notes === undefined) {
    throw new ValidationError('กรุณาระบุข้อมูลที่ต้องการอัปเดต');
  }

  const data = await update(id, body);
  return success(data);
}
