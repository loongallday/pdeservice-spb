/**
 * Create package service handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { PackageServiceService } from '../services/packageServiceService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create package services
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.code, 'รหัสบริการ');
  validateRequired(body.name_th, 'ชื่อภาษาไทย');

  // Prepare data
  const serviceData: Record<string, unknown> = {
    code: body.code,
    name_th: body.name_th,
    name_en: body.name_en ?? null,
    description: body.description ?? null,
    category: body.category ?? null,
    duration_months: body.duration_months ?? null,
    is_active: body.is_active ?? true,
  };

  // Create package service
  const service = await PackageServiceService.create(serviceData);

  return success(service, HTTP_STATUS.CREATED);
}

