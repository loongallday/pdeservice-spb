/**
 * Get single company handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateRequired } from '../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function get(req: Request, employee: Employee, taxId: string) {
  // Check permissions - Level 0 and above can view companies
  await requireMinLevel(employee, 0);

  // Validate tax ID
  validateRequired(taxId, 'เลขผู้เสียภาษี');

  // Get company from service
  const company = await CompanyService.getByTaxId(taxId);

  return success(company);
}

