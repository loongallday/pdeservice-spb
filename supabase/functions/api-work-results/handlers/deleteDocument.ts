/**
 * Delete document from work result handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteDocument(req: Request, employee: Employee, documentId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can delete documents
  await requireMinLevel(employee, 0);

  // Validate document ID
  validateUUID(documentId, 'Document ID');

  // Delete document
  await WorkResultService.deleteDocument(documentId);

  return success({ message: 'ลบเอกสารสำเร็จ' });
}

