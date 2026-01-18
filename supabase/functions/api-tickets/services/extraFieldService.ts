/**
 * @fileoverview Ticket extra fields service - Dynamic custom field management
 * @module api-tickets/services/extraFieldService
 *
 * Provides custom field (key-value) functionality for tickets:
 * - getByTicketId(): Get all extra fields for a ticket
 * - getById(): Get single field by ID
 * - create(): Create new field
 * - update(): Update existing field
 * - delete(): Delete field
 * - bulkUpsert(): Create or update multiple fields
 * - deleteByKeys(): Delete fields by key names
 *
 * @description
 * Extra fields allow dynamic, schema-less data to be attached to tickets
 * without requiring database migrations.
 *
 * Constraints:
 * - field_key max length: 100 characters
 * - field_key must be unique per ticket (enforced by DB constraint)
 * - field_value can be null (for "flag" type fields)
 *
 * Bulk Upsert:
 * - Uses ON CONFLICT to create or update based on field_key
 * - Efficient for forms with multiple custom fields
 * - Updates updated_at timestamp on upsert
 *
 * Use Cases:
 * - Custom form fields per work type
 * - Dynamic metadata from external systems
 * - Feature flags or tags per ticket
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';

export interface ExtraFieldInput {
  field_key: string;
  field_value: string | null;
}

export interface ExtraField {
  id: string;
  ticket_id: string;
  field_key: string;
  field_value: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BulkUpsertInput {
  fields: ExtraFieldInput[];
}

export class ExtraFieldService {
  /**
   * Get all extra fields for a ticket
   */
  static async getByTicketId(ticketId: string): Promise<ExtraField[]> {
    const supabase = createServiceClient();

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงานที่ระบุ');
    }

    const { data, error } = await supabase
      .from('child_ticket_extra_fields')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('field_key');

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูล extra fields ได้: ${error.message}`);
    }

    return (data || []) as ExtraField[];
  }

  /**
   * Get a single extra field by ID
   */
  static async getById(id: string): Promise<ExtraField> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('child_ticket_extra_fields')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('ไม่พบ extra field ที่ระบุ');
    }

    return data as ExtraField;
  }

  /**
   * Create a new extra field
   */
  static async create(
    ticketId: string,
    input: ExtraFieldInput,
    createdBy: string
  ): Promise<ExtraField> {
    const supabase = createServiceClient();

    // Validate
    if (!input.field_key || input.field_key.trim().length === 0) {
      throw new ValidationError('กรุณาระบุ field_key');
    }

    if (input.field_key.length > 100) {
      throw new ValidationError('field_key ต้องไม่เกิน 100 ตัวอักษร');
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงานที่ระบุ');
    }

    // Insert (will fail if duplicate key due to unique constraint)
    const { data, error } = await supabase
      .from('child_ticket_extra_fields')
      .insert({
        ticket_id: ticketId,
        field_key: input.field_key.trim(),
        field_value: input.field_value,
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ValidationError(`field_key "${input.field_key}" มีอยู่แล้วสำหรับตั๋วนี้`);
      }
      throw new DatabaseError(`ไม่สามารถสร้าง extra field ได้: ${error.message}`);
    }

    return data as ExtraField;
  }

  /**
   * Update an extra field
   */
  static async update(
    id: string,
    input: Partial<ExtraFieldInput>
  ): Promise<ExtraField> {
    const supabase = createServiceClient();

    // Verify exists
    const { data: existing, error: fetchError } = await supabase
      .from('child_ticket_extra_fields')
      .select('id, ticket_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบ extra field ที่ระบุ');
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.field_key !== undefined) {
      if (input.field_key.trim().length === 0) {
        throw new ValidationError('กรุณาระบุ field_key');
      }
      if (input.field_key.length > 100) {
        throw new ValidationError('field_key ต้องไม่เกิน 100 ตัวอักษร');
      }
      updateData.field_key = input.field_key.trim();
    }

    if (input.field_value !== undefined) {
      updateData.field_value = input.field_value;
    }

    const { data, error } = await supabase
      .from('child_ticket_extra_fields')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ValidationError(`field_key "${input.field_key}" มีอยู่แล้วสำหรับตั๋วนี้`);
      }
      throw new DatabaseError(`ไม่สามารถแก้ไข extra field ได้: ${error.message}`);
    }

    return data as ExtraField;
  }

  /**
   * Delete an extra field
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Verify exists
    const { data: existing, error: fetchError } = await supabase
      .from('child_ticket_extra_fields')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบ extra field ที่ระบุ');
    }

    const { error } = await supabase
      .from('child_ticket_extra_fields')
      .delete()
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบ extra field ได้: ${error.message}`);
    }
  }

  /**
   * Bulk upsert extra fields for a ticket
   * Creates new fields or updates existing ones based on field_key
   */
  static async bulkUpsert(
    ticketId: string,
    input: BulkUpsertInput,
    createdBy: string
  ): Promise<ExtraField[]> {
    const supabase = createServiceClient();

    // Validate
    if (!input.fields || input.fields.length === 0) {
      throw new ValidationError('กรุณาระบุ fields');
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงานที่ระบุ');
    }

    // Validate all fields
    for (const field of input.fields) {
      if (!field.field_key || field.field_key.trim().length === 0) {
        throw new ValidationError('กรุณาระบุ field_key สำหรับทุก field');
      }
      if (field.field_key.length > 100) {
        throw new ValidationError(`field_key "${field.field_key}" ต้องไม่เกิน 100 ตัวอักษร`);
      }
    }

    // Prepare records for upsert
    const records = input.fields.map(field => ({
      ticket_id: ticketId,
      field_key: field.field_key.trim(),
      field_value: field.field_value,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    }));

    // Upsert using ON CONFLICT
    const { data, error } = await supabase
      .from('child_ticket_extra_fields')
      .upsert(records, {
        onConflict: 'ticket_id,field_key',
        ignoreDuplicates: false,
      })
      .select('*');

    if (error) {
      throw new DatabaseError(`ไม่สามารถบันทึก extra fields ได้: ${error.message}`);
    }

    return (data || []) as ExtraField[];
  }

  /**
   * Delete multiple extra fields by keys
   */
  static async deleteByKeys(ticketId: string, keys: string[]): Promise<void> {
    const supabase = createServiceClient();

    if (!keys || keys.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('child_ticket_extra_fields')
      .delete()
      .eq('ticket_id', ticketId)
      .in('field_key', keys);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบ extra fields ได้: ${error.message}`);
    }
  }
}
