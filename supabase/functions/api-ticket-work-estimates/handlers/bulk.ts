/**
 * Bulk Operations Handler
 */

import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { upsert } from '../services/workEstimateService.ts';
import type { BulkCreateRequest, BulkCreateResponse } from '../types.ts';

interface Employee {
  id: string;
}

/**
 * POST /bulk - Bulk create/update work estimates
 */
export async function handleBulk(req: Request, employee: Employee): Promise<Response> {
  const body: BulkCreateRequest = await req.json();

  if (!body.estimates || !Array.isArray(body.estimates)) {
    throw new ValidationError('กรุณาระบุ estimates เป็น array');
  }

  if (body.estimates.length === 0) {
    throw new ValidationError('ต้องมีอย่างน้อย 1 รายการ');
  }

  if (body.estimates.length > 100) {
    throw new ValidationError('สูงสุด 100 รายการต่อครั้ง');
  }

  const result: BulkCreateResponse = {
    created: 0,
    updated: 0,
    errors: [],
  };

  for (const estimate of body.estimates) {
    try {
      if (!estimate.ticket_id) {
        result.errors.push({
          ticket_id: 'unknown',
          error: 'ไม่ได้ระบุ ticket_id',
        });
        continue;
      }

      if (!estimate.estimated_minutes || estimate.estimated_minutes < 1 || estimate.estimated_minutes > 480) {
        result.errors.push({
          ticket_id: estimate.ticket_id,
          error: 'เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที',
        });
        continue;
      }

      const { isNew } = await upsert(estimate, employee.id);
      if (isNew) {
        result.created++;
      } else {
        result.updated++;
      }
    } catch (err) {
      result.errors.push({
        ticket_id: estimate.ticket_id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return success(result);
}
