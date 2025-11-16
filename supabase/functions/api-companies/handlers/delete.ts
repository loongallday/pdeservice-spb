/**
 * Delete company handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateRequired } from '../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deleteCompany(req: Request, employee: Employee, taxId: string) {
  // Check permissions - Level 1 and above can delete companies
  await requireMinLevel(employee, 1);

  // Validate tax ID
  validateRequired(taxId, 'เลขผู้เสียภาษี');

  // Delete company
  await CompanyService.delete(taxId);

  return success({ message: 'ลบบริษัทสำเร็จ' }, HTTP_STATUS.OK);
}

