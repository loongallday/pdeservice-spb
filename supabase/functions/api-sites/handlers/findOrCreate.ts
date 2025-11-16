/**
 * Find or create site handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function findOrCreate(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can find or create sites
  await requireMinLevel(employee, 1);

  // Parse request body
      const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.name, 'ชื่อสถานที่');

  // Find or create site
  const site = await SiteService.findOrCreate(body);

  return success(site, HTTP_STATUS.OK);
}

