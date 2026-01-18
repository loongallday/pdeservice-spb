/**
 * Announcement service - Business logic for announcement operations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';

interface PhotoInput {
  image_url: string;
  display_order?: number;
}

interface FileInput {
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
}

interface CreateInput {
  message: string;
  photos?: PhotoInput[];
  files?: FileInput[];
}

interface UpdateInput {
  message?: string;
  photos?: PhotoInput[];
  files?: FileInput[];
}

export class AnnouncementService {
  /**
   * Get all announcements with photos and files
   */
  static async getAll(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_announcements')
      .select(`
        *,
        photos:child_announcement_photos(
          id,
          announcement_id,
          image_url,
          display_order,
          created_at
        ),
        files:child_announcement_files(
          id,
          announcement_id,
          file_url,
          file_name,
          file_size,
          mime_type,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลประกาศได้');
    }

    return (data || []).map((announcement: Record<string, unknown>) => ({
      ...announcement,
      photos: Array.isArray(announcement.photos)
        ? announcement.photos.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
            (a.display_order as number || 0) - (b.display_order as number || 0)
          )
        : [],
      files: Array.isArray(announcement.files) ? announcement.files : [],
    }));
  }

  /**
   * Get announcement by ID with photos and files
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_announcements')
      .select(`
        *,
        photos:child_announcement_photos(
          id,
          announcement_id,
          image_url,
          display_order,
          created_at
        ),
        files:child_announcement_files(
          id,
          announcement_id,
          file_url,
          file_name,
          file_size,
          mime_type,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบประกาศที่ระบุ');
      }
      throw new DatabaseError('ไม่สามารถดึงข้อมูลประกาศได้');
    }

    return {
      ...data,
      photos: Array.isArray(data.photos)
        ? data.photos.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
            (a.display_order as number || 0) - (b.display_order as number || 0)
          )
        : [],
      files: Array.isArray(data.files) ? data.files : [],
    };
  }

  /**
   * Create new announcement with photos and files
   */
  static async create(input: CreateInput): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Create announcement
    const { data: announcement, error } = await supabase
      .from('main_announcements')
      .insert({ message: input.message })
      .select()
      .single();

    if (error) {
      console.error('Error creating announcement:', error);
      throw new DatabaseError('ไม่สามารถสร้างประกาศได้');
    }

    // Add photos if provided
    if (input.photos && input.photos.length > 0) {
      const photos = input.photos.map((photo, index) => ({
        announcement_id: announcement.id,
        image_url: photo.image_url,
        display_order: photo.display_order ?? index,
      }));

      const { error: photoError } = await supabase
        .from('child_announcement_photos')
        .insert(photos);

      if (photoError) {
        console.error('Error adding photos:', photoError);
      }
    }

    // Add files if provided
    if (input.files && input.files.length > 0) {
      const files = input.files.map((file) => ({
        announcement_id: announcement.id,
        file_url: file.file_url,
        file_name: file.file_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
      }));

      const { error: fileError } = await supabase
        .from('child_announcement_files')
        .insert(files);

      if (fileError) {
        console.error('Error adding files:', fileError);
      }
    }

    // Return full announcement with photos and files
    return await this.getById(announcement.id);
  }

  /**
   * Update announcement with photos and files
   */
  static async update(id: string, input: UpdateInput): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Check if announcement exists
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('ไม่พบประกาศที่ระบุ');
    }

    // Update message if provided
    if (input.message !== undefined) {
      const { error } = await supabase
        .from('main_announcements')
        .update({ message: input.message, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error updating announcement:', error);
        throw new DatabaseError('ไม่สามารถอัปเดตประกาศได้');
      }
    }

    // Replace photos if provided
    if (input.photos !== undefined) {
      // Delete existing photos
      await supabase
        .from('child_announcement_photos')
        .delete()
        .eq('announcement_id', id);

      // Add new photos
      if (input.photos.length > 0) {
        const photos = input.photos.map((photo, index) => ({
          announcement_id: id,
          image_url: photo.image_url,
          display_order: photo.display_order ?? index,
        }));

        const { error: photoError } = await supabase
          .from('child_announcement_photos')
          .insert(photos);

        if (photoError) {
          console.error('Error adding photos:', photoError);
        }
      }
    }

    // Replace files if provided
    if (input.files !== undefined) {
      // Delete existing files
      await supabase
        .from('child_announcement_files')
        .delete()
        .eq('announcement_id', id);

      // Add new files
      if (input.files.length > 0) {
        const files = input.files.map((file) => ({
          announcement_id: id,
          file_url: file.file_url,
          file_name: file.file_name,
          file_size: file.file_size,
          mime_type: file.mime_type,
        }));

        const { error: fileError } = await supabase
          .from('child_announcement_files')
          .insert(files);

        if (fileError) {
          console.error('Error adding files:', fileError);
        }
      }
    }

    // Return updated announcement
    return await this.getById(id);
  }

  /**
   * Delete announcement and related photos/files
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if exists
    await this.getById(id);

    // Delete photos first (FK constraint)
    await supabase
      .from('child_announcement_photos')
      .delete()
      .eq('announcement_id', id);

    // Delete files
    await supabase
      .from('child_announcement_files')
      .delete()
      .eq('announcement_id', id);

    // Delete announcement
    const { error } = await supabase
      .from('main_announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting announcement:', error);
      throw new DatabaseError('ไม่สามารถลบประกาศได้');
    }
  }
}
