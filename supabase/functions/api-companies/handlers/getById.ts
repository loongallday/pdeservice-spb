/**
 * Get single company handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateRequired } from '../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view companies
  await requireMinLevel(employee, 0);

  // Validate id (tax_id)
  validateRequired(id, 'ID บริษัท');

  // Get company from service (id is tax_id)
  const company = await CompanyService.getById(id);

  return success(company);
}

