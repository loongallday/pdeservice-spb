/**
 * Package Service Service - Database operations for package services catalog
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export class PackageServiceService {
  /**
   * Valid fields for sanitization
   */
  private static readonly VALID_FIELDS = [
    'code',
    'name_th',
    'name_en',
    'description',
    'category',
    'duration_months',
    'is_active',
  ];

  /**
   * Sanitize data to only include valid fields
   */
  private static sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const field of this.VALID_FIELDS) {
      if (data[field] !== undefined) {
        sanitized[field] = data[field];
      }
    }
    return sanitized;
  }

  /**
   * Get all package services with pagination and optional filters
   */
  static async getAll(params: {
    page: number;
    limit: number;
    category?: string;
    is_active?: boolean;
    q?: string;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, category, is_active, q } = params;

    // Build count query
    let countQuery = supabase
      .from('ref_package_services')
      .select('*', { count: 'exact', head: true });

    if (category) {
      countQuery = countQuery.eq('category', category);
    }
    if (is_active !== undefined) {
      countQuery = countQuery.eq('is_active', is_active);
    }
    if (q) {
      countQuery = countQuery.or(
        `code.ilike.%${q}%,name_th.ilike.%${q}%,name_en.ilike.%${q}%`
      );
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Build data query
    const offset = (page - 1) * limit;
    let dataQuery = supabase
      .from('ref_package_services')
      .select('*');

    if (category) {
      dataQuery = dataQuery.eq('category', category);
    }
    if (is_active !== undefined) {
      dataQuery = dataQuery.eq('is_active', is_active);
    }
    if (q) {
      dataQuery = dataQuery.or(
        `code.ilike.%${q}%,name_th.ilike.%${q}%,name_en.ilike.%${q}%`
      );
    }

    const { data, error } = await dataQuery
      .order('category')
      .order('code')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single package service by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('ref_package_services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบรายการบริการ');
      }
      throw new DatabaseError(error.message);
    }

    return data;
  }

  /**
   * Create new package service
   */
  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitize(data);

    const { data: service, error } = await supabase
      .from('ref_package_services')
      .insert([sanitized])
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique')) {
        throw new DatabaseError('รหัสบริการซ้ำในระบบ');
      }
      throw new DatabaseError(error.message);
    }

    return service;
  }

  /**
   * Update existing package service
   */
  static async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Check if exists
    await this.getById(id);

    const sanitized = this.sanitize(data);
    if (Object.keys(sanitized).length === 0) {
      return await this.getById(id);
    }

    const { data: service, error } = await supabase
      .from('ref_package_services')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique')) {
        throw new DatabaseError('รหัสบริการซ้ำในระบบ');
      }
      throw new DatabaseError(error.message);
    }

    return service;
  }

  /**
   * Delete package service
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if exists
    await this.getById(id);

    const { error } = await supabase
      .from('ref_package_services')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        throw new DatabaseError('ไม่สามารถลบได้ เนื่องจากมีการใช้งานในแพ็คเกจของ Model');
      }
      throw new DatabaseError(error.message);
    }
  }
}

