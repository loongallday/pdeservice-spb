/**
 * Company service - Business logic for company operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import { sanitizeData } from '../_shared/sanitize.ts';
import type { PaginationInfo } from '../_shared/response.ts';

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
      .from('companies')
      .select('*', { count: 'exact', head: true });

    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get paginated data
    const { data, error } = await supabase
      .from('companies')
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
   * Get single company by tax ID
   */
  static async getByTaxId(taxId: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('tax_id', taxId)
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

    return data;
  }

  /**
   * Search companies by name or tax ID
   */
  static async search(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 2) {
      return [];
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .or(`name_th.ilike.%${query}%,name_en.ilike.%${query}%,tax_id.ilike.%${query}%`)
      .limit(10)
      .order('name_th');

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }

  /**
   * Get recent companies
   */
  static async getRecent(limit: number): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

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
      .from('companies')
      .upsert([sanitizedData], {
        onConflict: 'tax_id',
        ignoreDuplicates: false,
      })
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('Failed to create or update company');

    // Check if main branch site exists for this company
    const { data: mainBranchSite } = await supabase
      .from('sites')
      .select('id')
      .eq('company_id', sanitizedData.tax_id as string)
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
    const siteData: Record<string, unknown> = {
      name: `สำนักงานใหญ่ (${company.name_th})`,
      company_id: company.tax_id,
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
    const { data: mainBranchSites, error: findError } = await supabase
      .from('sites')
      .select('id')
      .eq('company_id', company.tax_id as string)
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
        .from('sites')
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
      .from('sites')
      .update(updateData)
      .eq('id', mainBranchSite.id);

    if (updateError) throw new DatabaseError(`Failed to update main branch site: ${updateError.message}`);
  }

  /**
   * Update existing company
   */
  static async update(taxId: string, companyData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields
    const sanitizedData = this.sanitizeCompanyData(companyData);

    const { data, error } = await supabase
      .from('companies')
      .update(sanitizedData)
      .eq('tax_id', taxId)
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลบริษัท');

    return data;
  }

  /**
   * Delete company
   */
  static async delete(taxId: string): Promise<void> {
    const supabase = createServiceClient();

    // First check if company exists
    const { data: existingCompany, error: selectError } = await supabase
      .from('companies')
      .select('tax_id')
      .eq('tax_id', taxId)
      .maybeSingle();

    if (selectError) throw new DatabaseError(selectError.message);
    if (!existingCompany) throw new NotFoundError('ไม่พบข้อมูลบริษัท');

    // Delete the company
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('tax_id', taxId);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Find or create company
   */
  static async findOrCreate(companyData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Sanitize data to remove invalid fields
    const sanitizedData = this.sanitizeCompanyData(companyData);

    // Try to find existing company by tax_id
    const { data: existingCompany, error: searchError } = await supabase
      .from('companies')
      .select('*')
      .eq('tax_id', sanitizedData.tax_id)
      .maybeSingle();

    if (searchError) throw new DatabaseError(searchError.message);

    if (existingCompany) {
      return existingCompany;
    }

    // Create new company
    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert([sanitizedData])
      .select('*')
      .single();

    if (createError) throw new DatabaseError(createError.message);
    if (!newCompany) throw new DatabaseError('Failed to create company');

    // Check if main branch site exists for this company
    const { data: mainBranchSite } = await supabase
      .from('sites')
      .select('id')
      .eq('company_id', sanitizedData.tax_id as string)
      .eq('is_main_branch', true)
      .maybeSingle();

    if (!mainBranchSite) {
      // Only create main branch site if it doesn't exist
      await this.createHeadOfficeSite(newCompany);
    }

    return newCompany;
  }
}

