/**
 * Comment Service - Business logic for company comments
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError, AuthorizationError } from '../../_shared/error.ts';

export interface CommentPhotoInput {
  image_url: string;
  display_order?: number;
}

export interface CommentFileInput {
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
}

export interface CommentCreateInput {
  content: string;
  photos?: CommentPhotoInput[];
  files?: CommentFileInput[];
}

export interface CommentUpdateInput {
  content: string;
  photos?: CommentPhotoInput[];
  files?: CommentFileInput[];
}

export interface CommentPhoto {
  id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

export interface CommentFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

export interface Comment {
  id: string;
  company_id: string;
  author_id: string;
  content: string;
  mentioned_employee_ids: string[];
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
  photos?: CommentPhoto[];
  files?: CommentFile[];
}

export class CommentService {
  /**
   * Parse @mentions from comment content
   * Supports format: @[uuid] or @employee_code
   * Returns array of employee IDs
   */
  static async parseMentions(content: string): Promise<string[]> {
    // Match patterns like @[uuid] or @employee_code
    const mentionPattern = /@\[([a-f0-9-]{36})\]|@([a-zA-Z0-9_]+)/gi;
    const matches = [...content.matchAll(mentionPattern)];

    if (matches.length === 0) {
      return [];
    }

    const mentionedIds: Set<string> = new Set();
    const supabase = createServiceClient();

    for (const match of matches) {
      const uuidMatch = match[1];
      const codeMatch = match[2];

      if (uuidMatch) {
        // Direct UUID mention - verify it exists
        const { data } = await supabase
          .from('main_employees')
          .select('id')
          .eq('id', uuidMatch)
          .eq('is_active', true)
          .single();

        if (data) mentionedIds.add(data.id);
      } else if (codeMatch) {
        // Code-based mention (lookup)
        const { data } = await supabase
          .from('main_employees')
          .select('id')
          .eq('code', codeMatch)
          .eq('is_active', true)
          .single();

        if (data) mentionedIds.add(data.id);
      }
    }

    return Array.from(mentionedIds);
  }

  /**
   * Get all comments for a company (paginated)
   */
  static async getByCompanyId(
    companyId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    data: Comment[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page = 1, limit = 50 } = options;
    const supabase = createServiceClient();

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('main_companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new NotFoundError('ไม่พบบริษัทที่ระบุ');
    }

    // Count
    const { count } = await supabase
      .from('child_company_comments')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    const total = count || 0;
    const offset = (page - 1) * limit;

    // Fetch comments with author info, photos, and files
    const { data, error } = await supabase
      .from('child_company_comments')
      .select(`
        id,
        company_id,
        author_id,
        content,
        mentioned_employee_ids,
        is_edited,
        created_at,
        updated_at,
        author:main_employees!child_company_comments_author_id_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        ),
        photos:child_company_comment_photos(
          id,
          image_url,
          display_order,
          created_at
        ),
        files:child_company_comment_files(
          id,
          file_url,
          file_name,
          file_size,
          mime_type,
          created_at
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงความคิดเห็นได้: ${error.message}`);
    }

    // Transform data to sort photos by display_order
    const comments = (data || []).map((comment: Record<string, unknown>) => ({
      ...comment,
      photos: Array.isArray(comment.photos)
        ? (comment.photos as CommentPhoto[]).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        : [],
      files: Array.isArray(comment.files) ? comment.files : [],
    }));

    return {
      data: comments as Comment[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new comment
   */
  static async create(
    companyId: string,
    input: CommentCreateInput,
    authorId: string
  ): Promise<Comment> {
    const supabase = createServiceClient();

    // Validate content
    if (!input.content || input.content.trim().length === 0) {
      throw new ValidationError('กรุณาระบุเนื้อหาความคิดเห็น');
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('main_companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new NotFoundError('ไม่พบบริษัทที่ระบุ');
    }

    // Parse mentions
    const mentionedIds = await this.parseMentions(input.content);

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from('child_company_comments')
      .insert({
        company_id: companyId,
        author_id: authorId,
        content: input.content.trim(),
        mentioned_employee_ids: mentionedIds,
      })
      .select(`
        id,
        company_id,
        author_id,
        content,
        mentioned_employee_ids,
        is_edited,
        created_at,
        updated_at,
        author:main_employees!child_company_comments_author_id_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .single();

    if (insertError) {
      throw new DatabaseError(`ไม่สามารถสร้างความคิดเห็นได้: ${insertError.message}`);
    }

    // Insert photos if provided
    let photos: CommentPhoto[] = [];
    if (input.photos && input.photos.length > 0) {
      const photoRecords = input.photos.map((photo, index) => ({
        comment_id: comment.id,
        image_url: photo.image_url,
        display_order: photo.display_order ?? index,
      }));

      const { data: insertedPhotos, error: photoError } = await supabase
        .from('child_company_comment_photos')
        .insert(photoRecords)
        .select('id, image_url, display_order, created_at');

      if (photoError) {
        console.error('[comment] Failed to insert photos:', photoError);
      } else {
        photos = (insertedPhotos || []) as CommentPhoto[];
      }
    }

    // Insert files if provided
    let files: CommentFile[] = [];
    if (input.files && input.files.length > 0) {
      const fileRecords = input.files.map((file) => ({
        comment_id: comment.id,
        file_url: file.file_url,
        file_name: file.file_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
      }));

      const { data: insertedFiles, error: fileError } = await supabase
        .from('child_company_comment_files')
        .insert(fileRecords)
        .select('id, file_url, file_name, file_size, mime_type, created_at');

      if (fileError) {
        console.error('[comment] Failed to insert files:', fileError);
      } else {
        files = (insertedFiles || []) as CommentFile[];
      }
    }

    return {
      ...comment,
      photos,
      files,
    } as Comment;
  }

  /**
   * Update a comment (author only)
   */
  static async update(
    commentId: string,
    input: CommentUpdateInput,
    employeeId: string
  ): Promise<Comment> {
    const supabase = createServiceClient();

    // Validate content
    if (!input.content || input.content.trim().length === 0) {
      throw new ValidationError('กรุณาระบุเนื้อหาความคิดเห็น');
    }

    // Verify comment exists and check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('child_company_comments')
      .select('id, author_id, company_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบความคิดเห็นที่ระบุ');
    }

    if (existing.author_id !== employeeId) {
      throw new AuthorizationError('ไม่มีสิทธิ์แก้ไขความคิดเห็นนี้');
    }

    // Parse new mentions
    const mentionedIds = await this.parseMentions(input.content);

    // Update
    const { data: comment, error: updateError } = await supabase
      .from('child_company_comments')
      .update({
        content: input.content.trim(),
        mentioned_employee_ids: mentionedIds,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .select(`
        id,
        company_id,
        author_id,
        content,
        mentioned_employee_ids,
        is_edited,
        created_at,
        updated_at,
        author:main_employees!child_company_comments_author_id_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .single();

    if (updateError) {
      throw new DatabaseError(`ไม่สามารถแก้ไขความคิดเห็นได้: ${updateError.message}`);
    }

    // Handle photos - delete existing and insert new if provided
    let photos: CommentPhoto[] = [];
    if (input.photos !== undefined) {
      // Delete existing photos
      await supabase
        .from('child_company_comment_photos')
        .delete()
        .eq('comment_id', commentId);

      // Insert new photos if any
      if (input.photos.length > 0) {
        const photoRecords = input.photos.map((photo, index) => ({
          comment_id: commentId,
          image_url: photo.image_url,
          display_order: photo.display_order ?? index,
        }));

        const { data: insertedPhotos, error: photoError } = await supabase
          .from('child_company_comment_photos')
          .insert(photoRecords)
          .select('id, image_url, display_order, created_at');

        if (photoError) {
          console.error('[comment] Failed to insert photos:', photoError);
        } else {
          photos = (insertedPhotos || []) as CommentPhoto[];
        }
      }
    } else {
      // Fetch existing photos if not updating
      const { data: existingPhotos } = await supabase
        .from('child_company_comment_photos')
        .select('id, image_url, display_order, created_at')
        .eq('comment_id', commentId)
        .order('display_order');
      photos = (existingPhotos || []) as CommentPhoto[];
    }

    // Handle files - delete existing and insert new if provided
    let files: CommentFile[] = [];
    if (input.files !== undefined) {
      // Delete existing files
      await supabase
        .from('child_company_comment_files')
        .delete()
        .eq('comment_id', commentId);

      // Insert new files if any
      if (input.files.length > 0) {
        const fileRecords = input.files.map((file) => ({
          comment_id: commentId,
          file_url: file.file_url,
          file_name: file.file_name,
          file_size: file.file_size,
          mime_type: file.mime_type,
        }));

        const { data: insertedFiles, error: fileError } = await supabase
          .from('child_company_comment_files')
          .insert(fileRecords)
          .select('id, file_url, file_name, file_size, mime_type, created_at');

        if (fileError) {
          console.error('[comment] Failed to insert files:', fileError);
        } else {
          files = (insertedFiles || []) as CommentFile[];
        }
      }
    } else {
      // Fetch existing files if not updating
      const { data: existingFiles } = await supabase
        .from('child_company_comment_files')
        .select('id, file_url, file_name, file_size, mime_type, created_at')
        .eq('comment_id', commentId);
      files = (existingFiles || []) as CommentFile[];
    }

    return {
      ...comment,
      photos,
      files,
    } as Comment;
  }

  /**
   * Delete a comment (author only, or admin level 2+)
   */
  static async delete(
    commentId: string,
    employeeId: string,
    isAdmin: boolean
  ): Promise<void> {
    const supabase = createServiceClient();

    // Verify comment exists
    const { data: existing, error: fetchError } = await supabase
      .from('child_company_comments')
      .select('id, author_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบความคิดเห็นที่ระบุ');
    }

    // Check permission - author or admin
    if (existing.author_id !== employeeId && !isAdmin) {
      throw new AuthorizationError('ไม่มีสิทธิ์ลบความคิดเห็นนี้');
    }

    // Delete
    const { error: deleteError } = await supabase
      .from('child_company_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบความคิดเห็นได้: ${deleteError.message}`);
    }
  }

  /**
   * Get a single comment by ID
   */
  static async getById(commentId: string): Promise<Comment> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('child_company_comments')
      .select(`
        id,
        company_id,
        author_id,
        content,
        mentioned_employee_ids,
        is_edited,
        created_at,
        updated_at,
        author:main_employees!child_company_comments_author_id_fkey(
          id,
          name,
          code,
          nickname,
          profile_image_url
        ),
        photos:child_company_comment_photos(
          id,
          image_url,
          display_order,
          created_at
        ),
        files:child_company_comment_files(
          id,
          file_url,
          file_name,
          file_size,
          mime_type,
          created_at
        )
      `)
      .eq('id', commentId)
      .single();

    if (error || !data) {
      throw new NotFoundError('ไม่พบความคิดเห็นที่ระบุ');
    }

    // Sort photos by display_order
    const comment = {
      ...data,
      photos: Array.isArray(data.photos)
        ? (data.photos as CommentPhoto[]).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        : [],
      files: Array.isArray(data.files) ? data.files : [],
    };

    return comment as Comment;
  }
}
