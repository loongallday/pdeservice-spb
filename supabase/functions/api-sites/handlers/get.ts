/**
 * Get single site handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view sites
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Site ID');

  // Get site from service
  const site = await SiteService.getById(id);

  return success(site);
}

