/**
 * Update package service handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../_shared/validation.ts';
import { ValidationError } from '../_shared/error.ts';
import { PackageServiceService } from '../services/packageServiceService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update package services
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Package Service ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Extract fields to update
  const updateData: Record<string, unknown> = {};

  if (body.code !== undefined) updateData.code = body.code;
  if (body.name_th !== undefined) updateData.name_th = body.name_th;
  if (body.name_en !== undefined) updateData.name_en = body.name_en;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.duration_months !== undefined) updateData.duration_months = body.duration_months;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  // Ensure we have at least one field to update
  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('ไม่มีข้อมูลที่จะอัปเดต');
  }

  // Update package service
  const service = await PackageServiceService.update(id, updateData);

  return success(service);
}

