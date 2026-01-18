/**
 * @fileoverview Ticket watcher service - Subscription management for notifications
 * @module api-tickets/services/watcherService
 *
 * Provides watcher subscription functionality:
 * - addWatcher(): Subscribe user to ticket notifications
 * - removeWatcher(): Unsubscribe user from ticket
 * - getWatchers(): Get all watchers with employee info
 * - getWatcherIds(): Get watcher IDs for notification delivery
 * - isWatching(): Check if user is watching a ticket
 * - addAutoWatchers(): Bulk add auto-watchers on ticket creation
 *
 * @description
 * Watchers receive notifications for ticket events (comments, status changes, etc.)
 *
 * Watcher Sources:
 * - manual: User clicked "watch" button
 * - auto_creator: Automatic for ticket creator
 * - auto_assigner: Automatic for ticket assigner
 * - auto_superadmin: Automatic for all superadmins
 *
 * The service uses upsert with ON CONFLICT DO NOTHING to safely handle
 * duplicate watch requests without errors.
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';

export type WatcherSource = 'manual' | 'auto_creator' | 'auto_assigner' | 'auto_superadmin';

export interface WatcherInfo {
  id: string;
  ticket_id: string;
  employee_id: string;
  added_by: string | null;
  source: WatcherSource;
  added_at: string;
  employee: {
    id: string;
    code: string;
    name: string;
    nickname: string | null;
    profile_image_url: string | null;
  };
}

export class WatcherService {
  /**
   * Add a watcher to a ticket
   * Uses ON CONFLICT DO NOTHING to prevent duplicate errors
   */
  static async addWatcher(
    ticketId: string,
    employeeId: string,
    addedBy: string | null,
    source: WatcherSource
  ): Promise<void> {
    const supabase = createServiceClient();

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Insert watcher (upsert with on conflict do nothing)
    const { error } = await supabase
      .from('jct_ticket_watchers')
      .upsert(
        {
          ticket_id: ticketId,
          employee_id: employeeId,
          added_by: addedBy,
          source,
        },
        {
          onConflict: 'ticket_id,employee_id',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      console.error('[watcher] Failed to add watcher:', error);
      throw new DatabaseError(`ไม่สามารถเพิ่มผู้ติดตามได้: ${error.message}`);
    }
  }

  /**
   * Remove a watcher from a ticket
   */
  static async removeWatcher(ticketId: string, employeeId: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('jct_ticket_watchers')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('employee_id', employeeId);

    if (error) {
      console.error('[watcher] Failed to remove watcher:', error);
      throw new DatabaseError(`ไม่สามารถลบผู้ติดตามได้: ${error.message}`);
    }
  }

  /**
   * Get all watchers for a ticket with employee info
   */
  static async getWatchers(ticketId: string): Promise<WatcherInfo[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('jct_ticket_watchers')
      .select(`
        id,
        ticket_id,
        employee_id,
        added_by,
        source,
        added_at,
        employee:main_employees!jct_ticket_watchers_employee_id_fkey(
          id,
          code,
          name,
          nickname,
          profile_image_url
        )
      `)
      .eq('ticket_id', ticketId)
      .order('added_at', { ascending: true });

    if (error) {
      console.error('[watcher] Failed to get watchers:', error);
      throw new DatabaseError(`ไม่สามารถดึงรายชื่อผู้ติดตามได้: ${error.message}`);
    }

    return (data || []).map((w) => ({
      id: w.id,
      ticket_id: w.ticket_id,
      employee_id: w.employee_id,
      added_by: w.added_by,
      source: w.source as WatcherSource,
      added_at: w.added_at,
      employee: w.employee as WatcherInfo['employee'],
    }));
  }

  /**
   * Get watcher IDs for a ticket (for notification purposes)
   */
  static async getWatcherIds(ticketId: string): Promise<string[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('jct_ticket_watchers')
      .select('employee_id')
      .eq('ticket_id', ticketId);

    if (error) {
      console.error('[watcher] Failed to get watcher IDs:', error);
      return [];
    }

    return (data || []).map((w) => w.employee_id);
  }

  /**
   * Check if an employee is watching a ticket
   */
  static async isWatching(ticketId: string, employeeId: string): Promise<boolean> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('jct_ticket_watchers')
      .select('id')
      .eq('ticket_id', ticketId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (error) {
      console.error('[watcher] Failed to check watching status:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Add auto-watchers when a ticket is created
   * Adds creator, assigner, and all superadmins as watchers (non-blocking, catches errors)
   */
  static async addAutoWatchers(
    ticketId: string,
    creatorId: string,
    assignerId: string | null
  ): Promise<void> {
    const supabase = createServiceClient();

    const records: Array<{
      ticket_id: string;
      employee_id: string;
      added_by: string | null;
      source: WatcherSource;
    }> = [];

    // Track added employee IDs to avoid duplicates
    const addedEmployeeIds = new Set<string>();

    // Add creator as watcher
    if (creatorId) {
      records.push({
        ticket_id: ticketId,
        employee_id: creatorId,
        added_by: null,
        source: 'auto_creator',
      });
      addedEmployeeIds.add(creatorId);
    }

    // Add assigner as watcher (if different from creator)
    if (assignerId && !addedEmployeeIds.has(assignerId)) {
      records.push({
        ticket_id: ticketId,
        employee_id: assignerId,
        added_by: null,
        source: 'auto_assigner',
      });
      addedEmployeeIds.add(assignerId);
    }

    // Fetch all superadmins (employees with role level 3)
    const { data: superadmins, error: superadminError } = await supabase
      .from('main_employees')
      .select(`
        id,
        role:main_org_roles!main_employees_role_id_fkey(level)
      `)
      .eq('is_active', true);

    if (superadminError) {
      console.error('[watcher] Failed to fetch superadmins:', superadminError);
    } else if (superadmins) {
      // Filter for level 3 (superadmin) and add as watchers
      for (const employee of superadmins) {
        const role = employee.role as { level: number } | null;
        if (role?.level === 3 && !addedEmployeeIds.has(employee.id)) {
          records.push({
            ticket_id: ticketId,
            employee_id: employee.id,
            added_by: null,
            source: 'auto_superadmin',
          });
          addedEmployeeIds.add(employee.id);
        }
      }
    }

    if (records.length === 0) return;

    const { error } = await supabase
      .from('jct_ticket_watchers')
      .upsert(records, {
        onConflict: 'ticket_id,employee_id',
        ignoreDuplicates: true,
      });

    if (error) {
      // Non-blocking - log error but don't throw
      console.error('[watcher] Failed to add auto-watchers:', error);
    }
  }
}
