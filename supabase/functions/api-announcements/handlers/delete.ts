/**
 * Delete announcement handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AnnouncementService } from '../services/announcementService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteAnnouncement(req: Request, employee: Employee, id: string) {
  // Only superadmin (level 3) can delete announcements
  await requireMinLevel(employee, 3);

  await AnnouncementService.delete(id);

  return success({ message: 'ลบประกาศสำเร็จ' });
}
