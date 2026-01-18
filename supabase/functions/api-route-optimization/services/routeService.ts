/**
 * Route Service - Fetches tickets and garage data for route optimization
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';
import type { StartLocation, TicketWaypoint } from '../types.ts';

interface WorkEstimate {
  ticket_id: string;
  estimated_minutes: number;
}

/**
 * Get work estimates for ticket IDs
 */
async function getWorkEstimates(ticketIds: string[]): Promise<Map<string, number>> {
  if (ticketIds.length === 0) {
    return new Map();
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('child_ticket_work_estimates')
    .select('ticket_id, estimated_minutes')
    .in('ticket_id', ticketIds);

  if (error) {
    console.error('Error fetching work estimates:', error);
    return new Map();
  }

  console.log('Work estimates fetched:', JSON.stringify(data));

  const map = new Map<string, number>();
  for (const item of data || []) {
    map.set(item.ticket_id, item.estimated_minutes);
  }

  console.log('Work estimates map size:', map.size);

  return map;
}

/**
 * Get garage by ID
 */
export async function getGarage(garageId: string): Promise<StartLocation> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('fleet_garages')
    .select('id, name, latitude, longitude')
    .eq('id', garageId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบข้อมูลโรงรถ');
    }
    throw new DatabaseError(`ไม่สามารถดึงข้อมูลโรงรถได้: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}

/**
 * Get tickets for a specific date with site coordinates
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of ticket waypoints with coordinates
 */
export async function getTicketsForDate(date: string): Promise<TicketWaypoint[]> {
  const supabase = createServiceClient();

  // Query tickets with appointments on the specified date
  // Join with sites to get coordinates
  const { data, error } = await supabase
    .from('main_tickets')
    .select(`
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
      main_appointments!inner (
        appointment_date,
        appointment_time_start,
        appointment_time_end,
        appointment_type
      ),
      ref_ticket_work_types (
        code,
        name
      )
    `)
    .eq('main_appointments.appointment_date', date);

  if (error) {
    throw new DatabaseError(`ไม่สามารถดึงข้อมูลงานได้: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Filter out tickets with null coordinates (Supabase .not() on joined tables doesn't work reliably)
  const ticketsWithCoords: typeof data = [];
  const ticketsWithoutCoords: string[] = [];

  for (const ticket of data) {
    const site = ticket.main_sites as { latitude: number | null; longitude: number | null; name: string } | null;
    if (site?.latitude != null && site?.longitude != null) {
      ticketsWithCoords.push(ticket);
    } else {
      ticketsWithoutCoords.push(`${ticket.ticket_code} (${site?.name || 'Unknown site'})`);
    }
  }

  if (ticketsWithoutCoords.length > 0) {
    console.warn(`[route-optimization] Tickets excluded (no coordinates): ${ticketsWithoutCoords.join(', ')}`);
  }

  if (ticketsWithCoords.length === 0) {
    return [];
  }

  // Get work estimates for all tickets
  const ticketIds = ticketsWithCoords.map((t) => t.id);
  const workEstimates = await getWorkEstimates(ticketIds);

  // Transform to TicketWaypoint format
  return ticketsWithCoords.map((ticket) => {
    const site = ticket.main_sites as {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      address_detail: string | null;
    };
    const appointment = ticket.main_appointments as {
      appointment_date: string;
      appointment_time_start: string | null;
      appointment_time_end: string | null;
      appointment_type: string | null;
    };
    const workType = ticket.ref_ticket_work_types as {
      code: string;
      name: string;
    } | null;

    return {
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      site_id: site.id,
      site_name: site.name,
      latitude: site.latitude,
      longitude: site.longitude,
      address: site.address_detail,
      appointment: {
        date: appointment.appointment_date,
        time_start: appointment.appointment_time_start,
        time_end: appointment.appointment_time_end,
        type: appointment.appointment_type,
      },
      work_type_code: workType?.code || null,
      work_type_name: workType?.name || null,
      work_duration_minutes: workEstimates.get(ticket.id) || 0,
    };
  });
}

/**
 * Get specific tickets by IDs with site coordinates
 * @param ticketIds - Array of ticket UUIDs
 * @returns Array of ticket waypoints with coordinates
 */
export async function getTicketsByIds(ticketIds: string[]): Promise<TicketWaypoint[]> {
  if (ticketIds.length === 0) {
    return [];
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_tickets')
    .select(`
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
      main_appointments (
        appointment_date,
        appointment_time_start,
        appointment_time_end,
        appointment_type
      ),
      ref_ticket_work_types (
        code,
        name
      )
    `)
    .in('id', ticketIds);

  if (error) {
    throw new DatabaseError(`ไม่สามารถดึงข้อมูลงานได้: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Filter out tickets with null coordinates (Supabase .not() on joined tables doesn't work reliably)
  const ticketsWithCoords: typeof data = [];
  const ticketsWithoutCoords: string[] = [];

  for (const ticket of data) {
    const site = ticket.main_sites as { latitude: number | null; longitude: number | null; name: string } | null;
    if (site?.latitude != null && site?.longitude != null) {
      ticketsWithCoords.push(ticket);
    } else {
      ticketsWithoutCoords.push(`${ticket.ticket_code} (${site?.name || 'Unknown site'})`);
    }
  }

  if (ticketsWithoutCoords.length > 0) {
    console.warn(`[route-optimization] Tickets excluded (no coordinates): ${ticketsWithoutCoords.join(', ')}`);
  }

  if (ticketsWithCoords.length === 0) {
    throw new DatabaseError(`ไม่มีงานที่มีพิกัดสถานที่ กรุณาเพิ่มพิกัดให้กับ: ${ticketsWithoutCoords.join(', ')}`);
  }

  // Get work estimates for all tickets
  const fetchedTicketIds = ticketsWithCoords.map((t) => t.id);
  const workEstimates = await getWorkEstimates(fetchedTicketIds);

  // Transform to TicketWaypoint format
  return ticketsWithCoords.map((ticket) => {
    const site = ticket.main_sites as {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      address_detail: string | null;
    };
    const appointment = ticket.main_appointments as {
      appointment_date: string;
      appointment_time_start: string | null;
      appointment_time_end: string | null;
      appointment_type: string | null;
    } | null;
    const workType = ticket.ref_ticket_work_types as {
      code: string;
      name: string;
    } | null;

    return {
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      site_id: site.id,
      site_name: site.name,
      latitude: site.latitude,
      longitude: site.longitude,
      address: site.address_detail,
      appointment: {
        date: appointment?.appointment_date || '',
        time_start: appointment?.appointment_time_start || null,
        time_end: appointment?.appointment_time_end || null,
        type: appointment?.appointment_type || null,
      },
      work_type_code: workType?.code || null,
      work_type_name: workType?.name || null,
      work_duration_minutes: workEstimates.get(ticket.id) || 0,
    };
  });
}
