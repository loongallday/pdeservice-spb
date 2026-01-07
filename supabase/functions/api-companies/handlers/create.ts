/**
 * Create company handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create companies
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields (only name_th and name_en are required)
  validateRequired(body.name_th, 'ชื่อบริษัท (ภาษาไทย)');
  validateRequired(body.name_en, 'ชื่อบริษัท (ภาษาอังกฤษ)');

  // Create company
  const company = await CompanyService.create(body);

  return success(company, HTTP_STATUS.CREATED);
}

