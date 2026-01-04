/**
 * Delete site handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteSite(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can delete sites
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Site ID');

  // Delete site
  await SiteService.delete(id);

  return success({ message: 'ลบสถานที่สำเร็จ' }, HTTP_STATUS.OK);
}

