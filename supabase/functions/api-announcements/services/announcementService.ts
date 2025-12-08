/**
 * Announcement service - Business logic for announcement operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { DatabaseError } from '../_shared/error.ts';

export class AnnouncementService {
  /**
   * Get all announcements with photos and files
   */
  static async getAll(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // Fetch announcements with photos and files
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        photos:announcement_photos(
          id,
          image_url,
          display_order,
          created_at
        ),
        files:announcement_files(
          id,
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

    // Transform data to include photos and files as arrays
    const announcements = (data || []).map((announcement: Record<string, unknown>) => ({
      ...announcement,
      photos: Array.isArray(announcement.photos) 
        ? announcement.photos.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
            (a.display_order as number || 0) - (b.display_order as number || 0)
          )
        : [],
      files: Array.isArray(announcement.files) ? announcement.files : [],
    }));

    return announcements;
  }
}

