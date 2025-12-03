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
   * Get single site by ID with tickets, merchandise, and contacts
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Get site data
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

    // Get tickets for this site (id, details, worktype)
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, details, work_type:work_types(name)')
      .eq('site_id', id)
      .order('created_at', { ascending: false });

    if (ticketsError) {
      throw new DatabaseError(ticketsError.message);
    }

    // Format tickets
    const ticketsFormatted = (tickets || []).map((ticket: Record<string, unknown>) => ({
      id: ticket.id,
      description: ticket.details || null,
      worktype: ticket.work_type ? (ticket.work_type as Record<string, unknown>).name || null : null,
    }));

    // Get merchandise for this site (id, model, serial)
    const { data: merchandise, error: merchandiseError } = await supabase
      .from('merchandise')
      .select('id, serial_no, model:models(model)')
      .eq('site_id', id)
      .order('created_at', { ascending: false });

    if (merchandiseError) {
      throw new DatabaseError(merchandiseError.message);
    }

    // Format merchandise
    const merchandiseFormatted = (merchandise || []).map((merch: Record<string, unknown>) => ({
      id: merch.id,
      model: merch.model ? (merch.model as Record<string, unknown>).model || null : null,
      serial: merch.serial_no || null,
    }));

    // Get contacts for this site (id, contact name)
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, person_name')
      .eq('site_id', id)
      .order('person_name');

    if (contactsError) {
      throw new DatabaseError(contactsError.message);
    }

    // Format contacts
    const contactsFormatted = (contacts || []).map((contact: Record<string, unknown>) => ({
      id: contact.id,
      contact_name: contact.person_name || null,
    }));

    // Add lists to site data
    return {
      ...data,
      tickets: ticketsFormatted,
      merchandise: merchandiseFormatted,
      contacts: contactsFormatted,
    };
  }

  /**
   * Global search sites by name or address_detail with pagination
   * Returns only summary fields: id, name, address_detail, company_id
   */
  static async globalSearch(params: {
    q?: string;
    page: number;
    limit: number;
    company_id?: string;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { q, page, limit, company_id } = params;

    // Build count query
    let countQuery = supabase
      .from('sites')
      .select('*', { count: 'exact', head: true });

    // Apply search filter if query is provided
    if (q && q.length >= 1) {
      countQuery = countQuery.or(
        `name.ilike.%${q}%,address_detail.ilike.%${q}%`
      );
    }

    // Apply company filter if provided
    if (company_id) {
      countQuery = countQuery.eq('company_id', company_id);
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Get paginated data - only summary fields
    const offset = (page - 1) * limit;
    let dataQuery = supabase
      .from('sites')
      .select('id, name, address_detail, company_id, is_main_branch, company:companies(name_th, name_en)');

    // Apply search filter if query is provided
    if (q && q.length >= 1) {
      dataQuery = dataQuery.or(
        `name.ilike.%${q}%,address_detail.ilike.%${q}%`
      );
    }

    // Apply company filter if provided
    if (company_id) {
      dataQuery = dataQuery.eq('company_id', company_id);
    }

    const { data, error } = await dataQuery
      .order('name')
      .range(offset, offset + limit - 1);
    
    if (error) throw new DatabaseError(error.message);
    
    // Transform data to return with description field
    const transformedData = (data || []).map((site) => ({
      id: site.id,
      name: site.name,
      description: site.address_detail || null,
      company_id: site.company_id || null,
      is_main_branch: site.is_main_branch || false,
      company_name: site.company ? (site.company.name_th || site.company.name_en || null) : null,
    }));
    
    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get site hints (up to 5 sites)
   * If query is empty, returns 5 sites ordered by name
   * If query is provided, searches and returns up to 5 matching sites
   */
  static async hint(query: string, companyId?: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    let queryBuilder = supabase
      .from('sites')
      .select('id, name, address_detail, company_id, is_main_branch, company:companies(name_th, name_en)');

    if (query && query.length > 0) {
      // Search by name or address_detail
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,address_detail.ilike.%${query}%`
      );
    }

    if (companyId) {
      queryBuilder = queryBuilder.eq('company_id', companyId);
    }

    // Always limit to 5 and order by name
    const { data, error } = await queryBuilder
      .order('name')
      .limit(5);

    if (error) throw new DatabaseError(error.message);

    // Transform data to return with description field
    const transformedData = (data || []).map((site) => ({
      id: site.id,
      name: site.name,
      description: site.address_detail || null,
      company_id: site.company_id || null,
      is_main_branch: site.is_main_branch || false,
      company_name: site.company ? (site.company.name_th || site.company.name_en || null) : null,
    }));

    return transformedData;
  }

  /**
   * Search sites by name or location (legacy, non-paginated)
   * @deprecated Use globalSearch instead
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
   * Create or replace site
   * If site with given ID exists, replaces it completely
   * If site doesn't exist, creates a new one
   */
  static async createOrReplace(siteData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Validate ID is provided
    if (!siteData.id || typeof siteData.id !== 'string') {
      throw new DatabaseError('Site ID is required for create or replace');
    }

    const siteId = siteData.id as string;

    // Sanitize data to remove invalid fields
    const sanitizedData = this.sanitizeSiteData(siteData);

    // Check if site exists
    const { data: existingSite, error: checkError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .maybeSingle();

    if (checkError) throw new DatabaseError(checkError.message);

    if (existingSite) {
      // Replace existing site
      const { data, error } = await supabase
        .from('sites')
        .update(sanitizedData)
        .eq('id', siteId)
        .select('*')
        .single();

      if (error) throw new DatabaseError(error.message);
      if (!data) throw new DatabaseError('Failed to replace site');

      return data;
    } else {
      // Create new site
      const { data, error } = await supabase
        .from('sites')
        .insert([sanitizedData])
        .select('*')
        .single();

      if (error) throw new DatabaseError(error.message);
      if (!data) throw new DatabaseError('Failed to create site');

      return data;
    }
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

