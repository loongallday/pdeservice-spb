/**
 * @fileoverview Contact service - Business logic for contact operations
 * @module api-contacts/services/contactService
 *
 * Provides CRUD operations for customer contacts:
 * - getAll(): List contacts with pagination, optional site filter
 * - getById(): Get single contact by ID
 * - getBySite(): Get all contacts for a site
 * - search(): Search by person_name or nickname
 * - create(): Create new contact
 * - update(): Update existing contact
 * - delete(): Delete contact
 *
 * @description
 * Contacts are linked to sites (child_site_contacts table).
 * Each contact stores person information including:
 * - person_name, nickname
 * - phone (array), email (array)
 * - line_id, note
 *
 * @table child_site_contacts - Contact data (linked to main_sites)
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export class ContactService {
  static async getAll(params: { page: number; limit: number; site_id?: string }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, site_id } = params;

    let countQuery = supabase.from('child_site_contacts').select('*', { count: 'exact', head: true });
    if (site_id) countQuery = countQuery.eq('site_id', site_id);

    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dataQuery = supabase.from('child_site_contacts').select('*').order('person_name').range(from, to);
    if (site_id) dataQuery = dataQuery.eq('site_id', site_id);

    const { data, error } = await dataQuery;
    if (error) throw new DatabaseError(error.message);

    return { data: data || [], pagination: calculatePagination(page, limit, total) };
  }

  static async getById(id: string): Promise<Record<string, unknown>> {
    console.log('[ContactService.getById] Fetching contact:', { id });
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('child_site_contacts').select('*').eq('id', id).single();

    console.log('[ContactService.getById] Query result:', {
      id,
      hasData: !!data,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      dataType: typeof data,
      isArray: Array.isArray(data),
    });

    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundError('ไม่พบข้อมูลผู้ติดต่อ');
      throw new DatabaseError(error.message);
    }
    if (!data) throw new NotFoundError('ไม่พบข้อมูลผู้ติดต่อ');

    return data;
  }

  static async getBySite(siteId: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('child_site_contacts').select('*').eq('site_id', siteId).order('created_at', { ascending: false });

    if (error) throw new DatabaseError(error.message);
    return data || [];
  }

  static async search(query: string, siteId?: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    if (!query || query.length < 2) return [];

    let searchQuery = supabase.from('child_site_contacts').select('*').or(`person_name.ilike.%${query}%,nickname.ilike.%${query}%`).limit(10).order('person_name');
    if (siteId) searchQuery = searchQuery.eq('site_id', siteId);

    const { data, error } = await searchQuery;
    if (error) throw new DatabaseError(error.message);

    return data || [];
  }

  static async create(contactData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('child_site_contacts').insert([contactData]).select().single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('Failed to create contact');

    return data;
  }

  static async update(id: string, contactData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('child_site_contacts').update(contactData).eq('id', id).select().single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลผู้ติดต่อ');

    return data;
  }

  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase.from('child_site_contacts').delete().eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }
}

