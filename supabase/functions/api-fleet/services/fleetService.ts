/**
 * Fleet Service - Reads fleet data from database (synced by api-fleet-sync)
 */

import { DatabaseError, NotFoundError } from '../../_shared/error.ts';
import { createServiceClient } from '../../_shared/supabase.ts';

export type VehicleStatus = 'moving' | 'stopped' | 'parked_at_base';

export interface GarageInfo {
  id: string;
  name: string;
  distance_meters: number;
}

export interface VehicleInfo {
  id: string;
  name: string;
  plate_number: string | null;
  driver_name: string | null;
  status: VehicleStatus;
  speed: number;
  latitude: number;
  longitude: number;
  heading: number;
  signal_strength: number;
  address: string | null;
  garage: GarageInfo | null;
  last_sync_at: string;
}

export interface VehicleHistoryPoint {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  status: VehicleStatus;
  address: string | null;
  recorded_at: string;
}

export interface FleetListParams {
  status?: VehicleStatus;
}

export interface RouteHistoryParams {
  date?: string; // YYYY-MM-DD format
  start_date?: string;
  end_date?: string;
}

export interface GarageInput {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
}

export class FleetService {
  /**
   * Calculate distance between two points (Haversine formula)
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * List all vehicles from database
   */
  static async list(params: FleetListParams): Promise<VehicleInfo[]> {
    const supabase = createServiceClient();

    // Build query
    let query = supabase
      .from('fleet_vehicles')
      .select(`
        id,
        name,
        plate_number,
        plate_number_override,
        driver_name,
        driver_name_override,
        status,
        speed,
        latitude,
        longitude,
        heading,
        signal_strength,
        address,
        current_garage_id,
        last_sync_at,
        fleet_garages!current_garage_id (
          id,
          name,
          latitude,
          longitude
        )
      `)
      .order('name');

    // Filter by status if provided
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลรถได้: ${error.message}`);
    }

    // Transform to VehicleInfo format
    return (data || []).map((v) => {
      const garage = v.fleet_garages as { id: string; name: string; latitude: number; longitude: number } | null;
      let garageInfo: GarageInfo | null = null;

      if (garage) {
        const distance = this.calculateDistance(v.latitude, v.longitude, garage.latitude, garage.longitude);
        garageInfo = {
          id: garage.id,
          name: garage.name,
          distance_meters: Math.round(distance),
        };
      }

      return {
        id: v.id,
        name: v.name,
        plate_number: v.plate_number_override || v.plate_number,
        driver_name: v.driver_name_override || v.driver_name,
        status: v.status as VehicleStatus,
        speed: v.speed,
        latitude: v.latitude,
        longitude: v.longitude,
        heading: v.heading,
        signal_strength: v.signal_strength,
        address: v.address,
        garage: garageInfo,
        last_sync_at: v.last_sync_at,
      };
    });
  }

  /**
   * Get single vehicle by ID
   */
  static async getById(vehicleId: string): Promise<VehicleInfo | null> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('fleet_vehicles')
      .select(`
        id,
        name,
        plate_number,
        plate_number_override,
        driver_name,
        driver_name_override,
        status,
        speed,
        latitude,
        longitude,
        heading,
        signal_strength,
        address,
        current_garage_id,
        last_sync_at,
        fleet_garages!current_garage_id (
          id,
          name,
          latitude,
          longitude
        )
      `)
      .eq('id', vehicleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลรถได้: ${error.message}`);
    }

    const garage = data.fleet_garages as { id: string; name: string; latitude: number; longitude: number } | null;
    let garageInfo: GarageInfo | null = null;

    if (garage) {
      const distance = this.calculateDistance(data.latitude, data.longitude, garage.latitude, garage.longitude);
      garageInfo = {
        id: garage.id,
        name: garage.name,
        distance_meters: Math.round(distance),
      };
    }

    return {
      id: data.id,
      name: data.name,
      plate_number: data.plate_number_override || data.plate_number,
      driver_name: data.driver_name_override || data.driver_name,
      status: data.status as VehicleStatus,
      speed: data.speed,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      signal_strength: data.signal_strength,
      address: data.address,
      garage: garageInfo,
      last_sync_at: data.last_sync_at,
    };
  }

  /**
   * Get route history for a vehicle
   */
  static async getRouteHistory(vehicleId: string, params: RouteHistoryParams): Promise<VehicleHistoryPoint[]> {
    const supabase = createServiceClient();

    // Default to today if no date specified
    let startDate: string;
    let endDate: string;

    if (params.start_date && params.end_date) {
      startDate = params.start_date;
      endDate = params.end_date;
    } else if (params.date) {
      startDate = `${params.date}T00:00:00`;
      endDate = `${params.date}T23:59:59`;
    } else {
      const today = new Date().toISOString().split('T')[0];
      startDate = `${today}T00:00:00`;
      endDate = `${today}T23:59:59`;
    }

    const { data, error } = await supabase
      .from('fleet_vehicle_history')
      .select('latitude, longitude, speed, heading, status, address, recorded_at')
      .eq('vehicle_id', vehicleId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)
      .order('recorded_at', { ascending: true });

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงประวัติเส้นทางได้: ${error.message}`);
    }

    return (data || []).map((h) => ({
      latitude: h.latitude,
      longitude: h.longitude,
      speed: h.speed,
      heading: h.heading,
      status: h.status as VehicleStatus,
      address: h.address,
      recorded_at: h.recorded_at,
    }));
  }

  /**
   * Get all garages
   */
  static async listGarages(): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active: boolean;
  }>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('fleet_garages')
      .select('*')
      .order('name');

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลโรงรถได้: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new garage
   */
  static async createGarage(input: GarageInput): Promise<{ id: string; name: string }> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('fleet_garages')
      .insert({
        name: input.name,
        description: input.description || null,
        latitude: input.latitude,
        longitude: input.longitude,
        radius_meters: input.radius_meters || 100,
      })
      .select('id, name')
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถสร้างโรงรถได้: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a garage
   */
  static async updateGarage(garageId: string, input: Partial<GarageInput>): Promise<{ id: string; name: string }> {
    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.latitude !== undefined) updateData.latitude = input.latitude;
    if (input.longitude !== undefined) updateData.longitude = input.longitude;
    if (input.radius_meters !== undefined) updateData.radius_meters = input.radius_meters;

    const { data, error } = await supabase
      .from('fleet_garages')
      .update(updateData)
      .eq('id', garageId)
      .select('id, name')
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถแก้ไขโรงรถได้: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a garage
   */
  static async deleteGarage(garageId: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('fleet_garages')
      .delete()
      .eq('id', garageId);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบโรงรถได้: ${error.message}`);
    }
  }

  /**
   * Update vehicle overrides (driver name, plate number)
   */
  static async updateVehicle(vehicleId: string, input: { driver_name_override?: string; plate_number_override?: string }): Promise<VehicleInfo> {
    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.driver_name_override !== undefined) updateData.driver_name_override = input.driver_name_override;
    if (input.plate_number_override !== undefined) updateData.plate_number_override = input.plate_number_override;

    const { error } = await supabase
      .from('fleet_vehicles')
      .update(updateData)
      .eq('id', vehicleId);

    if (error) {
      throw new DatabaseError(`ไม่สามารถแก้ไขข้อมูลรถได้: ${error.message}`);
    }

    const vehicle = await this.getById(vehicleId);
    if (!vehicle) {
      throw new NotFoundError('ไม่พบข้อมูลรถ');
    }

    return vehicle;
  }
}
