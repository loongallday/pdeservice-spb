/**
 * Create announcement handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { AnnouncementService } from '../services/announcementService.ts';
import type { Employee } from '../../_shared/auth.ts';

interface CreateRequest {
  message: string;
  photos?: { image_url: string; display_order?: number }[];
  files?: { file_url: string; file_name: string; file_size?: number; mime_type?: string }[];
}

export async function create(req: Request, employee: Employee) {
  // Only superadmin (level 3) can create announcements
  await requireMinLevel(employee, 3);

  const body: CreateRequest = await req.json();

  // Validate
  if (!body.message || body.message.trim().length === 0) {
    throw new ValidationError('กรุณาระบุข้อความประกาศ');
  }

  if (body.message.length > 5000) {
    throw new ValidationError('ข้อความประกาศต้องไม่เกิน 5000 ตัวอักษร');
  }

  const announcement = await AnnouncementService.create({
    message: body.message.trim(),
    photos: body.photos,
    files: body.files,
  });

  return success(announcement);
}
