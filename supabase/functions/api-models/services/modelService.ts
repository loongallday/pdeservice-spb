/**
 * Model service - Business logic for model operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import { sanitizeData } from '../_shared/sanitize.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface ModelQueryParams {
  page: number;
  limit: number;
  search?: string;
}

export class ModelService {
  /**
   * Sanitize model data based on actual schema
   */
  private static sanitizeModelData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = [
      'model',
      'name',
      'website_url',
    ];
    return sanitizeData(data, validFields);
  }

  /**
   * Get all models with pagination
   */
  static async getAll(params: ModelQueryParams): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    const supabase = createServiceClient();
    const { page, limit, search } = params;

    // Build query
    let countQuery = supabase
      .from('models')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('models')
      .select('*');

    // Apply search filter
    if (search) {
      countQuery = countQuery.or(`model.ilike.%${search}%,name.ilike.%${search}%`);
      dataQuery = dataQuery.or(`model.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new DatabaseError();
    }

    const total = count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    const { data, error } = await dataQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError();
    }

    const pagination = calculatePagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Get single model by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new DatabaseError();
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Get model by model code
   */
  static async getByModel(model: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('model', model)
      .single();

    if (error) {
      throw new DatabaseError();
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Create new model
   */
  static async create(modelData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeModelData(modelData);

    // Validate required fields
    if (!sanitized.model) {
      throw new ValidationError('กรุณาระบุ model code');
    }

    const { data, error } = await supabase
      .from('models')
      .insert(sanitized)
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate key')) {
        throw new ValidationError('model code ซ้ำในระบบ');
      }
      throw new DatabaseError('ไม่สามารถสร้างข้อมูลได้');
    }

    return data;
  }

  /**
   * Update model
   */
  static async update(id: string, modelData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeModelData(modelData);

    // Check if exists first
    await this.getById(id);

    const { data, error } = await supabase
      .from('models')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate key')) {
        throw new ValidationError('model code ซ้ำในระบบ');
      }
      throw new DatabaseError('ไม่สามารถอัพเดทข้อมูลได้');
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Delete model
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if exists first
    await this.getById(id);

    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.message.includes('foreign key')) {
        throw new ValidationError('ไม่สามารถลบ model ที่มี merchandise ใช้งานอยู่');
      }
      throw new DatabaseError('ไม่สามารถลบข้อมูลได้');
    }
  }

  /**
   * Search models by description and/or code
   * If no parameters provided, returns all models (up to 20)
   */
  static async search(params: {
    description?: string;
    code?: string;
  }): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    const { description, code } = params;

    let query = supabase
      .from('models')
      .select('*');

    // Build search conditions if parameters provided
    if (description || code) {
      const conditions: string[] = [];
      
      if (description) {
        conditions.push(`name.ilike.%${description}%`);
      }
      
      if (code) {
        conditions.push(`model.ilike.%${code}%`);
      }

      // Apply search filter
      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }
    }
    // If no parameters, return all models (no filter applied)

    const { data, error } = await query
      .limit(20)
      .order('created_at', { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }
}

