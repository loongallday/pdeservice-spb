/**
 * Merchandise service - Business logic for merchandise operations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import { sanitizeData } from '../../_shared/sanitize.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

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
      .from('main_merchandise')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('main_merchandise')
      .select(`
        *,
        model:main_models!main_merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:main_sites!main_merchandise_site_id_fkey (
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
      .from('main_merchandise')
      .select(`
        *,
        model:main_models!main_merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:main_sites!main_merchandise_site_id_fkey (
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
      .from('main_models')
      .select('id')
      .eq('id', sanitized.model_id)
      .single();

    if (modelError || !model) {
      throw new NotFoundError('ไม่พบ model ที่ระบุ');
    }

    // Check if site exists
    const { data: site, error: siteError } = await supabase
      .from('main_sites')
      .select('id')
      .eq('id', sanitized.site_id)
      .single();

    if (siteError || !site) {
      throw new NotFoundError('ไม่พบ site ที่ระบุ');
    }

    const { data, error } = await supabase
      .from('main_merchandise')
      .insert(sanitized)
      .select(`
        *,
        model:main_models!main_merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:main_sites!main_merchandise_site_id_fkey (
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
        .from('main_models')
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
        .from('main_sites')
        .select('id')
        .eq('id', sanitized.site_id)
        .single();

      if (siteError || !site) {
        throw new NotFoundError('ไม่พบ site ที่ระบุ');
      }
    }

    const { data, error } = await supabase
      .from('main_merchandise')
      .update(sanitized)
      .eq('id', id)
      .select(`
        *,
        model:main_models!main_merchandise_model_id_fkey (
          id,
          model,
          name,
          website_url
        ),
        site:main_sites!main_merchandise_site_id_fkey (
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
      .from('main_merchandise')
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
   * Search merchandise by serial number with pagination
   * If no query provided, returns all merchandise
   */
  static async search(
    query: string,
    pagination: { page: number; limit: number }
  ): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit } = pagination;

    // Build count query
    let countQuery = supabase
      .from('main_merchandise')
      .select('*', { count: 'exact', head: true });

    // Build data query
    let dataQuery = supabase
      .from('main_merchandise')
      .select(`
        id,
        serial_no,
        model_id,
        site_id,
        pm_count,
        site:main_sites!main_merchandise_site_id_fkey (
          id,
          name
        ),
        model:main_models!main_merchandise_model_id_fkey (
          id,
          model,
          name
        ),
        distributor_id,
        dealer_id,
        distributor:main_companies!main_merchandise_distributor_id_fkey (
          tax_id,
          name_th,
          name_en
        ),
        dealer:main_companies!main_merchandise_dealer_id_fkey (
          tax_id,
          name_th,
          name_en
        ),
        replaced_by_id,
        created_at,
        updated_at
      `);

    // Apply search filter if query is provided
    if (query && query.length > 0) {
      countQuery = countQuery.ilike('serial_no', `%${query}%`);
      dataQuery = dataQuery.ilike('serial_no', `%${query}%`);
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    // Collect all unique replaced_by_id values
    const replacedByIds = (data || [])
      .map((m: Record<string, unknown>) => m.replaced_by_id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

    // Fetch all replaced_by merchandise serial_nos in one query
    let replacedByMap: Record<string, string> = {};
    if (replacedByIds.length > 0) {
      const { data: replacedByData, error: replacedByError } = await supabase
        .from('main_merchandise')
        .select('id, serial_no')
        .in('id', replacedByIds);

      if (!replacedByError && replacedByData) {
        replacedByMap = replacedByData.reduce((acc: Record<string, string>, item: Record<string, unknown>) => {
          if (item.id && item.serial_no) {
            acc[item.id as string] = item.serial_no as string;
          }
          return acc;
        }, {});
      }
    }

    // Transform data to remove site_id, model_id, pm_count, distributor_id, dealer_id, replaced_by_id
    // and format distributor, dealer as nested objects, replaced_by as string
    const transformedData = (data || []).map((merchandise) => {
      const { site_id, model_id, pm_count, distributor_id, dealer_id, replaced_by_id, ...rest } = merchandise;
      
      return {
        ...rest,
        distributor: merchandise.distributor ? {
          id: merchandise.distributor.tax_id,
          name: merchandise.distributor.name_th || merchandise.distributor.name_en || null,
        } : null,
        dealer: merchandise.dealer ? {
          id: merchandise.dealer.tax_id,
          name: merchandise.dealer.name_th || merchandise.dealer.name_en || null,
        } : null,
        replaced_by: replaced_by_id && typeof replaced_by_id === 'string' 
          ? (replacedByMap[replaced_by_id] || null)
          : null,
      };
    });

    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get merchandise hints (up to 5 merchandise)
   * If query is empty, returns 5 merchandise ordered by created_at descending
   * If query is provided, searches by serial_no and returns up to 5 matching merchandise
   * If site_id is provided, filters by site
   */
  static async hint(query: string, siteId?: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    let queryBuilder = supabase
      .from('main_merchandise')
      .select(`
        id,
        serial_no,
        model_id,
        site_id,
        model:main_models!main_merchandise_model_id_fkey (
          id,
          model,
          name
        ),
        site:main_sites!main_merchandise_site_id_fkey (
          id,
          name
        )
      `);

    if (query && query.length > 0) {
      // Search by serial_no
      queryBuilder = queryBuilder.ilike('serial_no', `%${query}%`);
    }

    if (siteId) {
      // Filter by site_id
      queryBuilder = queryBuilder.eq('site_id', siteId);
    }

    // Always limit to 5 and order by created_at descending
    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw new DatabaseError(error.message);

    // Transform data to return with formatted fields
    const transformedData = (data || []).map((merchandise) => ({
      id: merchandise.id,
      serial_no: merchandise.serial_no,
      model_id: merchandise.model_id || null,
      site_id: merchandise.site_id || null,
      model_code: merchandise.model ? merchandise.model.model || null : null,
      model_name: merchandise.model ? merchandise.model.name || null : null,
      site_name: merchandise.site ? merchandise.site.name || null : null,
    }));

    return transformedData;
  }

  /**
   * Check if a serial number already exists
   * Returns the merchandise record if found, null otherwise
   */
  static async checkDuplicateSerial(serialNo: string): Promise<Record<string, unknown> | null> {
    const supabase = createServiceClient();

    if (!serialNo || serialNo.trim().length === 0) {
      throw new ValidationError('กรุณาระบุ serial number');
    }

    const { data, error } = await supabase
      .from('main_merchandise')
      .select('id, serial_no, model_id, site_id, created_at')
      .eq('serial_no', serialNo.trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - not a duplicate
        return null;
      }
      throw new DatabaseError(`ไม่สามารถตรวจสอบ serial number ได้: ${error.message}`);
    }

    return data || null;
  }
}

