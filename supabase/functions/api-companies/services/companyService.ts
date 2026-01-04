/**
 * Company service - Business logic for company operations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import { sanitizeData } from '../../_shared/sanitize.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export interface CompanyQueryParams {
  page: number;
  limit: number;
  search?: string;
}

export class CompanyService {
  /**
   * Sanitize company data - based on actual schema
   * Schema: tax_id (PK), name_th, name_en, type, status, objective, objective_code,
   * register_date, register_capital, branch_name, address_full, address_no, address_moo,
   * address_building, address_floor, address_room_no, address_soi, address_yaek, address_trok,
   * address_village, address_road, address_tambon, address_district, address_province,
   * address_tambon_code, address_district_code, address_province_code, address_detail,
   * created_at (auto), updated_at (auto)
   */
  private static sanitizeCompanyData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = [
      'tax_id', 'name_th', 'name_en', 'type', 'status', 'objective', 'objective_code',
      'register_date', 'register_capital', 'branch_name', 'address_full', 'address_no', 
      'address_moo', 'address_building', 'address_floor', 'address_room_no', 'address_soi', 
      'address_yaek', 'address_trok', 'address_village', 'address_road', 'address_tambon', 
      'address_district', 'address_province', 'address_tambon_code', 'address_district_code', 
      'address_province_code', 'address_detail',
    ];
    return sanitizeData(data, validFields);
  }

  /**
   * Get all companies with pagination
   */
  static async getAll(params: CompanyQueryParams): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit } = params;

    // Get total count
    const { count, error: countError } = await supabase
      .from('main_companies')
      .select('*', { count: 'exact', head: true });

    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get paginated data
    const { data, error } = await supabase
      .from('main_companies')
      .select('*')
      .order('name_th')
      .range(from, to);

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single company by ID (UUID) or tax_id with sites list
   * Supports both UUID format and tax_id format for backwards compatibility
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Check if input is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    // Get company data - lookup by id (UUID) or tax_id based on input format
    const { data, error } = await supabase
      .from('main_companies')
      .select('*')
      .eq(isUuid ? 'id' : 'tax_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบข้อมูลบริษัท');
      }
      throw new DatabaseError(error.message);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูลบริษัท');
    }

    // Get sites for this company (only id, name, and is_main_branch)
    // Note: company_id in main_sites is UUID, so use data.id (not tax_id)
    const { data: sites, error: sitesError } = await supabase
      .from('main_sites')
      .select('id, name, is_main_branch')
      .eq('company_id', data.id)
      .order('name');

    if (sitesError) {
      throw new DatabaseError(sitesError.message);
    }

    // Separate main branch site from regular sites
    const allSites = sites || [];
    const mainSite = allSites.find((site: Record<string, unknown>) => site.is_main_branch === true);
    const regularSites = allSites.filter((site: Record<string, unknown>) => site.is_main_branch !== true);

    // Format main site (only id and name)
    const mainSiteFormatted = mainSite ? {
      id: mainSite.id,
      name: mainSite.name,
    } : null;

    // Format regular sites (only id and name)
    const sitesFormatted = regularSites.map((site: Record<string, unknown>) => ({
      id: site.id,
      name: site.name,
    }));

    // Add sites list to company data
    return {
      ...data,
      'main-site': mainSiteFormatted,
      sites: sitesFormatted,
    };
  }

  /**
   * Global search companies by name or tax ID with pagination
   * Optimized with database indexes (B-tree and GIN trigram indexes)
   * for efficient ILIKE pattern matching
   */
  static async globalSearch(params: {
    q?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { q, page, limit } = params;

    // Require minimum 2 characters for search to prevent expensive full-table scans
    // Shorter queries can be handled but may be slower without proper filtering
    const searchQuery = q && q.trim().length >= 2 ? q.trim() : undefined;

    // Build count query
    let countQuery = supabase
      .from('main_companies')
      .select('*', { count: 'exact', head: true });

    // Apply search filter if query is provided
    // PostgreSQL will automatically use GIN trigram indexes (idx_companies_*_trgm)
    // for efficient ILIKE pattern matching with leading wildcards
    if (searchQuery) {
      countQuery = countQuery.or(
        `name_th.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%,tax_id.ilike.%${searchQuery}%`
      );
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Get paginated data - only return summary fields
    // Using specific field selection reduces data transfer and improves performance
    const offset = (page - 1) * limit;
    let dataQuery = supabase
      .from('main_companies')
      .select('tax_id, name_th, name_en, address_detail');

    // Apply search filter if query is provided
    // Trigram indexes will be used automatically by PostgreSQL query planner
    if (searchQuery) {
      dataQuery = dataQuery.or(
        `name_th.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%,tax_id.ilike.%${searchQuery}%`
      );
    }

    const { data, error } = await dataQuery
      .order('name_th')
      .range(offset, offset + limit - 1);
    
    if (error) throw new DatabaseError(error.message);
    
    // Transform data to return only required fields with aggregated description
    const transformedData = (data || []).map((company) => ({
      tax_id: company.tax_id,
      name_th: company.name_th,
      name_en: company.name_en,
      description: company.address_detail || null,
    }));
    
    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Search companies by name or tax ID (legacy, non-paginated)
   * @deprecated Use globalSearch instead
   */
  static async search(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 2) {
      return [];
    }

    const { data, error } = await supabase
      .from('main_companies')
      .select('*')
      .or(`name_th.ilike.%${query}%,name_en.ilike.%${query}%,tax_id.ilike.%${query}%`)
      .limit(10)
      .order('name_th');

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }

  /**
   * Get company hints (up to 5 companies)
   * If query is empty, returns 5 most recent companies
   * If query is provided, searches and returns up to 5 matching companies
   */
  static async hint(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    let queryBuilder = supabase
      .from('main_companies')
      .select('*');

    if (query && query.length > 0) {
      // Search by name or tax_id
      queryBuilder = queryBuilder.or(
        `name_th.ilike.%${query}%,name_en.ilike.%${query}%,tax_id.ilike.%${query}%`
      );
    }

    // Always limit to 5 and order by created_at descending
    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }

  /**
   * Create new company or update existing one if tax_id already exists
   */
  static async create(companyData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields
    const sanitizedData = this.sanitizeCompanyData(companyData);

    // Use upsert to insert or update based on tax_id (primary key)
    // This will replace the entire record if tax_id already exists
    const { data, error } = await supabase
      .from('main_companies')
      .upsert([sanitizedData], {
        onConflict: 'tax_id',
        ignoreDuplicates: false,
      })
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('Failed to create or update company');

    // Check if main branch site exists for this company
    // Note: company_id in main_sites is UUID, so use data.id (not tax_id)
    const { data: mainBranchSite } = await supabase
      .from('main_sites')
      .select('id')
      .eq('company_id', data.id)
      .eq('is_main_branch', true)
      .maybeSingle();

    if (mainBranchSite) {
      // Update existing main branch site with new address info
      await this.updateMainBranchSite(data);
    } else {
      // Create new main branch site
      await this.createHeadOfficeSite(data);
    }

    return data;
  }

  /**
   * Create head office site for a company
   * Site name: "สำนักงานใหญ่ (company name)"
   * Sets is_main_branch = true
   */
  private static async createHeadOfficeSite(company: Record<string, unknown>): Promise<void> {
    const { SiteService } = await import('../../api-sites/services/siteService.ts');

    // Prepare site data from company address info
    // Note: company_id in main_sites is UUID, so use company.id (not tax_id)
    const siteData: Record<string, unknown> = {
      name: `สำนักงานใหญ่ (${company.name_th})`,
      company_id: company.id,
      address_detail: company.address_detail || company.address_full || null,
      is_main_branch: true,
    };

    // Map address codes (convert string to integer if needed)
    if (company.address_tambon_code) {
      const subdistrictCode = typeof company.address_tambon_code === 'string' 
        ? parseInt(company.address_tambon_code, 10) 
        : company.address_tambon_code;
      if (!isNaN(subdistrictCode as number)) {
        siteData.subdistrict_code = subdistrictCode;
      }
    }

    if (company.address_district_code) {
      const districtCode = typeof company.address_district_code === 'string'
        ? parseInt(company.address_district_code, 10)
        : company.address_district_code;
      if (!isNaN(districtCode as number)) {
        siteData.district_code = districtCode;
      }
    }

    if (company.address_province_code) {
      const provinceCode = typeof company.address_province_code === 'string'
        ? parseInt(company.address_province_code, 10)
        : company.address_province_code;
      if (!isNaN(provinceCode as number)) {
        siteData.province_code = provinceCode;
      }
    }

    // Create the site (errors will be thrown and handled by caller)
    await SiteService.create(siteData);
  }

  /**
   * Update main branch site with company address info
   * Ensures only one main branch exists per company
   */
  private static async updateMainBranchSite(company: Record<string, unknown>): Promise<void> {
    const supabase = createServiceClient();

    // Find all main branch sites for this company (should only be one, but handle multiple)
    // Note: company_id in main_sites is UUID, so use company.id (not tax_id)
    const { data: mainBranchSites, error: findError } = await supabase
      .from('main_sites')
      .select('id')
      .eq('company_id', company.id as string)
      .eq('is_main_branch', true);

    if (findError) throw new DatabaseError(`Failed to find main branch site: ${findError.message}`);
    
    if (!mainBranchSites || mainBranchSites.length === 0) {
      // If no main branch found, create one
      await this.createHeadOfficeSite(company);
      return;
    }

    // If multiple main branches exist (shouldn't happen due to unique constraint, but handle it)
    // Keep only the first one and update it
    const mainBranchSite = mainBranchSites[0];
    
    // If there are multiple, unset is_main_branch for the others
    if (mainBranchSites.length > 1) {
      const otherSiteIds = mainBranchSites.slice(1).map(s => s.id);
      const { error: unsetError } = await supabase
        .from('main_sites')
        .update({ is_main_branch: false })
        .in('id', otherSiteIds);
      
      if (unsetError) {
        throw new DatabaseError(`Failed to unset duplicate main branches: ${unsetError.message}`);
      }
    }

    // Prepare update data from company address info
    const updateData: Record<string, unknown> = {
      name: `สำนักงานใหญ่ (${company.name_th})`,
      address_detail: company.address_detail || company.address_full || null,
    };

    // Map address codes (convert string to integer if needed)
    if (company.address_tambon_code) {
      const subdistrictCode = typeof company.address_tambon_code === 'string' 
        ? parseInt(company.address_tambon_code, 10) 
        : company.address_tambon_code;
      if (!isNaN(subdistrictCode as number)) {
        updateData.subdistrict_code = subdistrictCode;
      } else {
        updateData.subdistrict_code = null;
      }
    } else {
      updateData.subdistrict_code = null;
    }

    if (company.address_district_code) {
      const districtCode = typeof company.address_district_code === 'string'
        ? parseInt(company.address_district_code, 10)
        : company.address_district_code;
      if (!isNaN(districtCode as number)) {
        updateData.district_code = districtCode;
      } else {
        updateData.district_code = null;
      }
    } else {
      updateData.district_code = null;
    }

    if (company.address_province_code) {
      const provinceCode = typeof company.address_province_code === 'string'
        ? parseInt(company.address_province_code, 10)
        : company.address_province_code;
      if (!isNaN(provinceCode as number)) {
        updateData.province_code = provinceCode;
      } else {
        updateData.province_code = null;
      }
    } else {
      updateData.province_code = null;
    }

    // Update the main branch site
    const { error: updateError } = await supabase
      .from('main_sites')
      .update(updateData)
      .eq('id', mainBranchSite.id);

    if (updateError) throw new DatabaseError(`Failed to update main branch site: ${updateError.message}`);
  }

  /**
   * Update existing company
   * Supports both UUID (id) and tax_id for lookup
   */
  static async update(id: string, companyData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields
    const sanitizedData = this.sanitizeCompanyData(companyData);

    // Check if input is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    const { data, error } = await supabase
      .from('main_companies')
      .update(sanitizedData)
      .eq(isUuid ? 'id' : 'tax_id', id)
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลบริษัท');

    // Update main branch site if address info changed
    // Note: company_id in main_sites is UUID, so use data.id (not tax_id)
    const { data: mainBranchSite } = await supabase
      .from('main_sites')
      .select('id')
      .eq('company_id', data.id)
      .eq('is_main_branch', true)
      .maybeSingle();

    if (mainBranchSite) {
      await this.updateMainBranchSite(data);
    } else {
      await this.createHeadOfficeSite(data);
    }

    return data;
  }

  /**
   * Delete company
   * Supports both UUID (id) and tax_id for lookup
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if input is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);
    const lookupField = isUuid ? 'id' : 'tax_id';

    // First check if company exists
    const { data: existingCompany, error: selectError } = await supabase
      .from('main_companies')
      .select('id, tax_id')
      .eq(lookupField, id)
      .maybeSingle();

    if (selectError) throw new DatabaseError(selectError.message);
    if (!existingCompany) throw new NotFoundError('ไม่พบข้อมูลบริษัท');

    // Delete the company
    const { error } = await supabase
      .from('main_companies')
      .delete()
      .eq(lookupField, id);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Create or update company
   */
  static async createOrUpdate(companyData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields
    const sanitizedData = this.sanitizeCompanyData(companyData);

    // Try to find existing company by tax_id
    const { data: existingCompany, error: searchError } = await supabase
      .from('main_companies')
      .select('*')
      .eq('tax_id', sanitizedData.tax_id)
      .maybeSingle();

    if (searchError) throw new DatabaseError(searchError.message);

    if (existingCompany) {
      // Update existing company
      const { data: updatedCompany, error: updateError } = await supabase
        .from('main_companies')
        .update(sanitizedData)
        .eq('tax_id', sanitizedData.tax_id as string)
        .select('*')
        .single();

      if (updateError) throw new DatabaseError(updateError.message);
      if (!updatedCompany) throw new DatabaseError('Failed to update company');

      // Update main branch site if it exists
      // Note: company_id in main_sites is UUID, so use updatedCompany.id (not tax_id)
      const { data: mainBranchSite } = await supabase
        .from('main_sites')
        .select('id')
        .eq('company_id', updatedCompany.id)
        .eq('is_main_branch', true)
        .maybeSingle();

      if (mainBranchSite) {
        await this.updateMainBranchSite(updatedCompany);
      } else {
        await this.createHeadOfficeSite(updatedCompany);
      }

      return updatedCompany;
    }

    // Create new company
    const { data: newCompany, error: createError } = await supabase
      .from('main_companies')
      .insert([sanitizedData])
      .select('*')
      .single();

    if (createError) throw new DatabaseError(createError.message);
    if (!newCompany) throw new DatabaseError('Failed to create company');

    // Check if main branch site exists for this company
    // Note: company_id in main_sites is UUID, so use newCompany.id (not tax_id)
    const { data: mainBranchSite } = await supabase
      .from('main_sites')
      .select('id')
      .eq('company_id', newCompany.id)
      .eq('is_main_branch', true)
      .maybeSingle();

    if (!mainBranchSite) {
      // Only create main branch site if it doesn't exist
      await this.createHeadOfficeSite(newCompany);
    }

    return newCompany;
  }
}

