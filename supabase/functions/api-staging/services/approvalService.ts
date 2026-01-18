/**
 * Approval Service - Handle file approval/rejection and comment creation
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError, AuthorizationError } from '../../_shared/error.ts';
import { StagingService } from './stagingService.ts';
import type { StagedFile, ApproveFileInput, RejectFileInput, BulkApproveInput, BulkDeleteInput } from '../types.ts';

export class ApprovalService {
  /**
   * Approve a staged file and create a comment on the ticket
   */
  static async approve(
    id: string,
    approverId: string,
    input: ApproveFileInput = {}
  ): Promise<StagedFile> {
    const supabase = createServiceClient();

    // Get the file
    const file = await StagingService.getById(id);

    // Validate status
    if (file.status !== 'linked') {
      throw new ValidationError('ไฟล์นี้ต้องอยู่ในสถานะ "linked" ก่อนอนุมัติ');
    }

    // Validate ticket is linked
    if (!file.ticket_id) {
      throw new ValidationError('ไฟล์นี้ยังไม่ได้เชื่อมต่อกับตั๋วงาน');
    }

    // Determine if file is an image
    const isImage = this.isImageFile(file.mime_type, file.file_name);

    // Create comment content
    const commentContent = input.comment_content ||
      `ไฟล์แนบจาก ${file.employee?.name || 'ช่างเทคนิค'}: ${file.file_name}`;

    // Create comment
    const { data: comment, error: commentError } = await supabase
      .from('child_ticket_comments')
      .insert({
        ticket_id: file.ticket_id,
        author_id: approverId,
        content: commentContent,
        mentioned_employee_ids: [],
      })
      .select('id')
      .single();

    if (commentError) {
      throw new DatabaseError(`ไม่สามารถสร้างความคิดเห็นได้: ${commentError.message}`);
    }

    // Attach file/photo to comment
    if (isImage) {
      const { error: photoError } = await supabase
        .from('child_comment_photos')
        .insert({
          comment_id: comment.id,
          image_url: file.file_url,
          display_order: 0,
        });

      if (photoError) {
        console.error('[approval] Failed to attach photo:', photoError);
      }
    } else {
      const { error: fileError } = await supabase
        .from('child_comment_files')
        .insert({
          comment_id: comment.id,
          file_url: file.file_url,
          file_name: file.file_name,
          file_size: file.file_size,
          mime_type: file.mime_type,
        });

      if (fileError) {
        console.error('[approval] Failed to attach file:', fileError);
      }
    }

    // Update staged file status
    const { data: updatedFile, error: updateError } = await supabase
      .from('main_staged_files')
      .update({
        status: 'approved',
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        result_comment_id: comment.id,
      })
      .eq('id', id)
      .select(`
        id,
        employee_id,
        file_url,
        file_name,
        file_size,
        mime_type,
        ticket_id,
        status,
        approved_by,
        approved_at,
        rejection_reason,
        result_comment_id,
        expires_at,
        source,
        metadata,
        created_at,
        updated_at,
        employee:main_employees!main_staged_files_employee_id_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        ),
        ticket:main_tickets(
          id,
          ticket_code,
          work_type:ref_ticket_work_types(
            code,
            name
          )
        ),
        approver:main_employees!main_staged_files_approved_by_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .single();

    if (updateError) {
      throw new DatabaseError(`ไม่สามารถอัปเดตสถานะไฟล์ได้: ${updateError.message}`);
    }

    return updatedFile as StagedFile;
  }

  /**
   * Reject a staged file
   */
  static async reject(
    id: string,
    approverId: string,
    input: RejectFileInput
  ): Promise<StagedFile> {
    const supabase = createServiceClient();

    // Validate reason
    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError('กรุณาระบุเหตุผลในการปฏิเสธ');
    }

    // Get the file
    const file = await StagingService.getById(id);

    // Validate status
    if (file.status !== 'linked') {
      throw new ValidationError('ไฟล์นี้ต้องอยู่ในสถานะ "linked" ก่อนปฏิเสธ');
    }

    // Update staged file status - set approved_by for rejection tracking
    const { data: updatedFile, error: updateError } = await supabase
      .from('main_staged_files')
      .update({
        status: 'rejected',
        approved_by: approverId, // Track who rejected the file
        approved_at: new Date().toISOString(), // Track when file was rejected
        rejection_reason: input.reason.trim(),
      })
      .eq('id', id)
      .select(`
        id,
        employee_id,
        file_url,
        file_name,
        file_size,
        mime_type,
        ticket_id,
        status,
        approved_by,
        approved_at,
        rejection_reason,
        result_comment_id,
        expires_at,
        source,
        metadata,
        created_at,
        updated_at,
        employee:main_employees!main_staged_files_employee_id_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        ),
        ticket:main_tickets(
          id,
          ticket_code,
          work_type:ref_ticket_work_types(
            code,
            name
          )
        ),
        approver:main_employees!main_staged_files_approved_by_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .single();

    if (updateError) {
      throw new DatabaseError(`ไม่สามารถปฏิเสธไฟล์ได้: ${updateError.message}`);
    }

    return updatedFile as StagedFile;
  }

  /**
   * Bulk approve multiple files - groups files by ticket and creates one comment per ticket
   */
  static async bulkApprove(
    approverId: string,
    input: BulkApproveInput
  ): Promise<{ approved: string[]; failed: Array<{ id: string; error: string }> }> {
    if (!input.file_ids || input.file_ids.length === 0) {
      throw new ValidationError('กรุณาระบุรายการไฟล์ที่ต้องการอนุมัติ');
    }

    const supabase = createServiceClient();
    const approved: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Fetch all files at once
    const { data: files, error: fetchError } = await supabase
      .from('main_staged_files')
      .select(`
        id,
        employee_id,
        file_url,
        file_name,
        file_size,
        mime_type,
        ticket_id,
        status,
        employee:main_employees!main_staged_files_employee_id_fkey(
          id,
          name
        )
      `)
      .in('id', input.file_ids);

    if (fetchError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลไฟล์ได้: ${fetchError.message}`);
    }

    // Group files by ticket_id
    const filesByTicket = new Map<string, typeof files>();

    for (const file of files || []) {
      // Validate file
      if (file.status !== 'linked') {
        failed.push({ id: file.id, error: 'ไฟล์นี้ต้องอยู่ในสถานะ "linked" ก่อนอนุมัติ' });
        continue;
      }
      if (!file.ticket_id) {
        failed.push({ id: file.id, error: 'ไฟล์นี้ยังไม่ได้เชื่อมต่อกับตั๋วงาน' });
        continue;
      }

      // Group by ticket
      if (!filesByTicket.has(file.ticket_id)) {
        filesByTicket.set(file.ticket_id, []);
      }
      filesByTicket.get(file.ticket_id)!.push(file);
    }

    // Check for files not found
    const foundIds = new Set((files || []).map(f => f.id));
    for (const fileId of input.file_ids) {
      if (!foundIds.has(fileId)) {
        failed.push({ id: fileId, error: 'ไม่พบไฟล์' });
      }
    }

    // Process each ticket group - one comment per ticket
    for (const [ticketId, ticketFiles] of filesByTicket) {
      try {
        // Build comment content
        const employeeNames = [...new Set(ticketFiles.map(f => f.employee?.name || 'ช่างเทคนิค'))];
        const fileNames = ticketFiles.map(f => f.file_name);
        const commentContent = input.comment_content ||
          `ไฟล์แนบจาก ${employeeNames.join(', ')}:\n${fileNames.map(n => `• ${n}`).join('\n')}`;

        // Create single comment for this ticket
        const { data: comment, error: commentError } = await supabase
          .from('child_ticket_comments')
          .insert({
            ticket_id: ticketId,
            author_id: approverId,
            content: commentContent,
            mentioned_employee_ids: [],
          })
          .select('id')
          .single();

        if (commentError) {
          // Mark all files in this group as failed
          for (const file of ticketFiles) {
            failed.push({ id: file.id, error: `ไม่สามารถสร้างความคิดเห็นได้: ${commentError.message}` });
          }
          continue;
        }

        // Separate images and other files
        const imageFiles = ticketFiles.filter(f => this.isImageFile(f.mime_type, f.file_name));
        const otherFiles = ticketFiles.filter(f => !this.isImageFile(f.mime_type, f.file_name));

        // Attach all images to the comment
        if (imageFiles.length > 0) {
          const photoInserts = imageFiles.map((f, index) => ({
            comment_id: comment.id,
            image_url: f.file_url,
            display_order: index,
          }));

          const { error: photoError } = await supabase
            .from('child_comment_photos')
            .insert(photoInserts);

          if (photoError) {
            console.error('[approval] Failed to attach photos:', photoError);
          }
        }

        // Attach all other files to the comment
        if (otherFiles.length > 0) {
          const fileInserts = otherFiles.map(f => ({
            comment_id: comment.id,
            file_url: f.file_url,
            file_name: f.file_name,
            file_size: f.file_size,
            mime_type: f.mime_type,
          }));

          const { error: fileError } = await supabase
            .from('child_comment_files')
            .insert(fileInserts);

          if (fileError) {
            console.error('[approval] Failed to attach files:', fileError);
          }
        }

        // Update all staged files in this group
        const fileIds = ticketFiles.map(f => f.id);
        const { error: updateError } = await supabase
          .from('main_staged_files')
          .update({
            status: 'approved',
            approved_by: approverId,
            approved_at: new Date().toISOString(),
            result_comment_id: comment.id,
          })
          .in('id', fileIds);

        if (updateError) {
          for (const file of ticketFiles) {
            failed.push({ id: file.id, error: `ไม่สามารถอัปเดตสถานะไฟล์ได้: ${updateError.message}` });
          }
          continue;
        }

        // All files in this group approved successfully
        approved.push(...fileIds);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        for (const file of ticketFiles) {
          failed.push({ id: file.id, error: errorMessage });
        }
      }
    }

    return { approved, failed };
  }

  /**
   * Bulk delete multiple staged files
   */
  static async bulkDelete(
    input: BulkDeleteInput
  ): Promise<{ deleted: string[]; failed: Array<{ id: string; error: string }> }> {
    if (!input.file_ids || input.file_ids.length === 0) {
      throw new ValidationError('กรุณาระบุรายการไฟล์ที่ต้องการลบ');
    }

    const supabase = createServiceClient();
    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Fetch all files at once to validate
    const { data: files, error: fetchError } = await supabase
      .from('main_staged_files')
      .select('id, status')
      .in('id', input.file_ids);

    if (fetchError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลไฟล์ได้: ${fetchError.message}`);
    }

    // Check for files not found
    const foundIds = new Set((files || []).map(f => f.id));
    for (const fileId of input.file_ids) {
      if (!foundIds.has(fileId)) {
        failed.push({ id: fileId, error: 'ไม่พบไฟล์' });
      }
    }

    // Validate files - only pending or linked can be deleted
    const deletableIds: string[] = [];
    for (const file of files || []) {
      if (file.status === 'approved') {
        failed.push({ id: file.id, error: 'ไม่สามารถลบไฟล์ที่อนุมัติแล้วได้' });
      } else {
        deletableIds.push(file.id);
      }
    }

    // Delete all valid files
    if (deletableIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('main_staged_files')
        .delete()
        .in('id', deletableIds);

      if (deleteError) {
        // If bulk delete fails, mark all as failed
        for (const id of deletableIds) {
          failed.push({ id, error: `ไม่สามารถลบไฟล์ได้: ${deleteError.message}` });
        }
      } else {
        deleted.push(...deletableIds);
      }
    }

    return { deleted, failed };
  }

  /**
   * Check if file is an image based on mime type or extension
   */
  private static isImageFile(mimeType: string | null, fileName: string): boolean {
    if (mimeType && mimeType.startsWith('image/')) {
      return true;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerName = fileName.toLowerCase();
    return imageExtensions.some(ext => lowerName.endsWith(ext));
  }
}
