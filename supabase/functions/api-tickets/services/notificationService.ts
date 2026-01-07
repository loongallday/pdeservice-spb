/**
 * Notification Service - Business logic for in-app notifications
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export type NotificationType =
  | 'approval'
  | 'unapproval'
  | 'technician_confirmed'
  | 'new_comment'
  | 'mention';

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
   * Get notifications for an employee (paginated)
   */
  static async getByRecipient(
    recipientId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ): Promise<{
    data: Notification[];
    pagination: PaginationInfo;
    unread_count: number;
  }> {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const supabase = createServiceClient();

    // Build count query
    let countQuery = supabase
      .from('main_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId);

    if (unreadOnly) {
      countQuery = countQuery.eq('is_read', false);
    }

    const { count } = await countQuery;
    const total = count || 0;
    const offset = (page - 1) * limit;

    // Get unread count (always)
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
}
