/**
 * Update announcement handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { AnnouncementService } from '../services/announcementService.ts';
import type { Employee } from '../../_shared/auth.ts';

interface UpdateRequest {
  message?: string;
  photos?: { image_url: string; display_order?: number }[];
  files?: { file_url: string; file_name: string; file_size?: number; mime_type?: string }[];
}

export async function update(req: Request, employee: Employee, id: string) {
  // Only superadmin (level 3) can update announcements
  await requireMinLevel(employee, 3);

  const body: UpdateRequest = await req.json();

  // Validate message if provided
  if (body.message !== undefined) {
    if (body.message.trim().length === 0) {
      throw new ValidationError('ข้อความประกาศต้องไม่ว่างเปล่า');
    }
    if (body.message.length > 5000) {
      throw new ValidationError('ข้อความประกาศต้องไม่เกิน 5000 ตัวอักษร');
    }
  }

  const announcement = await AnnouncementService.update(id, {
    message: body.message?.trim(),
    photos: body.photos,
    files: body.files,
  });

  return success(announcement);
}
