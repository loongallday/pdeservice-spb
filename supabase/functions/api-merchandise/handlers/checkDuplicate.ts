/**
 * Check duplicate serial number handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function checkDuplicate(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can check for duplicates
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const serialNo = url.searchParams.get('serial_no');

  if (!serialNo) {
    throw new ValidationError('กรุณาระบุ serial_no ใน query parameter');
  }

  // Check for duplicate
  const existing = await MerchandiseService.checkDuplicateSerial(serialNo);

  return success({
    is_duplicate: existing !== null,
    merchandise: existing,
  });
}

