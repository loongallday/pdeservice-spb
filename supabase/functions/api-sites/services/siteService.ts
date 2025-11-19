/**
 * Site service - Business logic for site operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface SiteQueryParams {
  page: number;
  limit: number;
  company_id?: string;
  search?: string;
}

export class SiteService {
  /**
   * Sanitize site data - remove invalid fields and keep only valid schema fields
   * Based on actual database schema: id, name, address_detail, subdistrict_code, 
   * postal_code, contact_ids, map_url, company_id, district_code, province_code, is_main_branch, safety_standard
   */
  private static sanitizeSiteData(data: Record<string, unknown>): Record<string, unknown> {
    // Only include fields that exist in the database schema
    // Excluded: id (auto-generated), created_at, updated_at (not in schema)
    // Excluded: tax_id, district, tambon, province, subdistrict_id (removed/deprecated)
    const validFields = [
      'name',
      'subdistrict_code',
      'district_code',
      'province_code',
      'postal_code',
      'address_detail',
      'map_url',
      'company_id',
      'contact_ids',
      'is_main_branch',
      'safety_standard',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const field of validFields) {
      if (field in data) {
        const value = data[field];
        // Convert undefined to null for nullable fields (all fields except 'name' are nullable)
        if (value === undefined) {
          sanitized[field] = null;
        } else {
          sanitized[field] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Get all sites with pagination and filters
   */
  static async getAll(params: SiteQueryParams): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, ...filters } = params;

    // Get total count
    let countQuery = supabase
      .from('sites')
      .select('*', { count: 'exact', head: true });

    if (filters.company_id) {
      countQuery = countQuery.eq('company_id', filters.company_id);
    }

    const { count, error: countError } = await countQuery;

    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get paginated data
    let dataQuery = supabase
      .from('sites')
      .select('*, company:companies(tax_id, name_th, name_en)')
      .order('name')
      .range(from, to);

    if (filters.company_id) {
      dataQuery = dataQuery.eq('company_id', filters.company_id);
    }

    const { data, error } = await dataQuery;

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single site by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('sites')
      .select('*, company:companies(tax_id, name_th, name_en)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบสถานที่');
      }
      throw new DatabaseError(error.message);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบสถานที่');
    }

    return data;
  }

  /**
   * Search sites by name or location
   */
  static async search(query: string, companyId?: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 2) {
      return [];
    }

    // Search by name or address_detail only
    // Note: Location codes (province_code, district_code, subdistrict_code) are integers
    // and cannot be searched using ilike. For location-based search, use the local JSON files
    // in the frontend to convert location names to codes first.
    let searchQuery = supabase
      .from('sites')
      .select('*')
      .or(`name.ilike.%${query}%,address_detail.ilike.%${query}%`)
      .limit(10)
      .order('name');

    if (companyId) {
      searchQuery = searchQuery.eq('company_id', companyId);
    }

    const { data, error } = await searchQuery;

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }

  /**
   * Get recent sites
   * Note: sites table doesn't have created_at column, so we just return by name order
   */
  static async getRecent(limit: number, companyId?: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    let query = supabase
      .from('sites')
      .select('*')
      .order('name', { ascending: true })
      .limit(limit);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }

  /**
   * Create new site
   */
  static async create(siteData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields (like district, tambon, province, subdistrict_id)
    const sanitizedData = this.sanitizeSiteData(siteData);

    const { data, error } = await supabase
      .from('sites')
      .insert([sanitizedData])
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('Failed to create site');

    return data;
  }

  /**
   * Update existing site
   */
  static async update(id: string, siteData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields (like district, tambon, province, subdistrict_id)
    const sanitizedData = this.sanitizeSiteData(siteData);

    const { data, error } = await supabase
      .from('sites')
      .update(sanitizedData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบสถานที่');

    return data;
  }

  /**
   * Delete site
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Find or create site
   */
  static async findOrCreate(siteData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Validate name is provided
    if (!siteData.name || typeof siteData.name !== 'string' || siteData.name.trim() === '') {
      throw new DatabaseError('Site name is required');
    }

    // Sanitize data to remove invalid fields (like district, tambon, province, subdistrict_id)
    const sanitizedData = this.sanitizeSiteData(siteData);

    // Ensure name is still present after sanitization
    if (!sanitizedData.name || typeof sanitizedData.name !== 'string') {
      throw new DatabaseError('Site name is required');
    }

    // Build search query - try to find existing site
    let searchQuery = supabase
      .from('sites')
      .select('*')
      .eq('name', sanitizedData.name as string);

    // Add company_id filter if provided (makes search more specific)
    if (sanitizedData.company_id) {
      searchQuery = searchQuery.eq('company_id', sanitizedData.company_id);
    }

    // Add subdistrict_code filter if provided (makes search more specific)
    if (sanitizedData.subdistrict_code !== null && sanitizedData.subdistrict_code !== undefined) {
      searchQuery = searchQuery.eq('subdistrict_code', sanitizedData.subdistrict_code);
    }

    // Use limit(1) to get at most one result
    const { data: existingSites, error: searchError } = await searchQuery.limit(1);

    if (searchError) {
      console.error('Error searching for site:', searchError);
      throw new DatabaseError(`Failed to search for site: ${searchError.message}`);
    }

    // If we found an existing site, return it
    if (existingSites && existingSites.length > 0) {
      return existingSites[0];
    }

    // Create new site
    const { data: newSite, error: createError } = await supabase
      .from('sites')
      .insert([sanitizedData])
      .select('*')
      .single();

    if (createError) {
      console.error('Error creating site:', createError);
      console.error('Site data:', sanitizedData);
      throw new DatabaseError(`Failed to create site: ${createError.message}`);
    }
    
    if (!newSite) {
      throw new DatabaseError('Failed to create site: No data returned');
    }

    return newSite;
  }
}

