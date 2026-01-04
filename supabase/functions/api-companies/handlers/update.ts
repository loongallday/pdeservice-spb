/**
 * Update company handler
 * Supports lookup by UUID (id) or tax_id
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update companies
  await requireMinLevel(employee, 1);

  // Validate id (can be UUID or tax_id)
  validateRequired(id, 'ID บริษัท');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update company (supports both UUID and tax_id)
  const company = await CompanyService.update(id, body);

  return success(company);
}

