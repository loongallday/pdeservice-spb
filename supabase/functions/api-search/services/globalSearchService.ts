/**
 * Global Search Service
 * Searches across multiple entity types in parallel
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

export interface SearchResult {
  id: string;
  type: 'company' | 'site' | 'ticket' | 'merchandise' | 'employee';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GlobalSearchResults {
  query: string;
  total: number;
  results: {
    companys?: SearchResult[]; // Note: 'companys' to match frontend (documented typo for consistency)
    sites?: SearchResult[];
    tickets?: SearchResult[];
    merchandise?: SearchResult[];
    employees?: SearchResult[];
  };
  counts: {
    companys?: number; // Note: 'companys' to match frontend (documented typo for consistency)
    sites?: number;
    tickets?: number;
    merchandise?: number;
    employees?: number;
  };
}

export class GlobalSearchService {
  /**
   * Search across all specified entity types
   */
  static async search(
    query: string,
    types: string[],
    limit: number
  ): Promise<GlobalSearchResults> {
    const supabase = createServiceClient();

    // Build parallel search promises
    const searchPromises: Promise<{ type: string; data: SearchResult[]; count: number }>[] = [];

    if (types.includes('company')) {
      searchPromises.push(this.searchCompanies(supabase, query, limit));
    }

    if (types.includes('site')) {
      searchPromises.push(this.searchSites(supabase, query, limit));
    }

    if (types.includes('ticket')) {
      searchPromises.push(this.searchTickets(supabase, query, limit));
    }

    if (types.includes('merchandise')) {
      searchPromises.push(this.searchMerchandise(supabase, query, limit));
    }

    if (types.includes('employee')) {
      searchPromises.push(this.searchEmployees(supabase, query, limit));
    }

    // Execute all searches in parallel
    const searchResults = await Promise.all(searchPromises);

    // Aggregate results
    const results: GlobalSearchResults = {
      query,
      total: 0,
      results: {},
      counts: {},
    };

    for (const result of searchResults) {
      // Map entity type to result key
      // Note: using 'companys' to match frontend expectation (documented typo for consistency)
      const keyMap: Record<string, string> = {
        company: 'companys',
        site: 'sites',
        ticket: 'tickets',
        merchandise: 'merchandise',
        employee: 'employees',
      };

      const resultKey = keyMap[result.type] as keyof typeof results.results;

      (results.results as Record<string, SearchResult[]>)[resultKey] = result.data;
      (results.counts as Record<string, number>)[resultKey] = result.count;
      results.total += result.count;
    }

    return results;
  }

  /**
   * Search companies by name, tax ID, or address
   * Returns matches ordered by Thai name
   */
  private static async searchCompanies(
    supabase: ReturnType<typeof createServiceClient>,
    query: string,
    limit: number
  ): Promise<{ type: string; data: SearchResult[]; count: number }> {
    try {
      const { data, count, error } = await supabase
        .from('main_companies')
        .select('id, tax_id, name_th, name_en, address_detail', { count: 'exact' })
        .or(`name_th.ilike.%${query}%,name_en.ilike.%${query}%,tax_id.ilike.%${query}%`)
        .order('name_th')
        .limit(limit);

      if (error) throw new DatabaseError(error.message);

      const results: SearchResult[] = (data || []).map((c) => ({
        id: c.id,
        type: 'company' as const,
        title: c.name_th || c.name_en || '',
        subtitle: c.tax_id || undefined,
        description: c.address_detail?.substring(0, 100),
        metadata: {
          tax_id: c.tax_id,
          name_en: c.name_en,
        },
      }));

      return { type: 'company', data: results, count: count || 0 };
    } catch (err) {
      console.error('Error searching companies:', err);
      return { type: 'company', data: [], count: 0 };
    }
  }

  /**
   * Search sites by name or address
   * Includes associated company information
   * Returns matches ordered by name
   */
  private static async searchSites(
    supabase: ReturnType<typeof createServiceClient>,
    query: string,
    limit: number
  ): Promise<{ type: string; data: SearchResult[]; count: number }> {
    try {
      const { data, count, error } = await supabase
        .from('main_sites')
        .select(`
          id, name, address_detail, is_main_branch,
          company:main_companies!company_id(id, name_th)
        `, { count: 'exact' })
        .or(`name.ilike.%${query}%,address_detail.ilike.%${query}%`)
        .order('name')
        .limit(limit);

      if (error) throw new DatabaseError(error.message);

      const results: SearchResult[] = (data || []).map((s) => ({
        id: s.id,
        type: 'site' as const,
        title: s.name || '',
        subtitle: (s.company as Record<string, unknown>)?.name_th as string | undefined,
        description: s.address_detail?.substring(0, 100),
        metadata: {
          is_main_branch: s.is_main_branch || false,
          company_id: (s.company as Record<string, unknown>)?.id,
        },
      }));

      return { type: 'site', data: results, count: count || 0 };
    } catch (err) {
      console.error('Error searching sites:', err);
      return { type: 'site', data: [], count: 0 };
    }
  }

  /**
   * Search tickets by code or details
   * Includes status, work type, and site information
   * Returns matches ordered by creation date (newest first)
   */
  private static async searchTickets(
    supabase: ReturnType<typeof createServiceClient>,
    query: string,
    limit: number
  ): Promise<{ type: string; data: SearchResult[]; count: number }> {
    try {
      const { data, count, error } = await supabase
        .from('main_tickets')
        .select(`
          id, ticket_code, ticket_number, details, details_summary,
          status:ref_ticket_statuses!status_id(name),
          work_type:ref_ticket_work_types!work_type_id(name),
          site:main_sites!site_id(id, name)
        `, { count: 'exact' })
        .or(`ticket_code.ilike.%${query}%,details.ilike.%${query}%,details_summary.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new DatabaseError(error.message);

      const results: SearchResult[] = (data || []).map((t) => ({
        id: t.id,
        type: 'ticket' as const,
        title: t.ticket_code || t.ticket_number || t.id,
        subtitle: (t.site as Record<string, unknown>)?.name as string | undefined,
        description: t.details_summary || t.details?.substring(0, 100),
        metadata: {
          status: (t.status as Record<string, unknown>)?.name,
          work_type: (t.work_type as Record<string, unknown>)?.name,
          site_id: (t.site as Record<string, unknown>)?.id,
        },
      }));

      return { type: 'ticket', data: results, count: count || 0 };
    } catch (err) {
      console.error('Error searching tickets:', err);
      return { type: 'ticket', data: [], count: 0 };
    }
  }

  /**
   * Search merchandise by serial number
   * Includes model and site location information
   * Returns matches ordered by serial number
   */
  private static async searchMerchandise(
    supabase: ReturnType<typeof createServiceClient>,
    query: string,
    limit: number
  ): Promise<{ type: string; data: SearchResult[]; count: number }> {
    try {
      const { data, count, error } = await supabase
        .from('main_merchandise')
        .select(`
          id, serial_no,
          model:main_models!model_id(id, model, name),
          site:main_sites!site_id(id, name)
        `, { count: 'exact' })
        .or(`serial_no.ilike.%${query}%`)
        .order('serial_no')
        .limit(limit);

      if (error) throw new DatabaseError(error.message);

      const results: SearchResult[] = (data || []).map((m) => ({
        id: m.id,
        type: 'merchandise' as const,
        title: m.serial_no || '',
        subtitle: (m.model as Record<string, unknown>)?.model as string | undefined,
        description: (m.site as Record<string, unknown>)?.name as string | undefined,
        metadata: {
          model_id: (m.model as Record<string, unknown>)?.id,
          model_name: (m.model as Record<string, unknown>)?.name,
          site_id: (m.site as Record<string, unknown>)?.id,
        },
      }));

      return { type: 'merchandise', data: results, count: count || 0 };
    } catch (err) {
      console.error('Error searching merchandise:', err);
      return { type: 'merchandise', data: [], count: 0 };
    }
  }

  /**
   * Search employees by name, code, nickname, or email
   * Only searches active employees (is_active = true)
   * Includes role information
   * Returns matches ordered by name
   */
  private static async searchEmployees(
    supabase: ReturnType<typeof createServiceClient>,
    query: string,
    limit: number
  ): Promise<{ type: string; data: SearchResult[]; count: number }> {
    try {
      const { data, count, error } = await supabase
        .from('main_employees')
        .select(`
          id, name, code, nickname, email, is_active,
          role:main_org_roles!role_id(id, name_th)
        `, { count: 'exact' })
        .or(`name.ilike.%${query}%,code.ilike.%${query}%,nickname.ilike.%${query}%,email.ilike.%${query}%`)
        .eq('is_active', true)
        .order('name')
        .limit(limit);

      if (error) throw new DatabaseError(error.message);

      const results: SearchResult[] = (data || []).map((e) => ({
        id: e.id,
        type: 'employee' as const,
        title: e.name || '',
        subtitle: e.nickname || e.code,
        description: (e.role as Record<string, unknown>)?.name_th as string | undefined,
        metadata: {
          code: e.code,
          email: e.email,
          role_id: (e.role as Record<string, unknown>)?.id,
        },
      }));

      return { type: 'employee', data: results, count: count || 0 };
    } catch (err) {
      console.error('Error searching employees:', err);
      return { type: 'employee', data: [], count: 0 };
    }
  }
}
