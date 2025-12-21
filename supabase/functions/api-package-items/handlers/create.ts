/**
 * Create package item handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { PackageItemService } from '../services/packageItemService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create package items
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.code, 'รหัสอุปกรณ์');
  validateRequired(body.name_th, 'ชื่อภาษาไทย');

  // Prepare data
  const itemData: Record<string, unknown> = {
    code: body.code,
    name_th: body.name_th,
    name_en: body.name_en ?? null,
    description: body.description ?? null,
    category: body.category ?? null,
    unit: body.unit ?? 'piece',
    is_active: body.is_active ?? true,
  };

  // Create package item
  const item = await PackageItemService.create(itemData);

  return success(item, HTTP_STATUS.CREATED);
}

