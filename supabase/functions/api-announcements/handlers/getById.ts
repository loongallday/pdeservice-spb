/**
 * Get announcement by ID handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AnnouncementService } from '../services/announcementService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  await requireMinLevel(employee, 0);

  const announcement = await AnnouncementService.getById(id);

  return success(announcement);
}
