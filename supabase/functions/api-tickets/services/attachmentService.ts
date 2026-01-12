/**
 * Attachment Service - Business logic for ticket file/photo attachments
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, AuthorizationError } from '../../_shared/error.ts';

export interface PhotoInput {
  image_url: string;
  caption?: string;
  display_order?: number;
}

export interface FileInput {
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
}

export interface TicketPhoto {
  id: string;
  ticket_id: string;
  uploaded_by: string;
  image_url: string;
  caption?: string;
  display_order: number;
  created_at: string;
  uploader?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
}

export interface TicketFile {
  id: string;
  ticket_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  uploader?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
}

export interface AttachmentsResult {
  photos: TicketPhoto[];
  files: TicketFile[];
}

export class AttachmentService {
  /**
   * Verify ticket exists
   */
  private static async verifyTicketExists(ticketId: string): Promise<void> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (error || !data) {
      throw new NotFoundError('ไม่พบตั๋วงานที่ระบุ');
    }
  }

  /**
   * Get all attachments for a ticket
   */
  static async getByTicketId(ticketId: string): Promise<AttachmentsResult> {
    const supabase = createServiceClient();

    // Verify ticket exists
    await this.verifyTicketExists(ticketId);

    // Get photos with uploader info
    const { data: photos, error: photosError } = await supabase
      .from('child_ticket_photos')
      .select(`
        id,
        ticket_id,
        uploaded_by,
        image_url,
        caption,
        display_order,
        created_at,
        uploader:main_employees!child_ticket_photos_uploaded_by_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .eq('ticket_id', ticketId)
      .order('display_order', { ascending: true });

    if (photosError) {
      throw new DatabaseError(`ไม่สามารถดึงรูปภาพได้: ${photosError.message}`);
    }

    // Get files with uploader info
    const { data: files, error: filesError } = await supabase
      .from('child_ticket_files')
      .select(`
        id,
        ticket_id,
        uploaded_by,
        file_url,
        file_name,
        file_size,
        mime_type,
        created_at,
        uploader:main_employees!child_ticket_files_uploaded_by_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (filesError) {
      throw new DatabaseError(`ไม่สามารถดึงไฟล์ได้: ${filesError.message}`);
    }

    return {
      photos: (photos || []) as TicketPhoto[],
      files: (files || []) as TicketFile[],
    };
  }

  /**
   * Add photos to a ticket
   */
  static async addPhotos(
    ticketId: string,
    employeeId: string,
    photos: PhotoInput[]
  ): Promise<TicketPhoto[]> {
    const supabase = createServiceClient();

    // Verify ticket exists
    await this.verifyTicketExists(ticketId);

    if (!photos || photos.length === 0) {
      return [];
    }

    // Get current max display_order
    const { data: existingPhotos } = await supabase
      .from('child_ticket_photos')
      .select('display_order')
      .eq('ticket_id', ticketId)
      .order('display_order', { ascending: false })
      .limit(1);

    const startOrder = existingPhotos && existingPhotos.length > 0
      ? (existingPhotos[0].display_order || 0) + 1
      : 0;

    const photoRecords = photos.map((photo, index) => ({
      ticket_id: ticketId,
      uploaded_by: employeeId,
      image_url: photo.image_url,
      caption: photo.caption || null,
      display_order: photo.display_order ?? (startOrder + index),
    }));

    const { data, error } = await supabase
      .from('child_ticket_photos')
      .insert(photoRecords)
      .select(`
        id,
        ticket_id,
        uploaded_by,
        image_url,
        caption,
        display_order,
        created_at,
        uploader:main_employees!child_ticket_photos_uploaded_by_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `);

    if (error) {
      throw new DatabaseError(`ไม่สามารถเพิ่มรูปภาพได้: ${error.message}`);
    }

    return (data || []) as TicketPhoto[];
  }

  /**
   * Add files to a ticket
   */
  static async addFiles(
    ticketId: string,
    employeeId: string,
    files: FileInput[]
  ): Promise<TicketFile[]> {
    const supabase = createServiceClient();

    // Verify ticket exists
    await this.verifyTicketExists(ticketId);

    if (!files || files.length === 0) {
      return [];
    }

    const fileRecords = files.map((file) => ({
      ticket_id: ticketId,
      uploaded_by: employeeId,
      file_url: file.file_url,
      file_name: file.file_name,
      file_size: file.file_size || null,
      mime_type: file.mime_type || null,
    }));

    const { data, error } = await supabase
      .from('child_ticket_files')
      .insert(fileRecords)
      .select(`
        id,
        ticket_id,
        uploaded_by,
        file_url,
        file_name,
        file_size,
        mime_type,
        created_at,
        uploader:main_employees!child_ticket_files_uploaded_by_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `);

    if (error) {
      throw new DatabaseError(`ไม่สามารถเพิ่มไฟล์ได้: ${error.message}`);
    }

    return (data || []) as TicketFile[];
  }

  /**
   * Delete a photo
   */
  static async deletePhoto(
    photoId: string,
    employeeId: string,
    isAdmin: boolean
  ): Promise<void> {
    const supabase = createServiceClient();

    // Verify photo exists and check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('child_ticket_photos')
      .select('id, uploaded_by')
      .eq('id', photoId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบรูปภาพที่ระบุ');
    }

    // Check permission - uploader or admin
    if (existing.uploaded_by !== employeeId && !isAdmin) {
      throw new AuthorizationError('ไม่มีสิทธิ์ลบรูปภาพนี้');
    }

    const { error: deleteError } = await supabase
      .from('child_ticket_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบรูปภาพได้: ${deleteError.message}`);
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(
    fileId: string,
    employeeId: string,
    isAdmin: boolean
  ): Promise<void> {
    const supabase = createServiceClient();

    // Verify file exists and check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('child_ticket_files')
      .select('id, uploaded_by')
      .eq('id', fileId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบไฟล์ที่ระบุ');
    }

    // Check permission - uploader or admin
    if (existing.uploaded_by !== employeeId && !isAdmin) {
      throw new AuthorizationError('ไม่มีสิทธิ์ลบไฟล์นี้');
    }

    const { error: deleteError } = await supabase
      .from('child_ticket_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบไฟล์ได้: ${deleteError.message}`);
    }
  }
}
