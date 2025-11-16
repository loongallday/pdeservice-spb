/**
 * Find or create company handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function findOrCreate(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can find or create companies
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.tax_id, 'เลขผู้เสียภาษี');
  validateRequired(body.name_th, 'ชื่อบริษัท');

  // Find or create company
  const company = await CompanyService.findOrCreate(body);

  return success(company);
}

