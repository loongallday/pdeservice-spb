/**
 * @fileoverview Model service - Business logic for equipment model catalog
 * @module api-models/services/modelService
 *
 * Provides CRUD operations for equipment models:
 * - getAll(): List models with pagination and search
 * - getById(): Get single model by ID
 * - getByModel(): Get model by model code
 * - create(): Create new model
 * - update(): Update model
 * - delete(): Delete model (checks merchandise references)
 * - search(): Search by description, code, category, is_active
 *
 * Package Management (model components + services):
 * - getPackage(): Get model with components and services
 * - addPackageComponent(): Add component model to package
 * - removePackageComponent(): Remove component from package
 * - addPackageService(): Add service to model package
 * - removePackageService(): Remove service from package
 *
 * @description
 * Models represent equipment types (UPS, batteries, etc.) in the catalog.
 *
 * Schema Fields (main_models):
 * - id, model (unique code), name, name_th, name_en
 * - description, category, unit
 * - is_active, has_serial, website_url
 *
 * Package Structure:
 * - Components: Child models that make up a parent model
 * - Services: Package services included with the model
 *
 * @table main_models - Model catalog
 * @table jct_model_components - Model-to-component relationships (M:N)
 * @table jct_model_package_services - Model-to-service relationships (M:N)
 * @table package_services - Service catalog
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import { sanitizeData } from '../../_shared/sanitize.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

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
      'name_th',
      'name_en',
      'description',
      'category',
      'unit',
      'is_active',
      'has_serial',
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
      .from('main_models')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('main_models')
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
      .from('main_models')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // Supabase returns PGRST116 when .single() finds no rows
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        throw new NotFoundError('ไม่พบข้อมูล Model');
      }
      throw new DatabaseError();
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล Model');
    }

    return data;
  }

  /**
   * Get model by model code
   */
  static async getByModel(model: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_models')
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
      .from('main_models')
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
      .from('main_models')
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
      .from('main_models')
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
   * Search models by description, code, category, and is_active with pagination
   */
  static async search(params: {
    description?: string;
    code?: string;
    category?: string;
    is_active?: boolean;
    has_serial?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { description, code, category, is_active, has_serial, page = 1, limit = 20 } = params;

    // Build filter conditions for OR clause (text search)
    const orConditions: string[] = [];
    if (description) {
      orConditions.push(`name.ilike.%${description}%`);
      orConditions.push(`name_th.ilike.%${description}%`);
      orConditions.push(`name_en.ilike.%${description}%`);
    }
    if (code) {
      orConditions.push(`model.ilike.%${code}%`);
    }

    // Count query
    let countQuery = supabase
      .from('main_models')
      .select('*', { count: 'exact', head: true });

    // Apply exact filters (AND)
    if (category) {
      countQuery = countQuery.eq('category', category);
    }
    if (is_active !== undefined) {
      countQuery = countQuery.eq('is_active', is_active);
    }
    if (has_serial !== undefined) {
      countQuery = countQuery.eq('has_serial', has_serial);
    }

    // Apply text search filters (OR)
    if (orConditions.length > 0) {
      countQuery = countQuery.or(orConditions.join(','));
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Data query
    let dataQuery = supabase
      .from('main_models')
      .select('*');

    // Apply exact filters (AND)
    if (category) {
      dataQuery = dataQuery.eq('category', category);
    }
    if (is_active !== undefined) {
      dataQuery = dataQuery.eq('is_active', is_active);
    }
    if (has_serial !== undefined) {
      dataQuery = dataQuery.eq('has_serial', has_serial);
    }

    // Apply text search filters (OR)
    if (orConditions.length > 0) {
      dataQuery = dataQuery.or(orConditions.join(','));
    }

    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  // ============================================================================
  // PACKAGE METHODS
  // ============================================================================

  /**
   * Get model package (component models + services)
   */
  static async getPackage(modelId: string): Promise<{
    model: Record<string, unknown>;
    components: Record<string, unknown>[];
    services: Record<string, unknown>[];
  }> {
    const supabase = createServiceClient();

    // Verify model exists
    const model = await this.getById(modelId);

    // Get component models with details
    const { data: components, error: componentsError } = await supabase
      .from('jct_model_components')
      .select(`
        id,
        quantity,
        note,
        display_order,
        created_at,
        component:main_models!jct_model_components_component_model_id_fkey (
          id,
          model,
          name,
          name_th,
          name_en,
          description,
          category,
          unit,
          is_active
        )
      `)
      .eq('model_id', modelId)
      .order('display_order');

    if (componentsError) throw new DatabaseError(componentsError.message);

    // Get package services with service details
    const { data: services, error: servicesError } = await supabase
      .from('jct_model_package_services')
      .select(`
        id,
        terms,
        note,
        display_order,
        created_at,
        service:package_services (
          id,
          code,
          name_th,
          name_en,
          description,
          category,
          duration_months,
          is_active
        )
      `)
      .eq('model_id', modelId)
      .order('display_order');

    if (servicesError) throw new DatabaseError(servicesError.message);

    return {
      model,
      components: components || [],
      services: services || [],
    };
  }

  /**
   * Add component model to parent model package
   */
  static async addPackageComponent(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Verify parent model exists
    await this.getById(data.model_id as string);

    // Verify component model exists
    await this.getById(data.component_model_id as string);

    const { data: result, error } = await supabase
      .from('jct_model_components')
      .insert([data])
      .select(`
        id,
        quantity,
        note,
        display_order,
        created_at,
        component:main_models!jct_model_components_component_model_id_fkey (
          id,
          model,
          name,
          name_th,
          name_en,
          description,
          category,
          unit
        )
      `)
      .single();

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique')) {
        throw new ValidationError('รายการอุปกรณ์นี้มีอยู่ในแพ็คเกจแล้ว');
      }
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        throw new ValidationError('ไม่พบรายการอุปกรณ์ที่ระบุ');
      }
      throw new DatabaseError(error.message);
    }

    return result;
  }

  /**
   * Remove component model from parent model package
   */
  static async removePackageComponent(modelId: string, componentModelId: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('jct_model_components')
      .delete()
      .eq('model_id', modelId)
      .eq('component_model_id', componentModelId);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Add service to model package
   */
  static async addPackageService(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Verify model exists
    await this.getById(data.model_id as string);

    const { data: result, error } = await supabase
      .from('jct_model_package_services')
      .insert([data])
      .select(`
        id,
        terms,
        note,
        display_order,
        created_at,
        service:package_services (
          id,
          code,
          name_th,
          name_en,
          description,
          category,
          duration_months
        )
      `)
      .single();

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique')) {
        throw new ValidationError('รายการบริการนี้มีอยู่ในแพ็คเกจแล้ว');
      }
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        throw new ValidationError('ไม่พบรายการบริการที่ระบุ');
      }
      throw new DatabaseError(error.message);
    }

    return result;
  }

  /**
   * Remove service from model package
   */
  static async removePackageService(modelId: string, serviceId: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('jct_model_package_services')
      .delete()
      .eq('model_id', modelId)
      .eq('service_id', serviceId);

    if (error) throw new DatabaseError(error.message);
  }

}

