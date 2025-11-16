/**
 * Add photo to work result handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function addPhoto(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can add photos
  await requireMinLevel(employee, 0);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.work_result_id, 'Work Result ID');
  validateRequired(body.image_url, 'Image URL');

  // Add photo
  const photo = await WorkResultService.addPhoto(body);

  return success(photo, HTTP_STATUS.CREATED);
}

