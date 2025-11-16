/**
 * Poll Service - Database operations for polls
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../_shared/error.ts';
import type { PaginationInfo } from '../_shared/response.ts';
import { calculatePagination } from '../_shared/response.ts';

export interface PollQueryParams {
  page: number;
  limit: number;
  filter?: 'all' | 'active' | 'expired';
}

export class PollService {
  /**
   * Get all polls with pagination and filters
   */
  static async getAll(params: PollQueryParams): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, filter } = params;

    let query = supabase
      .from('polls')
      .select(`*,creator:employees!polls_created_by_fkey(*)`, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filter === 'active') {
      query = query.gt('expires_at', new Date().toISOString());
    } else if (filter === 'expired') {
      query = query.lt('expires_at', new Date().toISOString());
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, count ?? 0),
    };
  }

  /**
   * Get single poll by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('polls')
      .select(`*,creator:employees!polls_created_by_fkey(*)`)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบโพล');
      }
      throw new DatabaseError(error.message);
    }

    return data;
  }

  /**
   * Create new poll
   */
  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data: poll, error } = await supabase
      .from('polls')
      .insert([data])
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);

    return poll;
  }

  /**
   * Update existing poll
   */
  static async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data: poll, error } = await supabase
      .from('polls')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);

    return poll;
  }

  /**
   * Delete poll
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('polls')
      .delete()
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Vote on poll
   */
  static async vote(pollId: string, employeeId: string, voteData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const data = {
      ...voteData,
      poll_id: pollId,
      employee_id: employeeId,
    };

    const { data: vote, error } = await supabase
      .from('poll_votes')
      .insert([data])
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);

    return vote;
  }
}

