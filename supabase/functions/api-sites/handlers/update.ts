/**
 * Update site handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update sites
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Site ID');

  // Parse request body
      const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update site
  const site = await SiteService.update(id, body);

  return success(site);
}

