/**
 * PM Summary service - Business logic for PM summary operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface PMSummaryQueryParams {
  page: number;
  limit: number;
  siteId?: string;
  merchandiseId?: string;
  needsRenewal?: boolean;
}

export interface MerchandiseSummary {
  id: string;
  serial_no: string;
  model_id: string;
  model: {
    id: string;
    model: string;
    name: string | null;
    website_url: string | null;
  };
  site_id: string;
  site: {
    id: string;
    name: string;
  };
  pm_count: number | null;
  distributor_id: string | null;
  dealer_id: string | null;
  replaced_by_id: string | null;
  distributor?: {
    id: string;
    name_th: string;
  } | null;
  dealer?: {
    id: string;
    name_th: string;
  } | null;
  replaced_by?: {
    id: string;
    serial_no: string;
  } | null;
  pm_log_count: number;
  needs_renewal: boolean;
  last_pm_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMLogDetail {
  id: string;
  merchandise_id: string;
  description: string | null;
  performed_at: string;
  performed_by: string | null;
  performer?: {
    id: string;
    name_th: string;
    nickname: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export class PMSummaryService {
  /**
   * Get PM summary for all merchandise with pagination
   */
  static async getSummary(params: PMSummaryQueryParams): Promise<{
    data: MerchandiseSummary[];
    pagination: PaginationInfo;
  }> {
    const supabase = createServiceClient();
    const { page, limit, siteId, merchandiseId, needsRenewal } = params;

    // Build base query
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

    if (merchandiseId) {
      countQuery = countQuery.eq('id', merchandiseId);
      dataQuery = dataQuery.eq('id', merchandiseId);
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    const total = count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    const { data: merchandiseData, error } = await dataQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    // Get PM log counts for each merchandise
    const merchandiseIds = merchandiseData.map((m: any) => m.id);
    
    const { data: pmCounts, error: pmCountError } = await supabase
      .from('pmlog')
      .select('merchandise_id')
      .in('merchandise_id', merchandiseIds);

    if (pmCountError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูล PM log ได้');
    }

    // Get last PM date for each merchandise
    const pmCountMap = new Map<string, number>();
    const lastPMMap = new Map<string, string>();

    for (const pmLog of pmCounts) {
      const merchandiseId = pmLog.merchandise_id;
      pmCountMap.set(merchandiseId, (pmCountMap.get(merchandiseId) || 0) + 1);
    }

    // Get last PM dates
    for (const merchId of merchandiseIds) {
      const { data: lastPM } = await supabase
        .from('pmlog')
        .select('performed_at')
        .eq('merchandise_id', merchId)
        .order('performed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastPM) {
        lastPMMap.set(merchId, lastPM.performed_at);
      }
    }

    // Build summary with PM log counts
    let summaryData: MerchandiseSummary[] = merchandiseData.map((m: any) => {
      const pmLogCount = pmCountMap.get(m.id) || 0;
      const needsRenewal = m.pm_count !== null && pmLogCount >= m.pm_count;
      
      return {
        id: m.id,
        serial_no: m.serial_no,
        model_id: m.model_id,
        model: m.model,
        site_id: m.site_id,
        site: m.site,
        pm_count: m.pm_count,
        distributor_id: m.distributor_id,
        dealer_id: m.dealer_id,
        replaced_by_id: m.replaced_by_id,
        distributor: m.distributor,
        dealer: m.dealer,
        replaced_by: m.replaced_by,
        pm_log_count: pmLogCount,
        needs_renewal: needsRenewal,
        last_pm_date: lastPMMap.get(m.id) || null,
        created_at: m.created_at,
        updated_at: m.updated_at,
      };
    });

    // Filter by renewal status if specified
    if (needsRenewal !== undefined) {
      summaryData = summaryData.filter(m => m.needs_renewal === needsRenewal);
    }

    const pagination = calculatePagination(page, limit, total);

    return { data: summaryData, pagination };
  }

  /**
   * Get PM logs for a specific merchandise
   */
  static async getPMLogs(merchandiseId: string, params: { page: number; limit: number }): Promise<{
    data: PMLogDetail[];
    pagination: PaginationInfo;
  }> {
    const supabase = createServiceClient();
    const { page, limit } = params;

    // Check if merchandise exists
    const { data: merchandise, error: merchError } = await supabase
      .from('merchandise')
      .select('id')
      .eq('id', merchandiseId)
      .single();

    if (merchError || !merchandise) {
      throw new NotFoundError('ไม่พบข้อมูล merchandise');
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('pmlog')
      .select('*', { count: 'exact', head: true })
      .eq('merchandise_id', merchandiseId);

    if (countError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    const total = count || 0;

    // Get paginated PM logs
    const offset = (page - 1) * limit;
    const { data: pmLogs, error } = await supabase
      .from('pmlog')
      .select(`
        *,
        performer:employees!pmlog_performed_by_fkey (
          id,
          name,
          nickname
        )
      `)
      .eq('merchandise_id', merchandiseId)
      .range(offset, offset + limit - 1)
      .order('performed_at', { ascending: false });

    if (error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    const data: PMLogDetail[] = pmLogs.map((log: any) => ({
      id: log.id,
      merchandise_id: log.merchandise_id,
      description: log.description,
      performed_at: log.performed_at,
      performed_by: log.performed_by,
      performer: log.performer,
      created_at: log.created_at,
      updated_at: log.updated_at,
    }));

    const pagination = calculatePagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Get single merchandise summary by ID
   */
  static async getMerchandiseSummary(id: string): Promise<MerchandiseSummary> {
    const supabase = createServiceClient();

    const { data: merchandise, error } = await supabase
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
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    if (!merchandise) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    // Get PM log count
    const { count: pmLogCount, error: countError } = await supabase
      .from('pmlog')
      .select('*', { count: 'exact', head: true })
      .eq('merchandise_id', id);

    if (countError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูล PM log ได้');
    }

    // Get last PM date
    const { data: lastPM } = await supabase
      .from('pmlog')
      .select('performed_at')
      .eq('merchandise_id', id)
      .order('performed_at', { ascending: false })
      .limit(1)
      .single();

    const pmCount = pmLogCount || 0;
    const needsRenewal = merchandise.pm_count !== null && pmCount >= merchandise.pm_count;

    return {
      id: merchandise.id,
      serial_no: merchandise.serial_no,
      model_id: merchandise.model_id,
      model: merchandise.model,
      site_id: merchandise.site_id,
      site: merchandise.site,
      pm_count: merchandise.pm_count,
      distributor_id: merchandise.distributor_id,
      dealer_id: merchandise.dealer_id,
      replaced_by_id: merchandise.replaced_by_id,
      distributor: merchandise.distributor,
      dealer: merchandise.dealer,
      replaced_by: merchandise.replaced_by,
      pm_log_count: pmCount,
      needs_renewal: needsRenewal,
      last_pm_date: lastPM?.performed_at || null,
      created_at: merchandise.created_at,
      updated_at: merchandise.updated_at,
    };
  }
}

