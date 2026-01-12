/**
 * Model service - Business logic for model operations
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
   * Search models by description and/or code with pagination
   */
  static async search(params: {
    description?: string;
    code?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { description, code, page = 1, limit = 20 } = params;

    // Build filter conditions
    const conditions: string[] = [];
    if (description) {
      conditions.push(`name.ilike.%${description}%`);
    }
    if (code) {
      conditions.push(`model.ilike.%${code}%`);
    }

    // Count query
    let countQuery = supabase
      .from('main_models')
      .select('*', { count: 'exact', head: true });

    if (conditions.length > 0) {
      countQuery = countQuery.or(conditions.join(','));
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

    if (conditions.length > 0) {
      dataQuery = dataQuery.or(conditions.join(','));
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
   * Get model package (items + services)
   */
  static async getPackage(modelId: string): Promise<{
    model: Record<string, unknown>;
    items: Record<string, unknown>[];
    services: Record<string, unknown>[];
  }> {
    const supabase = createServiceClient();

    // Verify model exists
    const model = await this.getById(modelId);

    // Get package items with item details
    const { data: items, error: itemsError } = await supabase
      .from('jct_model_package_items')
      .select(`
        id,
        quantity,
        note,
        display_order,
        created_at,
        item:package_items (
          id,
          code,
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

    if (itemsError) throw new DatabaseError(itemsError.message);

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
      items: items || [],
      services: services || [],
    };
  }

  /**
   * Add item to model package
   */
  static async addPackageItem(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Verify model exists
    await this.getById(data.model_id as string);

    const { data: result, error } = await supabase
      .from('jct_model_package_items')
      .insert([data])
      .select(`
        id,
        quantity,
        note,
        display_order,
        created_at,
        item:package_items (
          id,
          code,
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
   * Remove item from model package
   */
  static async removePackageItem(modelId: string, itemId: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('jct_model_package_items')
      .delete()
      .eq('model_id', modelId)
      .eq('item_id', itemId);

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

  // ============================================================================
  // SPECIFICATION METHODS
  // ============================================================================

  /**
   * Valid fields for specification sanitization
   */
  private static readonly SPEC_VALID_FIELDS = [
    'capacity_va',
    'capacity_watts',
    'power_factor',
    'input_voltage_nominal',
    'input_voltage_range',
    'input_frequency',
    'input_phase',
    'input_port_types',
    'output_voltage_nominal',
    'output_voltage_regulation',
    'output_frequency',
    'output_waveform',
    'output_port_types',
    'battery_type',
    'battery_voltage',
    'battery_quantity',
    'battery_ah',
    'typical_recharge_time',
    'runtime_half_load_minutes',
    'runtime_full_load_minutes',
    'transfer_time_ms',
    'efficiency_percent',
    'dimensions_wxdxh',
    'weight_kg',
    'operating_temperature',
    'operating_humidity',
    'noise_level_db',
    'communication_ports',
    'outlets_iec',
    'outlets_nema',
    'has_lcd_display',
    'has_avr',
    'has_surge_protection',
    'certifications',
    'additional_specs',
  ];

  /**
   * Sanitize specification data
   */
  private static sanitizeSpecData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const field of this.SPEC_VALID_FIELDS) {
      if (data[field] !== undefined) {
        sanitized[field] = data[field];
      }
    }
    return sanitized;
  }

  /**
   * Get model specification
   */
  static async getSpecification(modelId: string): Promise<Record<string, unknown> | null> {
    const supabase = createServiceClient();

    // Verify model exists
    await this.getById(modelId);

    const { data, error } = await supabase
      .from('ext_model_specifications')
      .select('*')
      .eq('model_id', modelId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No specification found - return null
        return null;
      }
      throw new DatabaseError(error.message);
    }

    return data;
  }

  /**
   * Create or update model specification (upsert)
   */
  static async upsertSpecification(
    modelId: string,
    specData: Record<string, unknown>
  ): Promise<{ data: Record<string, unknown>; created: boolean }> {
    const supabase = createServiceClient();

    // Verify model exists
    await this.getById(modelId);

    const sanitized = this.sanitizeSpecData(specData);

    // Check if specification already exists
    const existing = await this.getSpecification(modelId);

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('ext_model_specifications')
        .update(sanitized)
        .eq('model_id', modelId)
        .select()
        .single();

      if (error) throw new DatabaseError(error.message);

      return { data, created: false };
    } else {
      // Create new
      const { data, error } = await supabase
        .from('ext_model_specifications')
        .insert([{ model_id: modelId, ...sanitized }])
        .select()
        .single();

      if (error) throw new DatabaseError(error.message);

      return { data, created: true };
    }
  }
}

