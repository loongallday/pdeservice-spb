/**
 * @fileoverview Ticket attachment handlers for photos and files
 * @module api-tickets/handlers/attachments
 *
 * Provides attachment functionality for tickets:
 * - GET /:id/attachments - List all attachments (photos and files)
 * - POST /:id/attachments - Add photos and/or files
 * - DELETE /:id/attachments/:attachmentId - Delete attachment (author or admin)
 *
 * @auth All operations require Level 0+ authentication
 *
 * @description
 * Attachments are categorized as photos (images) or files (documents).
 * Each type is stored separately but managed through unified endpoints.
 * The upload process expects pre-signed URLs - actual file upload is
 * handled client-side directly to storage.
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel, isAdmin } from '../../_shared/auth.ts';
import { validateUUID, parseRequestBody } from '../../_shared/validation.ts';
import { ValidationError } from '../../_shared/error.ts';
import {
  AttachmentService,
  PhotoInput,
  FileInput,
} from '../services/attachmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

interface AddAttachmentsInput {
  photos?: PhotoInput[];
  files?: FileInput[];
}

/**
 * GET /tickets/:ticketId/attachments
 * List all attachments for a ticket
 */
export async function getAttachments(
  _req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');

  const result = await AttachmentService.getByTicketId(ticketId);

  return success(result);
}

/**
 * POST /tickets/:ticketId/attachments
 * Add photos and/or files to a ticket
 */
export async function addAttachments(
  req: Request,
  employee: Employee,
  ticketId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');

  const body = await parseRequestBody<AddAttachmentsInput>(req);

  // Validate that at least one type of attachment is provided
  const hasPhotos = body.photos && body.photos.length > 0;
  const hasFiles = body.files && body.files.length > 0;

  if (!hasPhotos && !hasFiles) {
    throw new ValidationError('กรุณาระบุรูปภาพหรือไฟล์อย่างน้อย 1 รายการ');
  }

  // Add photos
  const photos = hasPhotos
    ? await AttachmentService.addPhotos(ticketId, employee.id, body.photos!)
    : [];

  // Add files
  const files = hasFiles
    ? await AttachmentService.addFiles(ticketId, employee.id, body.files!)
    : [];

  return success({ photos, files }, 201);
}

/**
 * DELETE /tickets/:ticketId/attachments/:attachmentId?type=photo|file
 * Delete a photo or file attachment
 */
export async function deleteAttachment(
  req: Request,
  employee: Employee,
  ticketId: string,
  attachmentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');
  validateUUID(attachmentId, 'Attachment ID');

  // Get type from query params
  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  if (!type || (type !== 'photo' && type !== 'file')) {
    throw new ValidationError('กรุณาระบุ type เป็น photo หรือ file');
  }

  const adminStatus = isAdmin(employee);

  if (type === 'photo') {
    await AttachmentService.deletePhoto(attachmentId, employee.id, adminStatus);
  } else {
    await AttachmentService.deleteFile(attachmentId, employee.id, adminStatus);
  }

  return success({ message: 'ลบไฟล์แนบสำเร็จ' });
}
