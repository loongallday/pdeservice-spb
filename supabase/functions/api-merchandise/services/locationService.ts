/**
 * Location Service - Business logic for merchandise location within sites
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';

export interface LocationInput {
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  zone?: string | null;
  notes?: string | null;
}

export interface MerchandiseLocation {
  id: string;
  merchandise_id: string;
  building: string | null;
  floor: string | null;
  room: string | null;
  zone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class LocationService {
  /**
   * Get location for a merchandise
   */
  static async getByMerchandiseId(merchandiseId: string): Promise<MerchandiseLocation | null> {
    const supabase = createServiceClient();

    // Verify merchandise exists
    const { data: merchandise, error: merchError } = await supabase
      .from('main_merchandise')
      .select('id')
      .eq('id', merchandiseId)
      .single();

    if (merchError || !merchandise) {
      throw new NotFoundError('ไม่พบสินค้าที่ระบุ');
    }

    const { data, error } = await supabase
      .from('child_merchandise_location')
      .select('*')
      .eq('merchandise_id', merchandiseId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลตำแหน่งได้: ${error.message}`);
    }

    return data as MerchandiseLocation | null;
  }

  /**
   * Create or update location for a merchandise (upsert)
   */
  static async upsert(
    merchandiseId: string,
    input: LocationInput
  ): Promise<MerchandiseLocation> {
    const supabase = createServiceClient();

    // Verify merchandise exists
    const { data: merchandise, error: merchError } = await supabase
      .from('main_merchandise')
      .select('id')
      .eq('id', merchandiseId)
      .single();

    if (merchError || !merchandise) {
      throw new NotFoundError('ไม่พบสินค้าที่ระบุ');
    }

    // Validate at least one field is provided
    if (!input.building && !input.floor && !input.room && !input.zone && !input.notes) {
      throw new ValidationError('กรุณาระบุตำแหน่งอย่างน้อย 1 ฟิลด์');
    }

    // Check if location already exists
    const { data: existing } = await supabase
      .from('child_merchandise_location')
      .select('id')
      .eq('merchandise_id', merchandiseId)
      .maybeSingle();

    const locationData = {
      building: input.building ?? null,
      floor: input.floor ?? null,
      room: input.room ?? null,
      zone: input.zone ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    let data: MerchandiseLocation | null = null;
    let error: { message: string } | null = null;

    if (existing) {
      // Update existing
      const result = await supabase
        .from('child_merchandise_location')
        .update(locationData)
        .eq('id', existing.id)
        .select()
        .single();
      data = result.data as MerchandiseLocation | null;
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('child_merchandise_location')
        .insert({
          merchandise_id: merchandiseId,
          ...locationData,
        })
        .select()
        .single();
      data = result.data as MerchandiseLocation | null;
      error = result.error;
    }

    if (error) {
      throw new DatabaseError(`ไม่สามารถบันทึกตำแหน่งได้: ${error.message}`);
    }

    return data as MerchandiseLocation;
  }

  /**
   * Update location for a merchandise
   */
  static async update(
    merchandiseId: string,
    input: LocationInput
  ): Promise<MerchandiseLocation> {
    const supabase = createServiceClient();

    // Verify merchandise exists
    const { data: merchandise, error: merchError } = await supabase
      .from('main_merchandise')
      .select('id')
      .eq('id', merchandiseId)
      .single();

    if (merchError || !merchandise) {
      throw new NotFoundError('ไม่พบสินค้าที่ระบุ');
    }

    // Build update data (only non-undefined fields)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.building !== undefined) updateData.building = input.building;
    if (input.floor !== undefined) updateData.floor = input.floor;
    if (input.room !== undefined) updateData.room = input.room;
    if (input.zone !== undefined) updateData.zone = input.zone;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const { data, error } = await supabase
      .from('child_merchandise_location')
      .update(updateData)
      .eq('merchandise_id', merchandiseId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบข้อมูลตำแหน่งสำหรับสินค้านี้');
      }
      throw new DatabaseError(`ไม่สามารถแก้ไขตำแหน่งได้: ${error.message}`);
    }

    return data as MerchandiseLocation;
  }

  /**
   * Delete location for a merchandise
   */
  static async delete(merchandiseId: string): Promise<void> {
    const supabase = createServiceClient();

    // Verify merchandise exists
    const { data: merchandise, error: merchError } = await supabase
      .from('main_merchandise')
      .select('id')
      .eq('id', merchandiseId)
      .single();

    if (merchError || !merchandise) {
      throw new NotFoundError('ไม่พบสินค้าที่ระบุ');
    }

    const { error } = await supabase
      .from('child_merchandise_location')
      .delete()
      .eq('merchandise_id', merchandiseId);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบตำแหน่งได้: ${error.message}`);
    }
  }

  /**
   * Format location as display string
   */
  static formatLocation(location: MerchandiseLocation | null): string | null {
    if (!location) return null;

    const parts: string[] = [];
    if (location.building) parts.push(`อาคาร ${location.building}`);
    if (location.floor) parts.push(`ชั้น ${location.floor}`);
    if (location.room) parts.push(`ห้อง ${location.room}`);
    if (location.zone) parts.push(`โซน ${location.zone}`);

    return parts.length > 0 ? parts.join(' ') : null;
  }
}
