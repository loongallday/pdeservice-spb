/**
 * Create Work Estimate Handler
 */

import { success, error } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { create, upsert } from '../services/workEstimateService.ts';
import type { CreateWorkEstimateRequest } from '../types.ts';

interface Employee {
  id: string;
}

/**
 * POST / - Create work estimate
 */
export async function handleCreate(req: Request, employee: Employee): Promise<Response> {
  const body: CreateWorkEstimateRequest = await req.json();

  // Validate required fields
  if (!body.ticket_id) {
    throw new ValidationError('กรุณาระบุ ticket_id');
  }

  if (!body.estimated_minutes) {
    throw new ValidationError('กรุณาระบุเวลาทำงาน (estimated_minutes)');
  }

  const data = await create(body, employee.id);
  return success(data);
}

/**
 * POST /upsert - Create or update work estimate
 */
export async function handleUpsert(req: Request, employee: Employee): Promise<Response> {
  const body: CreateWorkEstimateRequest = await req.json();

  // Validate required fields
  if (!body.ticket_id) {
    throw new ValidationError('กรุณาระบุ ticket_id');
  }

  if (!body.estimated_minutes) {
    throw new ValidationError('กรุณาระบุเวลาทำงาน (estimated_minutes)');
  }

  const { data, isNew } = await upsert(body, employee.id);
  return success({ ...data, is_new: isNew });
}
