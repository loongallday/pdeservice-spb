/**
 * @fileoverview Merchandise service - Business logic for equipment inventory
 * @module api-merchandise/services/merchandiseService
 *
 * Provides CRUD and search operations for merchandise (equipment/UPS units):
 * - getAll(): List merchandise with pagination and filters
 * - getById(): Get single merchandise with relations
 * - getBySite(): Get merchandise filtered by site
 * - getByModel(): Get merchandise filtered by model
 * - create(): Create new merchandise (validates model/site)
 * - update(): Update merchandise
 * - delete(): Delete merchandise (checks foreign keys)
 * - search(): Search by serial number with pagination
 * - hint(): Quick search (up to 5 results)
 * - getReplacementChain(): Get equipment replacement history
 * - checkDuplicateSerial(): Check if serial number exists
 *
 * @description
 * Key Features:
 * - Serial number tracking
 * - Model reference (main_models)
 * - Site assignment (main_sites)
 * - Distributor/Dealer tracking (main_companies)
 * - Replacement chain (replaced_by_id) for equipment history
 * - PM count tracking
 *
 * Replacement Chain:
 * - Traverses both predecessors and successors
 * - Returns complete chain from oldest to newest
 * - Shows current position in chain
 *
 * @table main_merchandise - Primary merchandise data
 * @table main_models - Model reference
 * @table main_sites - Site reference
 * @table main_companies - Distributor/dealer reference
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
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[MerchandiseService] Query error:', error);
      throw new DatabaseError(error.message);
    }

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

    const pagination = calculatePagination(page, limit, total);

    return { data: transformedData, pagination };
  }

  /**
   * Get single merchandise by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
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

    // Transform to match list response format
    const { site_id, model_id, pm_count, distributor_id, dealer_id, replaced_by_id, ...rest } = data;

    // Fetch replaced_by merchandise if needed
    let replacedBySerial: string | null = null;
    if (replaced_by_id && typeof replaced_by_id === 'string') {
      const { data: replacedBy } = await supabase
        .from('main_merchandise')
        .select('serial_no')
        .eq('id', replaced_by_id)
        .maybeSingle();
      replacedBySerial = replacedBy?.serial_no || null;
    }

    return {
      ...rest,
      distributor: data.distributor ? {
        id: data.distributor.tax_id,
        name: data.distributor.name_th || data.distributor.name_en || null,
      } : null,
      dealer: data.dealer ? {
        id: data.dealer.tax_id,
        name: data.dealer.name_th || data.dealer.name_en || null,
      } : null,
      replaced_by: replacedBySerial,
    };
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
      `)
      .single();

    if (error) {
      if (error.message.includes('duplicate key')) {
        throw new ValidationError('ข้อมูลซ้ำในระบบ');
      }
      throw new DatabaseError('ไม่สามารถสร้างข้อมูลได้');
    }

    // Transform to match list response format
    const { site_id, model_id, pm_count, distributor_id, dealer_id, replaced_by_id, ...rest } = data;

    return {
      ...rest,
      distributor: data.distributor ? {
        id: data.distributor.tax_id,
        name: data.distributor.name_th || data.distributor.name_en || null,
      } : null,
      dealer: data.dealer ? {
        id: data.dealer.tax_id,
        name: data.dealer.name_th || data.dealer.name_en || null,
      } : null,
      replaced_by: replaced_by_id || null,
    };
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
      `)
      .single();

    if (error) {
      throw new DatabaseError('ไม่สามารถอัพเดทข้อมูลได้');
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    // Transform to match list response format
    const { site_id, model_id, pm_count, distributor_id, dealer_id, replaced_by_id, ...rest } = data;

    return {
      ...rest,
      distributor: data.distributor ? {
        id: data.distributor.tax_id,
        name: data.distributor.name_th || data.distributor.name_en || null,
      } : null,
      dealer: data.dealer ? {
        id: data.dealer.tax_id,
        name: data.dealer.name_th || data.dealer.name_en || null,
      } : null,
      replaced_by: replaced_by_id || null,
    };
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
   * If siteId provided, filters by site
   */
  static async search(
    query: string,
    pagination: { page: number; limit: number; siteId?: string }
  ): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, siteId } = pagination;

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

    // Apply site filter if provided
    if (siteId) {
      countQuery = countQuery.eq('site_id', siteId);
      dataQuery = dataQuery.eq('site_id', siteId);
    }

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
   * Get replacement chain/graph for a merchandise
   * Traverses both directions: predecessors (what was replaced) and successors (what replaced it)
   * Returns the complete chain from oldest to newest
   */
  static async getReplacementChain(merchandiseId: string): Promise<{
    chain: Array<{
      id: string;
      serial_no: string;
      model: { id: string; model: string; name: string | null } | null;
      site: { id: string; name: string } | null;
      replaced_by_id: string | null;
      created_at: string;
      is_current: boolean;
      position: number;
    }>;
    total: number;
    current_position: number;
  }> {
    const supabase = createServiceClient();

    // First, get the starting merchandise
    const { data: startMerchandise, error: startError } = await supabase
      .from('main_merchandise')
      .select(`
        id,
        serial_no,
        replaced_by_id,
        created_at,
        model:main_models!main_merchandise_model_id_fkey (id, model, name),
        site:main_sites!main_merchandise_site_id_fkey (id, name)
      `)
      .eq('id', merchandiseId)
      .single();

    if (startError || !startMerchandise) {
      throw new NotFoundError('ไม่พบสินค้าที่ระบุ');
    }

    // Build the chain
    const chain: Array<{
      id: string;
      serial_no: string;
      model: { id: string; model: string; name: string | null } | null;
      site: { id: string; name: string } | null;
      replaced_by_id: string | null;
      created_at: string;
      is_current: boolean;
      position: number;
    }> = [];

    const visited = new Set<string>();

    // Helper to fetch merchandise by ID
    const fetchMerchandise = async (id: string) => {
      const { data } = await supabase
        .from('main_merchandise')
        .select(`
          id,
          serial_no,
          replaced_by_id,
          created_at,
          model:main_models!main_merchandise_model_id_fkey (id, model, name),
          site:main_sites!main_merchandise_site_id_fkey (id, name)
        `)
        .eq('id', id)
        .single();
      return data;
    };

    // Helper to find merchandise that was replaced by this one
    const findPredecessor = async (id: string) => {
      const { data } = await supabase
        .from('main_merchandise')
        .select(`
          id,
          serial_no,
          replaced_by_id,
          created_at,
          model:main_models!main_merchandise_model_id_fkey (id, model, name),
          site:main_sites!main_merchandise_site_id_fkey (id, name)
        `)
        .eq('replaced_by_id', id)
        .maybeSingle();
      return data;
    };

    // 1. Traverse backwards to find all predecessors (oldest first)
    const predecessors: typeof chain = [];
    let currentId: string | null = merchandiseId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const predecessor = await findPredecessor(currentId);
      if (predecessor && !visited.has(predecessor.id)) {
        predecessors.unshift({
          id: predecessor.id,
          serial_no: predecessor.serial_no,
          model: predecessor.model as { id: string; model: string; name: string | null } | null,
          site: predecessor.site as { id: string; name: string } | null,
          replaced_by_id: predecessor.replaced_by_id,
          created_at: predecessor.created_at,
          is_current: false,
          position: 0, // Will be set later
        });
        currentId = predecessor.id;
      } else {
        break;
      }
    }

    // 2. Add the starting merchandise
    visited.clear();
    visited.add(merchandiseId);

    const currentMerchandise = {
      id: startMerchandise.id,
      serial_no: startMerchandise.serial_no,
      model: startMerchandise.model as { id: string; model: string; name: string | null } | null,
      site: startMerchandise.site as { id: string; name: string } | null,
      replaced_by_id: startMerchandise.replaced_by_id,
      created_at: startMerchandise.created_at,
      is_current: true,
      position: 0,
    };

    // 3. Traverse forwards to find all successors (newest last)
    const successors: typeof chain = [];
    let nextId: string | null = startMerchandise.replaced_by_id as string | null;

    while (nextId && !visited.has(nextId)) {
      visited.add(nextId);
      const successor = await fetchMerchandise(nextId);
      if (successor) {
        successors.push({
          id: successor.id,
          serial_no: successor.serial_no,
          model: successor.model as { id: string; model: string; name: string | null } | null,
          site: successor.site as { id: string; name: string } | null,
          replaced_by_id: successor.replaced_by_id,
          created_at: successor.created_at,
          is_current: false,
          position: 0,
        });
        nextId = successor.replaced_by_id as string | null;
      } else {
        break;
      }
    }

    // 4. Combine and set positions
    const fullChain = [...predecessors, currentMerchandise, ...successors];
    fullChain.forEach((item, index) => {
      item.position = index + 1;
    });

    const currentPosition = predecessors.length + 1;

    return {
      chain: fullChain,
      total: fullChain.length,
      current_position: currentPosition,
    };
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

