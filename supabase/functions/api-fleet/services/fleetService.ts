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

export interface EmployeeInfo {
  id: string;
  name: string;
}

export interface VehicleInfo {
  id: string;
  name: string;
  plate_number: string | null;
  driver_name: string | null;
  employees: EmployeeInfo[];
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

export interface WorkLocation {
  ticket_id: string;
  ticket_code: string | null;
  site_id: string;
  site_name: string;
  latitude: number | null;
  longitude: number | null;
  address_detail: string | null;
  appointment_date: string | null;
  appointment_time_start: string | null;
  appointment_time_end: string | null;
  work_type_code: string | null;
  work_type_name: string | null;
  status_code: string | null;
  status_name: string | null;
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
   * Validate date format (YYYY-MM-DD)
   */
  private static validateDateFormat(date: string | undefined, fieldName: string = 'date'): string | undefined {
    if (!date) return undefined;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error(`Invalid ${fieldName} format. Expected YYYY-MM-DD, got: ${date}`);
    }

    // Also validate it's a valid date
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid ${fieldName}. Not a valid date: ${date}`);
    }

    return date;
  }

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
        ),
        jct_fleet_vehicle_employees (
          employee_id,
          main_employees (
            id,
            name
          )
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

      // Map employees from junction table
      const vehicleEmployees = v.jct_fleet_vehicle_employees as Array<{ employee_id: string; main_employees: { id: string; name: string } | null }> || [];
      const employees: EmployeeInfo[] = vehicleEmployees
        .filter((ve) => ve.main_employees)
        .map((ve) => ({
          id: ve.main_employees!.id,
          name: ve.main_employees!.name,
        }));

      return {
        id: v.id,
        name: v.name,
        plate_number: v.plate_number_override || v.plate_number,
        driver_name: v.driver_name_override || v.driver_name,
        employees,
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
        ),
        jct_fleet_vehicle_employees (
          employee_id,
          main_employees (
            id,
            name
          )
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

    // Map employees from junction table
    const vehicleEmployees = data.jct_fleet_vehicle_employees as Array<{ employee_id: string; main_employees: { id: string; name: string } | null }> || [];
    const employees: EmployeeInfo[] = vehicleEmployees
      .filter((ve) => ve.main_employees)
      .map((ve) => ({
        id: ve.main_employees!.id,
        name: ve.main_employees!.name,
      }));

    return {
      id: data.id,
      name: data.name,
      plate_number: data.plate_number_override || data.plate_number,
      driver_name: data.driver_name_override || data.driver_name,
      employees,
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
   * Get work locations for a vehicle based on assigned tickets
   * Returns sites with coordinates for tickets assigned to all employees of this vehicle
   */
  static async getWorkLocations(vehicleId: string, date?: string): Promise<WorkLocation[]> {
    const supabase = createServiceClient();

    // Validate date format if provided
    const validatedDate = this.validateDateFormat(date, 'date');

    // First get all employees assigned to this vehicle
    const { data: vehicleEmployees, error: vehicleError } = await supabase
      .from('jct_fleet_vehicle_employees')
      .select('employee_id')
      .eq('vehicle_id', vehicleId);

    if (vehicleError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลพนักงานของรถได้: ${vehicleError.message}`);
    }

    if (!vehicleEmployees || vehicleEmployees.length === 0) {
      // No employees assigned to this vehicle
      return [];
    }

    const employeeIds = vehicleEmployees.map((ve) => ve.employee_id);

    // Determine date range
    const targetDate = validatedDate || new Date().toISOString().split('T')[0];

    // Get confirmed tickets for these employees on the target date
    // Query from jct_ticket_employees_cf which has the date filter
    const { data: confirmedTickets, error: ticketsError } = await supabase
      .from('jct_ticket_employees_cf')
      .select(`
        ticket_id,
        main_tickets!inner (
          id,
          ticket_code,
          site_id,
          main_sites!inner (
            id,
            name,
            latitude,
            longitude,
            address_detail
          ),
          main_appointments!main_tickets_appointment_id_fkey (
            appointment_date,
            appointment_time_start,
            appointment_time_end
          ),
          ref_ticket_work_types!inner (
            code,
            name
          ),
          ref_ticket_statuses!inner (
            code,
            name
          )
        )
      `)
      .in('employee_id', employeeIds)
      .eq('date', targetDate);

    // Use a Set to deduplicate tickets (multiple employees might be confirmed for same ticket)
    const tickets = confirmedTickets || [];
    const seenTicketIds = new Set<string>();
    const uniqueTickets = tickets.filter((t) => {
      if (seenTicketIds.has(t.ticket_id)) return false;
      seenTicketIds.add(t.ticket_id);
      return true;
    });

    if (ticketsError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลงานได้: ${ticketsError.message}`);
    }

    // Filter out tickets without coordinates or appointment
    const validTickets = uniqueTickets.filter((row) => {
      const t = row.main_tickets as {
        main_sites: { latitude: number | null; longitude: number | null };
        main_appointments: { appointment_date: string | null } | null;
      };
      // Must have coordinates and appointment date
      return t.main_sites.latitude != null &&
             t.main_sites.longitude != null &&
             t.main_appointments?.appointment_date != null;
    });

    // Transform to WorkLocation format
    return validTickets.map((row) => {
      const t = row.main_tickets as {
        id: string;
        ticket_code: string | null;
        site_id: string;
        main_sites: { id: string; name: string; latitude: number | null; longitude: number | null; address_detail: string | null };
        main_appointments: { appointment_date: string | null; appointment_time_start: string | null; appointment_time_end: string | null } | null;
        ref_ticket_work_types: { code: string; name: string };
        ref_ticket_statuses: { code: string; name: string };
      };

      return {
        ticket_id: t.id,
        ticket_code: t.ticket_code,
        site_id: t.main_sites.id,
        site_name: t.main_sites.name,
        latitude: t.main_sites.latitude,
        longitude: t.main_sites.longitude,
        address_detail: t.main_sites.address_detail,
        appointment_date: t.main_appointments?.appointment_date || null,
        appointment_time_start: t.main_appointments?.appointment_time_start || null,
        appointment_time_end: t.main_appointments?.appointment_time_end || null,
        work_type_code: t.ref_ticket_work_types.code,
        work_type_name: t.ref_ticket_work_types.name,
        status_code: t.ref_ticket_statuses.code,
        status_name: t.ref_ticket_statuses.name,
      };
    });
  }

  /**
   * Get route history for a vehicle
   */
  static async getRouteHistory(vehicleId: string, params: RouteHistoryParams): Promise<VehicleHistoryPoint[]> {
    const supabase = createServiceClient();

    // Validate date formats if provided
    const validatedDate = this.validateDateFormat(params.date, 'date');
    const validatedStartDate = this.validateDateFormat(params.start_date, 'start_date');
    const validatedEndDate = this.validateDateFormat(params.end_date, 'end_date');

    // Default to today if no date specified
    let startDate: string;
    let endDate: string;

    if (validatedStartDate && validatedEndDate) {
      startDate = `${validatedStartDate}T00:00:00`;
      endDate = `${validatedEndDate}T23:59:59`;
    } else if (validatedDate) {
      startDate = `${validatedDate}T00:00:00`;
      endDate = `${validatedDate}T23:59:59`;
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

  /**
   * Set employees for a vehicle (replaces all existing assignments)
   */
  static async setVehicleEmployees(vehicleId: string, employeeIds: string[]): Promise<EmployeeInfo[]> {
    const supabase = createServiceClient();

    // First, delete all existing assignments
    const { error: deleteError } = await supabase
      .from('jct_fleet_vehicle_employees')
      .delete()
      .eq('vehicle_id', vehicleId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบพนักงานเดิมได้: ${deleteError.message}`);
    }

    // If no employees to add, return empty array
    if (employeeIds.length === 0) {
      return [];
    }

    // Insert new assignments
    const insertData = employeeIds.map((employeeId) => ({
      vehicle_id: vehicleId,
      employee_id: employeeId,
    }));

    const { error: insertError } = await supabase
      .from('jct_fleet_vehicle_employees')
      .insert(insertData);

    if (insertError) {
      throw new DatabaseError(`ไม่สามารถเพิ่มพนักงานได้: ${insertError.message}`);
    }

    // Fetch and return the employees with their names
    const { data: employees, error: fetchError } = await supabase
      .from('jct_fleet_vehicle_employees')
      .select(`
        employee_id,
        main_employees (
          id,
          name
        )
      `)
      .eq('vehicle_id', vehicleId);

    if (fetchError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลพนักงานได้: ${fetchError.message}`);
    }

    return (employees || [])
      .filter((e) => e.main_employees)
      .map((e) => ({
        id: (e.main_employees as { id: string; name: string }).id,
        name: (e.main_employees as { id: string; name: string }).name,
      }));
  }

  /**
   * Add an employee to a vehicle
   */
  static async addVehicleEmployee(vehicleId: string, employeeId: string): Promise<EmployeeInfo[]> {
    const supabase = createServiceClient();

    // Insert new assignment (will fail if already exists due to primary key)
    const { error: insertError } = await supabase
      .from('jct_fleet_vehicle_employees')
      .insert({
        vehicle_id: vehicleId,
        employee_id: employeeId,
      });

    if (insertError && !insertError.message.includes('duplicate')) {
      throw new DatabaseError(`ไม่สามารถเพิ่มพนักงานได้: ${insertError.message}`);
    }

    // Fetch and return all employees for this vehicle
    const { data: employees, error: fetchError } = await supabase
      .from('jct_fleet_vehicle_employees')
      .select(`
        employee_id,
        main_employees (
          id,
          name
        )
      `)
      .eq('vehicle_id', vehicleId);

    if (fetchError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลพนักงานได้: ${fetchError.message}`);
    }

    return (employees || [])
      .filter((e) => e.main_employees)
      .map((e) => ({
        id: (e.main_employees as { id: string; name: string }).id,
        name: (e.main_employees as { id: string; name: string }).name,
      }));
  }

  /**
   * Remove an employee from a vehicle
   */
  static async removeVehicleEmployee(vehicleId: string, employeeId: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('jct_fleet_vehicle_employees')
      .delete()
      .eq('vehicle_id', vehicleId)
      .eq('employee_id', employeeId);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบพนักงานได้: ${error.message}`);
    }
  }
}
