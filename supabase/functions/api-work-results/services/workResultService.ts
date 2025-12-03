/**
 * Work Result service - Business logic for work result operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';

export class WorkResultService {
  static async getByTicket(ticketId: string): Promise<Record<string, unknown> | null> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_results').select(`
      *,
      photos:work_result_photos(*),
      documents:work_result_documents(*,pages:work_result_document_pages(*))
    `).eq('ticket_id', ticketId).maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data;
  }

  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_results').select(`
      *,
      photos:work_result_photos(*),
      documents:work_result_documents(*,pages:work_result_document_pages(*))
    `).eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundError('ไม่พบผลการทำงาน');
      throw new DatabaseError(error.message);
    }
    if (!data) throw new NotFoundError('ไม่พบผลการทำงาน');

    return data;
  }

  static async create(workResultData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_results').insert([workResultData]).select().single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('Failed to create work result');

    return data;
  }

  static async update(id: string, workResultData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_results').update(workResultData).eq('id', id).select().single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบผลการทำงาน');

    return data;
  }

  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase.from('work_results').delete().eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  static async addPhoto(photoData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_result_photos').insert([photoData]).select().single();

    if (error) throw new DatabaseError(error.message);
    return data;
  }

  static async deletePhoto(photoId: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase.from('work_result_photos').delete().eq('id', photoId);

    if (error) throw new DatabaseError(error.message);
  }

  static async addDocument(documentData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_result_documents').insert([documentData]).select().single();

    if (error) throw new DatabaseError(error.message);
    return data;
  }

  static async deleteDocument(documentId: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase.from('work_result_documents').delete().eq('id', documentId);

    if (error) throw new DatabaseError(error.message);
  }

  static async addDocumentPage(pageData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('work_result_document_pages').insert([pageData]).select().single();

    if (error) throw new DatabaseError(error.message);
    return data;
  }

  static async deleteDocumentPage(pageId: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase.from('work_result_document_pages').delete().eq('id', pageId);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Search work results by notes
   */
  static async search(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 1) {
      return [];
    }

    const { data, error } = await supabase
      .from('work_results')
      .select('*')
      .ilike('notes', `%${query}%`)
      .limit(20)
      .order('created_at', { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }
}

