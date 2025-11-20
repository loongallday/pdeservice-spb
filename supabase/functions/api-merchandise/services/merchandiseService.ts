/**
 * Merchandise service - Business logic for merchandise operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import { sanitizeData } from '../_shared/sanitize.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface MerchandiseQueryParams {
  page: number;
  limit: number;
  search?: string;
  siteId?: string;
  modelId?: string;
}

export class MerchandiseService {
  /**
   * Sanitize merchandise data based on actual schema
   */
  private static sanitizeMerchandiseData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = [
      'serial_no',
      'model_id',
      'site_id',
      'pm_count',
      'distributor_id',
      'dealer_id',
      'replaced_by_id',
    ];
    return sanitizeData(data, validFields);
  }

  /**
   * Get all merchandise with pagination
   */
  static async getAll(params: MerchandiseQueryParams): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    const supabase = createServiceClient();
    const { page, limit, search, siteId, modelId } = params;

    // Build query
    let countQuery = supabase
      .from('merchandise')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('merchandise')
      .select(`
        *,
        model:models!merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:sites!merchandise_site_id_fkey (
          id,
          name
        )
      `);

    // Apply filters
    if (siteId) {
      countQuery = countQuery.eq('site_id', siteId);
      dataQuery = dataQuery.eq('site_id', siteId);
    }

    if (modelId) {
      countQuery = countQuery.eq('model_id', modelId);
      dataQuery = dataQuery.eq('model_id', modelId);
    }

    if (search) {
      countQuery = countQuery.ilike('serial_no', `%${search}%`);
      dataQuery = dataQuery.ilike('serial_no', `%${search}%`);
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[MerchandiseService] Count error:', countError);
      throw new DatabaseError(countError.message);
    }

    const total = count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    const { data, error } = await dataQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MerchandiseService] Query error:', error);
      throw new DatabaseError(error.message);
    }

    const pagination = calculatePagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Get single merchandise by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('merchandise')
      .select(`
        *,
        model:models!merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:sites!merchandise_site_id_fkey (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[MerchandiseService] GetById error:', error);
      throw new DatabaseError(error.message);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Get merchandise by site
   */
  static async getBySite(siteId: string, params: { page: number; limit: number }): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    return this.getAll({ ...params, siteId });
  }

  /**
   * Get merchandise by model
   */
  static async getByModel(modelId: string, params: { page: number; limit: number }): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    return this.getAll({ ...params, modelId });
  }

  /**
   * Create new merchandise
   */
  static async create(merchandiseData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeMerchandiseData(merchandiseData);

    // Validate required fields
    if (!sanitized.serial_no) {
      throw new ValidationError('กรุณาระบุ serial number');
    }

    if (!sanitized.model_id) {
      throw new ValidationError('กรุณาระบุ model');
    }

    if (!sanitized.site_id) {
      throw new ValidationError('กรุณาระบุ site');
    }

    // Check if model exists
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('id')
      .eq('id', sanitized.model_id)
      .single();

    if (modelError || !model) {
      throw new NotFoundError('ไม่พบ model ที่ระบุ');
    }

    // Check if site exists
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', sanitized.site_id)
      .single();

    if (siteError || !site) {
      throw new NotFoundError('ไม่พบ site ที่ระบุ');
    }

    const { data, error } = await supabase
      .from('merchandise')
      .insert(sanitized)
      .select(`
        *,
        model:models!merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:sites!merchandise_site_id_fkey (
          id,
          name
        )
      `)
      .single();

    if (error) {
      if (error.message.includes('duplicate key')) {
        throw new ValidationError('ข้อมูลซ้ำในระบบ');
      }
      throw new DatabaseError('ไม่สามารถสร้างข้อมูลได้');
    }

    return data;
  }

  /**
   * Update merchandise
   */
  static async update(id: string, merchandiseData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeMerchandiseData(merchandiseData);

    // Check if exists first
    await this.getById(id);

    // If updating model_id, check if model exists
    if (sanitized.model_id) {
      const { data: model, error: modelError } = await supabase
        .from('models')
        .select('id')
        .eq('id', sanitized.model_id)
        .single();

      if (modelError || !model) {
        throw new NotFoundError('ไม่พบ model ที่ระบุ');
      }
    }

    // If updating site_id, check if site exists
    if (sanitized.site_id) {
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('id')
        .eq('id', sanitized.site_id)
        .single();

      if (siteError || !site) {
        throw new NotFoundError('ไม่พบ site ที่ระบุ');
      }
    }

    const { data, error } = await supabase
      .from('merchandise')
      .update(sanitized)
      .eq('id', id)
      .select(`
        *,
        model:models!merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:sites!merchandise_site_id_fkey (
          id,
          name
        )
      `)
      .single();

    if (error) {
      throw new DatabaseError('ไม่สามารถอัพเดทข้อมูลได้');
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Delete merchandise
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if exists first
    await this.getById(id);

    const { error } = await supabase
      .from('merchandise')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.message.includes('foreign key')) {
        throw new ValidationError('มีข้อมูลอ้างอิงที่ใช้งานอยู่ ไม่สามารถลบได้');
      }
      throw new DatabaseError('ไม่สามารถลบข้อมูลได้');
    }
  }

  /**
   * Search merchandise by serial number
   */
  static async search(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 1) {
      return [];
    }

    const { data, error } = await supabase
      .from('merchandise')
      .select('*')
      .ilike('serial_no', `%${query}%`)
      .limit(20)
      .order('created_at', { ascending: false});

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }
}

