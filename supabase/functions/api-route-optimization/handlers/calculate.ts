/**
 * Calculate Handler
 * Calculates travel times for a user-specified order (no optimization)
 * Used after user drags/drops to rearrange stops
 */

import { success, error as errorResponse } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { getGarage, getTicketsByIds } from '../services/routeService.ts';
import { calculateRouteDistances, generateGoogleMapsUrl } from '../services/googleRoutesService.ts';
import type { LatLng, SingleRoute, OptimizedStop } from '../types.ts';

const DEFAULT_START_TIME = '08:00';
const WORK_END_TIME = '17:30';

interface Employee {
  id: string;
  name: string;
  role?: { level: number };
}

interface CalculateRequest {
  garage_id: string;
  ticket_ids: string[];
  start_time?: string;
}

/**
 * Handle calculate request - get travel times for user's specified order
 */
export async function handleCalculate(
  req: Request,
  employee: Employee
): Promise<Response> {
  try {
    const body = await req.json() as CalculateRequest;

    // Validate required fields
    if (!body.garage_id) {
      throw new ValidationError('กรุณาระบุจุดเริ่มต้น (garage_id)');
    }
    if (!body.ticket_ids || body.ticket_ids.length === 0) {
      throw new ValidationError('กรุณาระบุรายการงาน (ticket_ids)');
    }

    const startTime = body.start_time || DEFAULT_START_TIME;

    // Get garage
    const garage = await getGarage(body.garage_id);
    const origin: LatLng = {
      latitude: garage.latitude,
      longitude: garage.longitude,
    };

    // Get tickets - maintain the order provided by user
    const allTickets = await getTicketsByIds(body.ticket_ids);

    // Create a map for quick lookup
    const ticketMap = new Map(allTickets.map(t => [t.ticket_id, t]));

    // Order tickets according to user's specified order
    const orderedTickets = body.ticket_ids
      .map(id => ticketMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t != null);

    if (orderedTickets.length === 0) {
      return success({
        routes: [],
        optimized_route: [],
        summary: {
          total_stops: 0,
          total_distance_meters: 0,
          total_travel_minutes: 0,
          total_work_minutes: 0,
          total_duration_minutes: 0,
          start_time: startTime,
          end_time: startTime,
          overtime_stops: 0,
          start_location: garage,
        },
        google_maps_url: null,
      });
    }

    // Build waypoints in the user's order
    const waypoints: LatLng[] = orderedTickets.map(t => ({
      latitude: t.latitude,
      longitude: t.longitude,
    }));

    // Get distances from Google Routes API (no optimization, just distances)
    const legs = await calculateRouteDistances(origin, waypoints);

    // Build stops with timing
    const stops: OptimizedStop[] = [];
    let currentTime = startTime;
    let totalTravelMinutes = 0;
    let totalWorkMinutes = 0;
    let totalDistanceMeters = 0;
    let overtimeStops = 0;

    for (let i = 0; i < orderedTickets.length; i++) {
      const ticket = orderedTickets[i];
      const leg = legs[i];
      const travelMinutes = leg?.durationMinutes || 0;
      const workMinutes = ticket.work_duration_minutes || 0;
      const distanceMeters = leg?.distanceMeters || 0;

      const arrivalTime = addMinutesToTime(currentTime, travelMinutes);

      // Handle appointment waiting
      let workStart = arrivalTime;
      if (ticket.appointment?.time_start) {
        const apptTime = normalizeTime(ticket.appointment.time_start);
        if (!apptTime.includes('โทร') && compareTime(arrivalTime, apptTime) < 0) {
          workStart = apptTime;
        }
      }

      const workEnd = addMinutesToTime(workStart, workMinutes);
      const departureTime = workEnd;

      const isOvertime = compareTime(departureTime, WORK_END_TIME) > 0;
      if (isOvertime) overtimeStops++;

      let appointmentStatus: 'on_time' | 'early_wait' | 'late' | 'no_window' = 'no_window';
      if (ticket.appointment?.time_start && ticket.appointment?.time_end) {
        const apptStart = normalizeTime(ticket.appointment.time_start);
        const apptEnd = normalizeTime(ticket.appointment.time_end);
        if (!apptStart.includes('โทร')) {
          if (compareTime(arrivalTime, apptStart) < 0) {
            appointmentStatus = 'early_wait';
          } else if (compareTime(arrivalTime, apptEnd) <= 0) {
            appointmentStatus = 'on_time';
          } else {
            appointmentStatus = 'late';
          }
        }
      }

      stops.push({
        order: i + 1,
        ticket_id: ticket.ticket_id,
        ticket_code: ticket.ticket_code,
        site_name: ticket.site_name,
        latitude: ticket.latitude,
        longitude: ticket.longitude,
        address: ticket.address,
        appointment: ticket.appointment,
        work_type: ticket.work_type_name,
        estimated_arrival: arrivalTime,
        work_start: workStart,
        work_end: workEnd,
        estimated_departure: departureTime,
        travel_time_minutes: travelMinutes,
        work_duration_minutes: workMinutes,
        wait_time_minutes: getMinutesBetween(arrivalTime, workStart),
        distance_meters: distanceMeters,
        is_overtime: isOvertime,
        appointment_status: appointmentStatus,
      });

      currentTime = departureTime;
      totalTravelMinutes += travelMinutes;
      totalWorkMinutes += workMinutes;
      totalDistanceMeters += distanceMeters;
    }

    const endTime = stops.length > 0 ? stops[stops.length - 1].estimated_departure || startTime : startTime;

    // Generate Google Maps URL for the route
    const googleMapsUrl = generateGoogleMapsUrl(origin, waypoints);

    const singleRoute: SingleRoute = {
      route_number: 1,
      stops,
      distance_meters: totalDistanceMeters,
      travel_minutes: totalTravelMinutes,
      work_minutes: totalWorkMinutes,
      duration_minutes: totalTravelMinutes + totalWorkMinutes,
      start_time: startTime,
      end_time: endTime,
      overtime_stops: overtimeStops,
      google_maps_url: googleMapsUrl,
    };

    return success({
      routes: [singleRoute],
      optimized_route: stops,
      summary: {
        total_stops: stops.length,
        total_distance_meters: totalDistanceMeters,
        total_travel_minutes: totalTravelMinutes,
        total_work_minutes: totalWorkMinutes,
        total_duration_minutes: totalTravelMinutes + totalWorkMinutes,
        start_time: startTime,
        end_time: endTime,
        overtime_stops: overtimeStops,
        start_location: garage,
      },
      google_maps_url: googleMapsUrl,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400);
    }
    console.error('Calculate error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`เกิดข้อผิดพลาดในการคำนวณ: ${msg}`, 500);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

function compareTime(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h1 * 60 + m1) - (h2 * 60 + m2);
}

function getMinutesBetween(time1: string, time2: string): number {
  return Math.max(0, compareTime(time2, time1));
}

function normalizeTime(time: string): string {
  if (!time) return '00:00';
  if (time.includes('โทร')) return time;
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return time;
}
