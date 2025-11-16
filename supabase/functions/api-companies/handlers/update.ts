/**
 * Update company handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function update(req: Request, employee: Employee, taxId: string) {
  // Check permissions - Level 1 and above can update companies
  await requireMinLevel(employee, 1);

  // Validate tax ID
  validateRequired(taxId, 'เลขผู้เสียภาษี');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update company
  const company = await CompanyService.update(taxId, body);

  return success(company);
}

