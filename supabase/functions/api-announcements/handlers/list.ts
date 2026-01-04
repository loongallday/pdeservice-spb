/**
 * List announcements handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AnnouncementService } from '../services/announcementService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view announcements
  await requireMinLevel(employee, 0);

  // Fetch announcements with photos and files
  const announcements = await AnnouncementService.getAll();

  return success(announcements);
}

