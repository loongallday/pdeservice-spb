/**
 * Rating Service - Business logic for ticket customer ratings
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError, ValidationError } from '../../_shared/error.ts';

export interface RatingInput {
  serviceQualityRating: number;
  responseTimeRating: number;
  professionalismRating: number;
  customerComment?: string;
  callNotes?: string;
}

export interface RatingInfo {
  id: string;
  ticketId: string;
  serviceQualityRating: number;
  responseTimeRating: number;
  professionalismRating: number;
  averageRating: number;
  customerComment: string | null;
  callNotes: string | null;
  ratedAt: string;
  ratedBy: {
    id: string;
    code: string;
    name: string;
    nickname: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export class RatingService {
  /**
   * Validate rating value is between 1-5
   */
  private static validateRating(value: number, fieldName: string): void {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new ValidationError(`${fieldName} ต้องเป็นตัวเลข 1-5`);
    }
  }

  /**
   * Validate all rating fields
   */
  private static validateRatingInput(input: RatingInput): void {
    this.validateRating(input.serviceQualityRating, 'คะแนนคุณภาพบริการ');
    this.validateRating(input.responseTimeRating, 'คะแนนความรวดเร็ว');
    this.validateRating(input.professionalismRating, 'คะแนนความเป็นมืออาชีพ');
  }

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
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }
  }

  /**
   * Calculate average rating
   */
  private static calculateAverage(
    serviceQuality: number,
    responseTime: number,
    professionalism: number
  ): number {
    return Math.round(((serviceQuality + responseTime + professionalism) / 3) * 100) / 100;
  }

  /**
   * Transform database row to RatingInfo
   */
  private static transformToRatingInfo(row: Record<string, unknown>): RatingInfo {
    const ratedBy = row.rated_by as Record<string, unknown>;
    return {
      id: row.id as string,
      ticketId: row.ticket_id as string,
      serviceQualityRating: row.service_quality_rating as number,
      responseTimeRating: row.response_time_rating as number,
      professionalismRating: row.professionalism_rating as number,
      averageRating: this.calculateAverage(
        row.service_quality_rating as number,
        row.response_time_rating as number,
        row.professionalism_rating as number
      ),
      customerComment: row.customer_comment as string | null,
      callNotes: row.call_notes as string | null,
      ratedAt: row.rated_at as string,
      ratedBy: {
        id: ratedBy.id as string,
        code: ratedBy.code as string,
        name: ratedBy.name as string,
        nickname: ratedBy.nickname as string | null,
      },
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * Get rating for a ticket
   */
  static async getRating(ticketId: string): Promise<RatingInfo | null> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('child_ticket_ratings')
      .select(`
        id,
        ticket_id,
        service_quality_rating,
        response_time_rating,
        professionalism_rating,
        customer_comment,
        call_notes,
        rated_at,
        created_at,
        updated_at,
        rated_by:main_employees!fk_rated_by_employee(
          id,
          code,
          name,
          nickname
        )
      `)
      .eq('ticket_id', ticketId)
      .maybeSingle();

    if (error) {
      console.error('[rating] Failed to get rating:', error);
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลคะแนนได้: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.transformToRatingInfo(data);
  }

  /**
   * Create rating for a ticket
   */
  static async createRating(
    ticketId: string,
    employeeId: string,
    input: RatingInput
  ): Promise<RatingInfo> {
    // Validate input
    this.validateRatingInput(input);

    // Verify ticket exists
    await this.verifyTicketExists(ticketId);

    const supabase = createServiceClient();

    // Check if rating already exists
    const existing = await this.getRating(ticketId);
    if (existing) {
      throw new ValidationError('ตั๋วงานนี้มีคะแนนแล้ว กรุณาใช้ PUT เพื่ออัปเดต');
    }

    // Insert rating
    const { data, error } = await supabase
      .from('child_ticket_ratings')
      .insert({
        ticket_id: ticketId,
        rated_by_employee_id: employeeId,
        service_quality_rating: input.serviceQualityRating,
        response_time_rating: input.responseTimeRating,
        professionalism_rating: input.professionalismRating,
        customer_comment: input.customerComment || null,
        call_notes: input.callNotes || null,
      })
      .select(`
        id,
        ticket_id,
        service_quality_rating,
        response_time_rating,
        professionalism_rating,
        customer_comment,
        call_notes,
        rated_at,
        created_at,
        updated_at,
        rated_by:main_employees!fk_rated_by_employee(
          id,
          code,
          name,
          nickname
        )
      `)
      .single();

    if (error) {
      console.error('[rating] Failed to create rating:', error);
      throw new DatabaseError(`ไม่สามารถบันทึกคะแนนได้: ${error.message}`);
    }

    return this.transformToRatingInfo(data);
  }

  /**
   * Update rating for a ticket
   */
  static async updateRating(
    ticketId: string,
    input: RatingInput
  ): Promise<RatingInfo> {
    // Validate input
    this.validateRatingInput(input);

    const supabase = createServiceClient();

    // Check if rating exists
    const existing = await this.getRating(ticketId);
    if (!existing) {
      throw new NotFoundError('ไม่พบคะแนนสำหรับตั๋วงานนี้');
    }

    // Update rating
    const { data, error } = await supabase
      .from('child_ticket_ratings')
      .update({
        service_quality_rating: input.serviceQualityRating,
        response_time_rating: input.responseTimeRating,
        professionalism_rating: input.professionalismRating,
        customer_comment: input.customerComment || null,
        call_notes: input.callNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('ticket_id', ticketId)
      .select(`
        id,
        ticket_id,
        service_quality_rating,
        response_time_rating,
        professionalism_rating,
        customer_comment,
        call_notes,
        rated_at,
        created_at,
        updated_at,
        rated_by:main_employees!fk_rated_by_employee(
          id,
          code,
          name,
          nickname
        )
      `)
      .single();

    if (error) {
      console.error('[rating] Failed to update rating:', error);
      throw new DatabaseError(`ไม่สามารถอัปเดตคะแนนได้: ${error.message}`);
    }

    return this.transformToRatingInfo(data);
  }

  /**
   * Delete rating for a ticket
   */
  static async deleteRating(ticketId: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if rating exists
    const existing = await this.getRating(ticketId);
    if (!existing) {
      throw new NotFoundError('ไม่พบคะแนนสำหรับตั๋วงานนี้');
    }

    const { error } = await supabase
      .from('child_ticket_ratings')
      .delete()
      .eq('ticket_id', ticketId);

    if (error) {
      console.error('[rating] Failed to delete rating:', error);
      throw new DatabaseError(`ไม่สามารถลบคะแนนได้: ${error.message}`);
    }
  }
}
