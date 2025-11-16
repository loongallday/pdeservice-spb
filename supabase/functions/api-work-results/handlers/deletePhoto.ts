/**
 * Delete photo from work result handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deletePhoto(req: Request, employee: Employee, photoId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can delete photos
  await requireMinLevel(employee, 0);

  // Validate photo ID
  validateUUID(photoId, 'Photo ID');

  // Delete photo
  await WorkResultService.deletePhoto(photoId);

  return success({ message: 'ลบรูปภาพสำเร็จ' });
}

