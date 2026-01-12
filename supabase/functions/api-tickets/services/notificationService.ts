/**
 * Notification Service - Business logic for in-app notifications
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

import { WatcherService } from './watcherService.ts';
import type { TicketAuditAction } from './ticketHelperService.ts';

export type NotificationType =
  | 'approval'
  | 'unapproval'
  | 'technician_confirmed'
  | 'new_comment'
  | 'mention'
  | 'ticket_update'
  | 'approval_request';

export interface NotificationCreateInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: string;
  commentId?: string;
  auditId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  ticket_id: string | null;
  comment_id: string | null;
  audit_id: string | null;
  actor_id: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    id: string;
    name: string;
    nickname?: string;
  } | null;
}

export class NotificationService {
  /**
   * Create a single notification
   */
  static async create(input: NotificationCreateInput): Promise<Notification> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_notifications')
      .insert({
        recipient_id: input.recipientId,
        type: input.type,
        title: input.title,
        message: input.message,
        ticket_id: input.ticketId || null,
        comment_id: input.commentId || null,
        audit_id: input.auditId || null,
        actor_id: input.actorId || null,
        metadata: input.metadata || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[notification] Failed to create notification:', error);
      throw new DatabaseError(`ไม่สามารถสร้างการแจ้งเตือนได้: ${error.message}`);
    }

    return data;
  }

  /**
   * Create bulk notifications (for multiple recipients)
   * Does not throw on error - notification failures should not break the main operation
   */
  static async createBulk(inputs: NotificationCreateInput[]): Promise<void> {
    if (inputs.length === 0) return;

    const supabase = createServiceClient();

    const records = inputs.map(input => ({
      recipient_id: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      ticket_id: input.ticketId || null,
      comment_id: input.commentId || null,
      audit_id: input.auditId || null,
      actor_id: input.actorId || null,
      metadata: input.metadata || null,
    }));

    const { error } = await supabase
      .from('main_notifications')
      .insert(records);

    if (error) {
      // Log error but don't throw - notification failures should not break the main operation
      console.error('[notification] Failed to create bulk notifications:', error);
    }
  }

  /**
   * Create bulk notifications with deduplication
   * Checks if similar notification already exists within a time window
   */
  static async createBulkWithDedup(
    inputs: NotificationCreateInput[],
    windowMinutes: number = 5
  ): Promise<void> {
    if (inputs.length === 0) return;

    const supabase = createServiceClient();
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Check for existing notifications within the time window
    const filteredInputs: NotificationCreateInput[] = [];

    for (const input of inputs) {
      // Build query to check for duplicates
      // Use audit_id for deduplication - each audit should only create one notification per recipient
      // This prevents system duplicates while allowing legitimate repeated actions
      let query = supabase
        .from('main_notifications')
        .select('id')
        .eq('recipient_id', input.recipientId);

      // If audit_id is provided, deduplicate by audit_id (most accurate)
      if (input.auditId) {
        query = query.eq('audit_id', input.auditId);
      } else {
        // Fallback: deduplicate by type + ticket + title within time window
        query = query
          .eq('type', input.type)
          .eq('title', input.title)
          .gte('created_at', windowStart);

        if (input.ticketId) {
          query = query.eq('ticket_id', input.ticketId);
        }
      }

      const { data: existing } = await query.limit(1);

      // Only add if no duplicate found
      if (!existing || existing.length === 0) {
        filteredInputs.push(input);
      }
    }

    // Insert the filtered (deduplicated) notifications
    if (filteredInputs.length > 0) {
      await this.createBulk(filteredInputs);
    }
  }

  /**
   * Create notifications for ticket watchers when audit events occur
   * Recipients: all watchers except the actor who triggered the event
   */
  static async createWatcherNotifications(
    ticketId: string,
    auditAction: TicketAuditAction,
    actorId: string,
    auditId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const supabase = createServiceClient();

    // Get all watchers for this ticket
    const watcherIds = await WatcherService.getWatcherIds(ticketId);

    // Filter out the actor
    let recipients = watcherIds.filter(id => id !== actorId);

    if (recipients.length === 0) return;

    // For comment_added, also exclude users who will receive comment notifications
    if (auditAction === 'comment_added' && metadata?.commentId) {
      // Get users who will receive mention/comment notifications
      const { data: previousComments } = await supabase
        .from('child_ticket_comments')
        .select('author_id')
        .eq('ticket_id', ticketId);

      const commentParticipants = new Set(
        (previousComments || []).map(c => c.author_id)
      );

      // Also add mentioned users (from metadata if available)
      const mentionedIds = (metadata?.mentionedIds as string[]) || [];
      mentionedIds.forEach(id => commentParticipants.add(id));

      // Filter out comment participants from watcher notifications
      recipients = recipients.filter(id => !commentParticipants.has(id));

      if (recipients.length === 0) return;
    }

    // Get ticket info for message
    const { data: ticket } = await supabase
      .from('main_tickets')
      .select(`
        id,
        site:main_sites(name)
      `)
      .eq('id', ticketId)
      .single();

    const siteName = (ticket?.site as { name?: string })?.name || 'ไม่ระบุสถานที่';

    // Map audit action to Thai message
    const { title, message } = this.getWatcherNotificationMessage(auditAction, siteName, metadata);

    const notifications: NotificationCreateInput[] = recipients.map(recipientId => ({
      recipientId,
      type: 'ticket_update' as NotificationType,
      title,
      message,
      ticketId,
      auditId,
      actorId,
      metadata: { audit_action: auditAction, ...metadata },
    }));

    // Create notifications for all watchers
    await this.createBulk(notifications);
  }

  /**
   * Map audit action to Thai notification message
   */
  private static getWatcherNotificationMessage(
    action: TicketAuditAction,
    siteName: string,
    metadata?: Record<string, unknown>
  ): { title: string; message: string } {
    const actionMessages: Record<TicketAuditAction, { title: string; messageTemplate: string }> = {
      'created': { title: 'ตั๋วงานใหม่ถูกสร้าง', messageTemplate: 'ตั๋วงานสำหรับ {site} ถูกสร้างขึ้น' },
      'updated': { title: 'ตั๋วงานถูกอัปเดต', messageTemplate: 'ตั๋วงานสำหรับ {site} มีการแก้ไข' },
      'deleted': { title: 'ตั๋วงานถูกลบ', messageTemplate: 'ตั๋วงานสำหรับ {site} ถูกลบ' },
      'approved': { title: 'การนัดหมายถูกอนุมัติ', messageTemplate: 'นัดหมายสำหรับ {site} ได้รับการอนุมัติ' },
      'unapproved': { title: 'การนัดหมายถูกยกเลิก', messageTemplate: 'นัดหมายสำหรับ {site} ถูกยกเลิกการอนุมัติ' },
      'technician_confirmed': { title: 'ช่างถูกยืนยัน', messageTemplate: 'มีการยืนยันช่างสำหรับงาน {site}' },
      'technician_changed': { title: 'ช่างถูกเปลี่ยน', messageTemplate: 'มีการเปลี่ยนช่างสำหรับงาน {site}' },
      'employee_assigned': { title: 'มีการมอบหมายพนักงาน', messageTemplate: 'มีการมอบหมายพนักงานให้งาน {site}' },
      'employee_removed': { title: 'พนักงานถูกถอดออก', messageTemplate: 'มีการถอดพนักงานจากงาน {site}' },
      'work_giver_set': { title: 'ผู้ว่าจ้างถูกกำหนด', messageTemplate: 'มีการกำหนดผู้ว่าจ้างให้งาน {site}' },
      'work_giver_changed': { title: 'ผู้ว่าจ้างถูกเปลี่ยน', messageTemplate: 'มีการเปลี่ยนผู้ว่าจ้างสำหรับงาน {site}' },
      'comment_added': { title: 'มีความคิดเห็นใหม่', messageTemplate: 'มีความคิดเห็นใหม่ในงาน {site}' },
    };

    const config = actionMessages[action] || {
      title: 'ตั๋วงานมีการเปลี่ยนแปลง',
      messageTemplate: 'ตั๋วงานสำหรับ {site} มีการเปลี่ยนแปลง'
    };

    return {
      title: config.title,
      message: config.messageTemplate.replace('{site}', siteName),
    };
  }

  /**
   * Get notifications for an employee (paginated)
   */
  static async getByRecipient(
    recipientId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean; search?: string } = {}
  ): Promise<{
    data: Notification[];
    pagination: PaginationInfo;
    unread_count: number;
  }> {
    const { page = 1, limit = 20, unreadOnly = false, search } = options;
    const supabase = createServiceClient();

    // Build count query
    let countQuery = supabase
      .from('main_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId);

    if (unreadOnly) {
      countQuery = countQuery.eq('is_read', false);
    }

    // Apply search filter to count query
    if (search) {
      countQuery = countQuery.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    const { count } = await countQuery;
    const total = count || 0;
    const offset = (page - 1) * limit;

    // Get unread count (always without search filter for badge display)
    const { count: unreadCount } = await supabase
      .from('main_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    // Fetch notifications with actor info
    let dataQuery = supabase
      .from('main_notifications')
      .select(`
        id,
        recipient_id,
        type,
        title,
        message,
        ticket_id,
        comment_id,
        audit_id,
        actor_id,
        is_read,
        read_at,
        metadata,
        created_at,
        actor:main_employees!main_notifications_actor_id_fkey(
          id,
          name,
          nickname
        )
      `)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      dataQuery = dataQuery.eq('is_read', false);
    }

    // Apply search filter to data query
    if (search) {
      dataQuery = dataQuery.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    const { data, error } = await dataQuery;

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงการแจ้งเตือนได้: ${error.message}`);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []) as Notification[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
      unread_count: unreadCount || 0,
    };
  }

  /**
   * Mark notification(s) as read
   * If notificationIds is not provided, marks ALL unread notifications as read
   */
  static async markAsRead(
    recipientId: string,
    notificationIds?: string[]
  ): Promise<{ updated_count: number }> {
    const supabase = createServiceClient();

    let query = supabase
      .from('main_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (notificationIds && notificationIds.length > 0) {
      query = query.in('id', notificationIds);
    }

    const { data, error } = await query.select('id');

    if (error) {
      throw new DatabaseError(`ไม่สามารถอัพเดทการแจ้งเตือนได้: ${error.message}`);
    }

    return { updated_count: data?.length || 0 };
  }

  // ============ Event-specific notification creators ============

  /**
   * Create notifications when appointment is approved/unapproved
   * Recipients: confirmed technicians for this ticket
   */
  static async createApprovalNotifications(
    ticketId: string,
    isApproved: boolean,
    actorId: string,
    auditId?: string
  ): Promise<void> {
    const supabase = createServiceClient();

    // Get confirmed technicians for this ticket
    const { data: confirmations } = await supabase
      .from('jct_ticket_employees_cf')
      .select('employee_id')
      .eq('ticket_id', ticketId);

    if (!confirmations || confirmations.length === 0) return;

    // Get ticket info for message
    const { data: ticket } = await supabase
      .from('main_tickets')
      .select(`
        id,
        site:main_sites(name)
      `)
      .eq('id', ticketId)
      .single();

    const siteName = (ticket?.site as { name?: string })?.name || 'ไม่ระบุสถานที่';

    const notifications: NotificationCreateInput[] = confirmations
      .filter(cf => cf.employee_id !== actorId) // Don't notify the actor
      .map(cf => ({
        recipientId: cf.employee_id,
        type: isApproved ? 'approval' : 'unapproval',
        title: isApproved ? 'การนัดหมายถูกอนุมัติ' : 'การนัดหมายถูกยกเลิก',
        message: isApproved
          ? `นัดหมายสำหรับ ${siteName} ได้รับการอนุมัติแล้ว`
          : `นัดหมายสำหรับ ${siteName} ถูกยกเลิกการอนุมัติ`,
        ticketId,
        auditId,
        actorId,
      }));

    await this.createBulk(notifications);
  }

  /**
   * Create notifications when technicians are confirmed
   * Recipients: the confirmed technicians
   */
  static async createTechnicianConfirmationNotifications(
    ticketId: string,
    confirmedEmployeeIds: string[],
    actorId: string,
    appointmentDate: string,
    auditId?: string
  ): Promise<void> {
    const supabase = createServiceClient();

    // Get ticket info for message
    const { data: ticket } = await supabase
      .from('main_tickets')
      .select(`
        id,
        site:main_sites(name)
      `)
      .eq('id', ticketId)
      .single();

    const siteName = (ticket?.site as { name?: string })?.name || 'ไม่ระบุสถานที่';

    const notifications: NotificationCreateInput[] = confirmedEmployeeIds
      .filter(id => id !== actorId)
      .map(employeeId => ({
        recipientId: employeeId,
        type: 'technician_confirmed',
        title: 'คุณถูกยืนยันสำหรับงาน',
        message: `คุณได้รับมอบหมายงานที่ ${siteName} วันที่ ${appointmentDate}`,
        ticketId,
        auditId,
        actorId,
        metadata: { appointment_date: appointmentDate },
      }));

    await this.createBulk(notifications);
  }

  /**
   * Create notifications for new comments
   * Recipients: mentioned users + previous commenters (excluding author)
   */
  static async createCommentNotifications(
    ticketId: string,
    commentId: string,
    authorId: string,
    mentionedIds: string[]
  ): Promise<void> {
    const supabase = createServiceClient();

    // Get previous commenters on this ticket (unique)
    const { data: previousComments } = await supabase
      .from('child_ticket_comments')
      .select('author_id')
      .eq('ticket_id', ticketId)
      .neq('id', commentId);

    const previousCommenterIds = new Set(
      (previousComments || []).map(c => c.author_id)
    );

    // Get author info
    const { data: author } = await supabase
      .from('main_employees')
      .select('name, nickname')
      .eq('id', authorId)
      .single();

    const authorName = author?.nickname || author?.name || 'พนักงาน';

    // Get ticket info
    const { data: ticket } = await supabase
      .from('main_tickets')
      .select(`
        id,
        site:main_sites(name)
      `)
      .eq('id', ticketId)
      .single();

    const siteName = (ticket?.site as { name?: string })?.name || 'ตั๋วงาน';

    const notifications: NotificationCreateInput[] = [];
    const notifiedSet = new Set<string>();

    // 1. Notify mentioned users first (higher priority)
    for (const mentionedId of mentionedIds) {
      if (mentionedId === authorId) continue;
      notifiedSet.add(mentionedId);

      notifications.push({
        recipientId: mentionedId,
        type: 'mention',
        title: 'คุณถูกกล่าวถึงในความคิดเห็น',
        message: `${authorName} กล่าวถึงคุณในความคิดเห็นของ ${siteName}`,
        ticketId,
        commentId,
        actorId: authorId,
      });
    }

    // 2. Notify previous commenters (if not already notified via mention)
    for (const commenterId of previousCommenterIds) {
      if (commenterId === authorId) continue;
      if (notifiedSet.has(commenterId)) continue;

      notifications.push({
        recipientId: commenterId,
        type: 'new_comment',
        title: 'มีความคิดเห็นใหม่',
        message: `${authorName} แสดงความคิดเห็นใน ${siteName}`,
        ticketId,
        commentId,
        actorId: authorId,
      });
    }

    await this.createBulk(notifications);
  }

  /**
   * Create notification to the original approver when a ticket is auto-unapproved due to edit
   * Finds the approver from audit log (action='approved') and notifies them
   */
  static async createUnapprovalNotificationToApprover(
    ticketId: string,
    editorId: string,
    siteName: string,
    auditId?: string
  ): Promise<void> {
    const supabase = createServiceClient();

    // Find the last approver from audit log
    const { data: approvalAudit, error } = await supabase
      .from('child_ticket_audit')
      .select('changed_by')
      .eq('ticket_id', ticketId)
      .eq('action', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !approvalAudit) {
      console.log('[notification] No approval audit found for ticket:', ticketId);
      return;
    }

    const approverId = approvalAudit.changed_by as string;

    // Don't notify if the editor is the same as the approver
    if (approverId === editorId) {
      return;
    }

    // Get editor info for the message
    const { data: editor } = await supabase
      .from('main_employees')
      .select('name, nickname')
      .eq('id', editorId)
      .single();

    const editorName = editor?.nickname || editor?.name || 'พนักงาน';

    const notification: NotificationCreateInput = {
      recipientId: approverId,
      type: 'unapproval',
      title: 'การนัดหมายถูกยกเลิกการอนุมัติ',
      message: `${editorName} แก้ไขตั๋วงาน ${siteName} ทำให้การอนุมัติถูกยกเลิก`,
      ticketId,
      auditId,
      actorId: editorId,
      metadata: { auto_unapproved: true },
    };

    await this.createBulk([notification]);
  }

  /**
   * Create notifications for all approvers when a new ticket is created
   * Recipients: all employees in jct_appointment_approvers table (except creator)
   */
  static async createApprovalRequestNotifications(
    ticketId: string,
    creatorId: string,
    siteName: string,
    workType?: string
  ): Promise<void> {
    const supabase = createServiceClient();

    // Get all approvers
    const { data: approvers, error } = await supabase
      .from('jct_appointment_approvers')
      .select('employee_id');

    if (error || !approvers || approvers.length === 0) {
      console.log('[notification] No approvers found or error:', error?.message);
      return;
    }

    // Filter out the creator
    const approverIds = approvers
      .map(a => a.employee_id)
      .filter(id => id !== creatorId);

    if (approverIds.length === 0) return;

    const workTypeText = workType ? ` (${workType})` : '';

    const notifications: NotificationCreateInput[] = approverIds.map(recipientId => ({
      recipientId,
      type: 'approval_request' as NotificationType,
      title: 'มีตั๋วงานใหม่รอการอนุมัติ',
      message: `ตั๋วงานสำหรับ ${siteName}${workTypeText} รอการอนุมัตินัดหมาย`,
      ticketId,
      actorId: creatorId,
    }));

    await this.createBulk(notifications);
  }
}
