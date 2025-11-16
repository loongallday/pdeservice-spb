/**
 * Delete page from document handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteDocumentPage(req: Request, employee: Employee, pageId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can delete document pages
  await requireMinLevel(employee, 0);

  // Validate page ID
  validateUUID(pageId, 'Page ID');

  // Delete document page
  await WorkResultService.deleteDocumentPage(pageId);

  return success({ message: 'ลบหน้าสำเร็จ' });
}

