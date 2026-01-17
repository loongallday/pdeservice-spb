/**
 * Staging Service - Manage staged files
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import { LineAccountService } from './lineAccountService.ts';
import type { StagedFile, StagedFileQueryOptions, CreateStagedFileInput, LinkFileInput, GroupedFilesResponse, GroupedFileQueryOptions, TicketGroup, StagedFileStatus } from '../types.ts';

export class StagingService {
  /**
   * List staged files with filters
   */
  static async list(options: StagedFileQueryOptions = {}): Promise<{
    data: StagedFile[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page = 1, limit = 50, status, employee_id, ticket_id } = options;
    const supabase = createServiceClient();

    // Build query for count
    let countQuery = supabase
      .from('main_staged_files')
      .select('*', { count: 'exact', head: true });

    // Build query for data
    let dataQuery = supabase
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
      `);

    // Apply filters
    if (status) {
      if (Array.isArray(status)) {
        countQuery = countQuery.in('status', status);
        dataQuery = dataQuery.in('status', status);
      } else {
        countQuery = countQuery.eq('status', status);
        dataQuery = dataQuery.eq('status', status);
      }
    }
    if (employee_id) {
      countQuery = countQuery.eq('employee_id', employee_id);
      dataQuery = dataQuery.eq('employee_id', employee_id);
    }
    if (ticket_id) {
      countQuery = countQuery.eq('ticket_id', ticket_id);
      dataQuery = dataQuery.eq('ticket_id', ticket_id);
    }

    // Get count
    const { count } = await countQuery;
    const total = count || 0;
    const offset = (page - 1) * limit;

    // Get data
    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลไฟล์ได้: ${error.message}`);
    }

    return {
      data: (data || []) as StagedFile[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List staged files grouped by ticket
   */
  static async listGroupedByTicket(options: GroupedFileQueryOptions = {}): Promise<GroupedFilesResponse> {
    const { status, employee_id } = options;
    const supabase = createServiceClient();

    // Build query for all files
    let dataQuery = supabase
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
      `);

    // Apply filters
    if (status) {
      if (Array.isArray(status)) {
        dataQuery = dataQuery.in('status', status);
      } else {
        dataQuery = dataQuery.eq('status', status);
      }
    }
    if (employee_id) {
      dataQuery = dataQuery.eq('employee_id', employee_id);
    }

    // Get data ordered by ticket and created_at
    const { data, error } = await dataQuery
      .order('ticket_id', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลไฟล์ได้: ${error.message}`);
    }

    const files = (data || []) as StagedFile[];

    // Group files by ticket
    const ticketMap = new Map<string | null, TicketGroup>();
    const statusCounts: Record<StagedFileStatus, number> = {
      pending: 0,
      linked: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
    };

    for (const file of files) {
      // Count status
      statusCounts[file.status]++;

      // Group by ticket
      const ticketKey = file.ticket_id;
      if (!ticketMap.has(ticketKey)) {
        ticketMap.set(ticketKey, {
          ticket: file.ticket || null,
          files: [],
          file_count: 0,
        });
      }
      const group = ticketMap.get(ticketKey)!;
      group.files.push(file);
      group.file_count++;
    }

    // Convert map to array, with linked tickets first, then null (unlinked)
    const groupsWithTickets: TicketGroup[] = [];
    const groupWithoutTicket: TicketGroup | undefined = ticketMap.get(null);

    for (const [key, group] of ticketMap) {
      if (key !== null) {
        groupsWithTickets.push(group);
      }
    }

    // Sort groups by most recent file
    groupsWithTickets.sort((a, b) => {
      const aLatest = a.files[0]?.created_at || '';
      const bLatest = b.files[0]?.created_at || '';
      return bLatest.localeCompare(aLatest);
    });

    // Build final groups array
    const groups: TicketGroup[] = [...groupsWithTickets];
    if (groupWithoutTicket) {
      groups.push(groupWithoutTicket);
    }

    return {
      groups,
      summary: {
        total_files: files.length,
        total_groups: ticketMap.size,
        by_status: statusCounts,
      },
    };
  }

  /**
   * Get a single staged file by ID
   */
  static async getById(id: string): Promise<StagedFile> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
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
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('ไม่พบไฟล์ที่ระบุ');
    }

    return data as StagedFile;
  }

  /**
   * Create a staged file (called by n8n via LINE user ID)
   */
  static async create(input: CreateStagedFileInput): Promise<StagedFile> {
    const supabase = createServiceClient();

    // Validate required fields
    if (!input.line_user_id) {
      throw new ValidationError('กรุณาระบุ line_user_id');
    }
    if (!input.file_url) {
      throw new ValidationError('กรุณาระบุ file_url');
    }
    if (!input.file_name) {
      throw new ValidationError('กรุณาระบุ file_name');
    }

    // Get employee from LINE user ID
    const lineAccount = await LineAccountService.getEmployeeByLineUserId(input.line_user_id);

    // Insert staged file
    const { data, error } = await supabase
      .from('main_staged_files')
      .insert({
        employee_id: lineAccount.employee_id,
        file_url: input.file_url,
        file_name: input.file_name,
        file_size: input.file_size || null,
        mime_type: input.mime_type || null,
        source: input.source || 'line',
        metadata: input.metadata || {},
      })
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
        )
      `)
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถสร้างไฟล์ได้: ${error.message}`);
    }

    return data as StagedFile;
  }

  /**
   * Link a staged file to a ticket
   */
  static async linkToTicket(id: string, input: LinkFileInput): Promise<StagedFile> {
    const supabase = createServiceClient();

    // Validate ticket_id
    if (!input.ticket_id) {
      throw new ValidationError('กรุณาระบุ ticket_id');
    }

    // Get current file
    const { data: existing, error: fetchError } = await supabase
      .from('main_staged_files')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบไฟล์ที่ระบุ');
    }

    // Check status
    if (existing.status !== 'pending') {
      throw new ValidationError('ไฟล์นี้ไม่อยู่ในสถานะที่สามารถเชื่อมต่อกับตั๋วได้');
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', input.ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงานที่ระบุ');
    }

    // Update file
    const { data, error } = await supabase
      .from('main_staged_files')
      .update({
        ticket_id: input.ticket_id,
        status: 'linked',
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
        )
      `)
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถเชื่อมต่อไฟล์กับตั๋วได้: ${error.message}`);
    }

    return data as StagedFile;
  }

  /**
   * Delete a staged file
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Verify exists
    const { data: existing, error: fetchError } = await supabase
      .from('main_staged_files')
      .select('id, status, file_url')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบไฟล์ที่ระบุ');
    }

    // Don't delete approved files (they're linked to comments)
    if (existing.status === 'approved') {
      throw new ValidationError('ไม่สามารถลบไฟล์ที่ได้รับการอนุมัติแล้ว');
    }

    // Delete from storage (optional - file might be from external source)
    try {
      const fileUrl = existing.file_url;
      // Only delete from our staging bucket
      if (fileUrl.includes('staging-files')) {
        const path = fileUrl.split('staging-files/')[1];
        if (path) {
          await supabase.storage.from('staging-files').remove([path]);
        }
      }
    } catch (storageError) {
      console.error('[staging] Failed to delete file from storage:', storageError);
      // Continue with database deletion
    }

    // Delete from database
    const { error } = await supabase
      .from('main_staged_files')
      .delete()
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบไฟล์ได้: ${error.message}`);
    }
  }

  /**
   * Update staged file status (internal use)
   */
  static async updateStatus(
    id: string,
    status: string,
    additionalFields?: Record<string, unknown>
  ): Promise<void> {
    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = { status, ...additionalFields };

    const { error } = await supabase
      .from('main_staged_files')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`ไม่สามารถอัปเดตสถานะไฟล์ได้: ${error.message}`);
    }
  }
}
