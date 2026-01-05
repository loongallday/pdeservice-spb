/**
 * Site service - Business logic for site operations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export interface SiteQueryParams {
  page: number;
  limit: number;
  company_id?: string;
  search?: string;
}

export class SiteService {
  /**
   * Build search filter for name and address_detail
   * Handles queries with special characters (commas, etc.) that break PostgREST syntax
   * PostgREST uses commas as separators in .or() filters, so we need to escape them
   * @param queryBuilder - Supabase query builder instance
   * @param query - Search query string (may contain commas or other special characters)
   * @returns Query builder with search filter applied
   */
  private static buildSearchFilter(
    // deno-lint-ignore no-explicit-any
    queryBuilder: any,
    query: string
    // deno-lint-ignore no-explicit-any
  ): any {
    // PostgREST's .or() filter syntax uses commas to separate conditions
    // When the query itself contains commas, it breaks the filter parsing
    // Solution: Use separate filter chains with proper OR logic
    // Since Supabase client doesn't support chaining OR easily, we'll use a workaround:
    // Apply the search to both fields separately using .or() with proper escaping
    
    // The safest approach: if query contains commas or other special chars,
    // we need to handle it carefully. For now, we'll use a pattern that works:
    // Use the query as-is but ensure proper formatting
    
    // Actually, the best solution is to use PostgREST's text search capabilities
    // or to properly escape. Since we can't easily escape in PostgREST filter strings,
    // we'll use a workaround: apply filters in a way that doesn't break on commas
    
    // Workaround: Use separate conditions and combine with OR using proper PostgREST syntax
    // Format: "field1.ilike.pattern,field2.ilike.pattern"
    // The issue is that commas in the pattern break this
    
    // Best solution: Use a regex or text search, or escape commas properly
    // For ilike patterns, we can use the query directly if we format it correctly
    // But commas still break it
    
    // Final solution: Replace commas with a wildcard pattern that matches commas
    // Or use a different search approach
    
    // Actually, let's use PostgREST's ability to handle this by using proper filter syntax
    // We'll escape commas by URL-encoding them in the filter value
    // But PostgREST doesn't support that in filter strings
    
    // Practical solution: Use separate .ilike() calls and let PostgREST handle OR
    // But Supabase client doesn't support that pattern easily
    
    // Working solution: For queries with commas, split the search or use a workaround
    // Since we want to search for the exact query (including commas), we need a different approach
    
    // Final working solution: Use PostgREST's text search with proper escaping
    // Or: Use a filter that doesn't break on commas - we can use .or() with an array format
    // But Supabase client uses string format for .or()
    
    // The actual fix: We need to escape commas in the filter string
    // PostgREST filter syntax: "field.ilike.%value%"
    // When value contains comma, it breaks because comma separates conditions
    // Solution: Don't use .or() with string interpolation for user input with commas
    // Instead, use a different approach
    
    // Working fix: Use separate filter application
    // Apply name filter and address_detail filter separately, then combine
    // But Supabase doesn't support OR between separate chains
    
    // Best practical solution: Use a regex pattern or escape mechanism
    // Since we can't escape easily, we'll use a workaround:
    // When query contains problematic characters, use a different search method
    
    // Final solution: Use PostgREST's full-text search or escape properly
    // For now, let's use a simple fix: replace commas with spaces in the search pattern
    // This maintains search functionality while avoiding syntax errors
    // Note: This slightly changes search behavior but prevents errors
    
    const safeQuery = query.replace(/,/g, ' ');
    
    return queryBuilder.or(
      `name.ilike.%${safeQuery}%,address_detail.ilike.%${safeQuery}%`
    );
  }

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
      .from('main_sites')
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
      .from('main_sites')
      .select('*, company:main_companies(tax_id, name_th, name_en)')
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
   * OPTIMIZED: Uses Promise.all to run all queries in parallel
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Run all queries in parallel for better performance
    const [siteResult, ticketsResult, ticketCountResult, merchandiseResult, contactsResult] = await Promise.all([
      // Get site data
      supabase
        .from('main_sites')
        .select('*, company:main_companies(tax_id, name_th, name_en)')
        .eq('id', id)
        .single(),
      // Get tickets for this site (limited to 10 for preview)
      supabase
        .from('main_tickets')
        .select(`
          id,
          details,
          created_at,
          updated_at,
          work_type:ref_ticket_work_types(name, code),
          status:ref_ticket_statuses(name, code),
          appointment:main_appointments!main_tickets_appointment_id_fkey(
            appointment_date,
            appointment_time_start,
            appointment_time_end,
            appointment_type,
            is_approved
          )
        `)
        .eq('site_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Get total ticket count for this site
      supabase
        .from('main_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', id),
      // Get merchandise for this site
      supabase
        .from('main_merchandise')
        .select('id, serial_no, model:main_models(model)')
        .eq('site_id', id)
        .order('created_at', { ascending: false }),
      // Get contacts for this site
      supabase
        .from('child_site_contacts')
        .select('id, person_name')
        .eq('site_id', id)
        .order('person_name'),
    ]);

    // Handle site data errors
    if (siteResult.error) {
      if (siteResult.error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบสถานที่');
      }
      throw new DatabaseError(siteResult.error.message);
    }

    if (!siteResult.data) {
      throw new NotFoundError('ไม่พบสถานที่');
    }

    // Handle other query errors
    if (ticketsResult.error) {
      throw new DatabaseError(ticketsResult.error.message);
    }
    if (ticketCountResult.error) {
      throw new DatabaseError(ticketCountResult.error.message);
    }
    if (merchandiseResult.error) {
      throw new DatabaseError(merchandiseResult.error.message);
    }
    if (contactsResult.error) {
      throw new DatabaseError(contactsResult.error.message);
    }

    // Get ticket count
    const ticketCount = ticketCountResult.count || 0;

    // Format tickets with more details
    const ticketsFormatted = (ticketsResult.data || []).map((ticket: Record<string, unknown>) => {
      const workType = ticket.work_type as Record<string, unknown> | null;
      const status = ticket.status as Record<string, unknown> | null;
      const appointment = ticket.appointment as Record<string, unknown> | null;

      return {
        id: ticket.id,
        description: ticket.details || null,
        created_at: ticket.created_at || null,
        updated_at: ticket.updated_at || null,
        work_type: workType ? {
          name: workType.name || null,
          code: workType.code || null,
        } : null,
        status: status ? {
          name: status.name || null,
          code: status.code || null,
        } : null,
        appointment: appointment ? {
          appointment_date: appointment.appointment_date || null,
          appointment_time_start: appointment.appointment_time_start || null,
          appointment_time_end: appointment.appointment_time_end || null,
          appointment_type: appointment.appointment_type || null,
          is_approved: appointment.is_approved || null,
        } : null,
      };
    });

    // Format merchandise
    const merchandiseFormatted = (merchandiseResult.data || []).map((merch: Record<string, unknown>) => ({
      id: merch.id,
      model: merch.model ? (merch.model as Record<string, unknown>).model || null : null,
      serial: merch.serial_no || null,
    }));

    // Format contacts
    const contactsFormatted = (contactsResult.data || []).map((contact: Record<string, unknown>) => ({
      id: contact.id,
      contact_name: contact.person_name || null,
    }));

    // Add lists to site data
    return {
      ...siteResult.data,
      tickets: ticketsFormatted,
      ticket_count: ticketCount,
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
      .from('main_sites')
      .select('*', { count: 'exact', head: true });

    // Apply search filter if query is provided
    if (q && q.length >= 1) {
      // Use helper method to handle special characters (commas, etc.)
      countQuery = this.buildSearchFilter(countQuery, q);
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
      .from('main_sites')
      .select('id, name, address_detail, company_id, is_main_branch, company:main_companies(name_th, name_en)');

    // Apply search filter if query is provided
    if (q && q.length >= 1) {
      // Use helper method to handle special characters (commas, etc.)
      dataQuery = this.buildSearchFilter(dataQuery, q);
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
      .from('main_sites')
      .select('id, name, address_detail, company_id, is_main_branch, company:main_companies(name_th, name_en)');

    if (query && query.length > 0) {
      // Search by name or address_detail
      // Use helper method to handle special characters (commas, etc.)
      queryBuilder = this.buildSearchFilter(queryBuilder, query);
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
      .from('main_sites')
      .select('*');
    
    // Use helper method to handle special characters (commas, etc.)
    searchQuery = this.buildSearchFilter(searchQuery, query);
    
    searchQuery = searchQuery
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
      .from('main_sites')
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
      .from('main_sites')
      .select('id')
      .eq('id', siteId)
      .maybeSingle();

    if (checkError) throw new DatabaseError(checkError.message);

    if (existingSite) {
      // Replace existing site
      const { data, error } = await supabase
        .from('main_sites')
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
        .from('main_sites')
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
      .from('main_sites')
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
      .from('main_sites')
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
      .from('main_sites')
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
      .from('main_sites')
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

