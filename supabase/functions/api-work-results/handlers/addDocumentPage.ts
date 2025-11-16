/**
 * Add page to document handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function addDocumentPage(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can add document pages
  await requireMinLevel(employee, 0);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.document_id, 'Document ID');
  validateRequired(body.image_url, 'Image URL');

  // Add document page
  const page = await WorkResultService.addDocumentPage(body);

  return success(page, HTTP_STATUS.CREATED);
}

