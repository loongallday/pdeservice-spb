/**
 * Create or replace site handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function createOrReplace(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create or replace sites
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.id, 'Site ID');
  validateRequired(body.name, 'ชื่อสถานที่');
  validateRequired(body.subdistrict_code, 'รหัสตำบล');
  validateRequired(body.district_code, 'รหัสอำเภอ');
  validateRequired(body.province_code, 'รหัสจังหวัด');
  validateRequired(body.postal_code, 'รหัสไปรษณีย์');

  // Create or replace site
  const site = await SiteService.createOrReplace(body);

  return success(site);
}

