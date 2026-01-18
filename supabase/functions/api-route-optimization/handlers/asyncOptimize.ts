/**
 * Async Route Optimization Handler
 * Simple Google Routes API-based optimization
 * Users can manually adjust routes after optimization
 */

import { success, error as errorResponse } from '../../_shared/response.ts';
import { ValidationError, NotFoundError } from '../../_shared/error.ts';
import { createJob, getJob, markJobProcessing, markJobCompleted, markJobFailed } from '../services/jobService.ts';
import { getGarage, getTicketsForDate, getTicketsByIds } from '../services/routeService.ts';
import { optimizeRoute, generateGoogleMapsUrl } from '../services/googleRoutesService.ts';
import type { OptimizeRequest, TicketWaypoint, LatLng, SingleRoute, OptimizedStop } from '../types.ts';

const MAX_WAYPOINTS = 100; // max
const DEFAULT_START_TIME = '08:00';

interface Employee {
  id: string;
  name: string;
  role?: { level: number };
}

interface GarageInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Start async optimization job
 */
export async function handleStartAsyncOptimize(
  req: Request,
  employee: Employee
): Promise<Response> {
  // TEST: Return immediately to check if routing works
  try {
    const body = await req.json();

    if (!body.date) {
      return errorResponse('กรุณาระบุวันที่ (date)', 400);
    }
    if (!body.garage_id) {
      return errorResponse('กรุณาระบุจุดเริ่มต้น (garage_id)', 400);
    }

    // Create job
    const jobId = await createJob(employee.id, body);

    // Start background processing
    const processingPromise = processJobInBackground(jobId).catch((err) => {
      console.error(`[optimize] Job ${jobId} failed:`, err);
    });

    // @ts-ignore - EdgeRuntime.waitUntil keeps function alive
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processingPromise);
    }

    return success({
      job_id: jobId,
      status: 'pending',
      message: 'เริ่มคำนวณเส้นทางแล้ว กรุณาตรวจสอบสถานะ',
      poll_url: `/api-route-optimization/jobs/${jobId}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`Error: ${msg}`, 500);
  }
}

/**
 * Get job status and result
 */
export async function handleGetJobStatus(
  req: Request,
  employee: Employee,
  jobId: string
): Promise<Response> {
  try {
    const job = await getJob(jobId);

    if (!job) {
      throw new NotFoundError('ไม่พบงานที่ระบุ');
    }

    let progress = 0;
    if (job.status === 'pending') progress = 10;
    else if (job.status === 'processing') {
      const elapsed = job.started_at
        ? (Date.now() - new Date(job.started_at).getTime()) / 1000
        : 0;
      progress = Math.min(90, 20 + Math.floor(elapsed / 60 * 70));
    } else if (job.status === 'completed') progress = 100;
    else if (job.status === 'failed') progress = 100;

    return success({
      job_id: job.id,
      status: job.status,
      progress,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      result: job.status === 'completed' ? job.result_payload : null,
      error: job.status === 'failed' ? job.error_message : null,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return errorResponse(err.message, 404);
    }
    console.error('Get job status error:', err);
    return errorResponse('เกิดข้อผิดพลาดในการดึงสถานะ', 500);
  }
}

/**
 * Process optimization job in background
 */
async function processJobInBackground(jobId: string): Promise<void> {
  console.log(`[optimize] Starting job ${jobId}`);

  try {
    await markJobProcessing(jobId);

    const job = await getJob(jobId);
    if (!job) throw new Error('Job not found');

    const body = job.request_payload as OptimizeRequest;
    const startTime = body.start_time || DEFAULT_START_TIME;
    const allowOvertime = body.allow_overtime !== false;

    // Get garage
    console.log(`[optimize] Job ${jobId}: Getting garage ${body.garage_id}`);
    const garage = await getGarage(body.garage_id);
    if (!garage.latitude || !garage.longitude) {
      throw new Error(`Garage ${garage.name} ไม่มีพิกัด กรุณาเพิ่มพิกัดให้กับโรงรถ`);
    }
    const origin: LatLng = {
      latitude: garage.latitude,
      longitude: garage.longitude,
    };

    // Get tickets
    console.log(`[optimize] Job ${jobId}: Getting ${body.ticket_ids?.length || 0} tickets`);
    let tickets: TicketWaypoint[];
    if (body.ticket_ids && body.ticket_ids.length > 0) {
      tickets = await getTicketsByIds(body.ticket_ids);
    } else {
      tickets = await getTicketsForDate(body.date);
    }
    console.log(`[optimize] Job ${jobId}: Got ${tickets.length} tickets with valid coordinates`);

    // Validate all tickets have coordinates
    for (const ticket of tickets) {
      if (ticket.latitude == null || ticket.longitude == null) {
        throw new Error(`Ticket ${ticket.ticket_code} (${ticket.site_name}) ไม่มีพิกัด`);
      }
    }

    if (tickets.length > MAX_WAYPOINTS) {
      throw new Error(`จำนวนงานเกินขีดจำกัด (สูงสุด ${MAX_WAYPOINTS} งาน)`);
    }

    // Empty tickets
    if (tickets.length === 0) {
      await markJobCompleted(jobId, {
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
      return;
    }

    // Check if multiple routes needed
    const maxPerRoute = body.max_per_route;

    if (maxPerRoute && tickets.length > maxPerRoute) {
      console.log(`[optimize] Job ${jobId}: Multi-route mode (${tickets.length} tickets, max ${maxPerRoute})`);
      const result = await processMultipleRoutes(tickets, origin, garage, maxPerRoute, startTime, allowOvertime);
      await markJobCompleted(jobId, result);
      return;
    }

    // Single route - use Google Routes API
    console.log(`[optimize] Job ${jobId}: Single route (${tickets.length} tickets)`);
    const result = await processSingleRoute(tickets, origin, garage, startTime, allowOvertime);
    await markJobCompleted(jobId, result);

    console.log(`[optimize] Job ${jobId}: Completed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[optimize] Job ${jobId}: Failed -`, message);
    await markJobFailed(jobId, message);
  }
}

/**
 * Process single route using Google Routes API
 */
async function processSingleRoute(
  tickets: TicketWaypoint[],
  origin: LatLng,
  garage: GarageInfo,
  startTime: string,
  allowOvertime: boolean
): Promise<Record<string, unknown>> {
  console.log(`[optimize] processSingleRoute: Building ${tickets.length} waypoints`);

  const waypoints: LatLng[] = tickets.map((t, idx) => {
    if (t.latitude == null || t.longitude == null) {
      console.error(`[optimize] Ticket at index ${idx} has null coordinates:`, t.ticket_code);
      throw new Error(`Ticket ${t.ticket_code} ไม่มีพิกัด`);
    }
    return {
      latitude: t.latitude,
      longitude: t.longitude,
    };
  });

  console.log(`[optimize] processSingleRoute: Calling Google Routes API`);
  // Optimize with Google Routes API
  const googleResult = await optimizeRoute(origin, waypoints);
  console.log(`[optimize] processSingleRoute: Got optimizedOrder with ${googleResult.optimizedOrder.length} items`);

  // Build stops
  const { stops, totalTravelMinutes, totalWorkMinutes, overtimeStops, endTime, totalDistanceMeters } =
    buildOptimizedStops(tickets, googleResult.optimizedOrder, googleResult.legs, startTime, allowOvertime);

  const googleMapsUrl = generateGoogleMapsUrl(origin,
    googleResult.optimizedOrder.map(i => waypoints[i])
  );

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

  return {
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
  };
}

/**
 * Process multiple routes using K-means clustering + Google Routes API
 */
async function processMultipleRoutes(
  tickets: TicketWaypoint[],
  origin: LatLng,
  garage: GarageInfo,
  maxPerRoute: number,
  startTime: string,
  allowOvertime: boolean
): Promise<Record<string, unknown>> {
  const numRoutes = Math.ceil(tickets.length / maxPerRoute);
  console.log(`[optimize] processMultipleRoutes: ${tickets.length} tickets, ${numRoutes} routes, max ${maxPerRoute}/route`);

  // Validate all tickets have coordinates before clustering
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    if (!t || t.latitude == null || t.longitude == null) {
      console.error(`[optimize] Invalid ticket at index ${i}:`, JSON.stringify(t));
      throw new Error(`Ticket at index ${i} is invalid or missing coordinates`);
    }
  }

  // Simple K-means clustering by geography
  let clusters = kMeansClustering(tickets, numRoutes, origin);
  console.log(`[optimize] K-means produced ${clusters.length} clusters: [${clusters.map(c => c.length).join(', ')}]`);

  // Enforce max per route
  clusters = enforceMaxPerRoute(clusters, maxPerRoute);
  console.log(`[optimize] After enforceMaxPerRoute: ${clusters.length} clusters: [${clusters.map(c => c.length).join(', ')}]`);

  // Sort clusters by distance from origin (nearest first)
  clusters.sort((a, b) => {
    const distA = getClusterCenterDistance(a, origin);
    const distB = getClusterCenterDistance(b, origin);
    return distA - distB;
  });

  // Optimize each cluster with Google Routes API
  const routes: SingleRoute[] = [];
  let totalDistance = 0;
  let totalTravelMinutes = 0;
  let totalWorkMinutes = 0;
  let totalOvertimeStops = 0;
  let latestEndTime = startTime;

  for (let routeNum = 0; routeNum < clusters.length; routeNum++) {
    const routeTickets = clusters[routeNum];
    if (routeTickets.length === 0) continue;

    // Validate cluster tickets
    for (let j = 0; j < routeTickets.length; j++) {
      const t = routeTickets[j];
      if (!t || t.latitude == null || t.longitude == null) {
        console.error(`[optimize] Route ${routeNum + 1}: Invalid ticket at cluster index ${j}:`, JSON.stringify(t));
        throw new Error(`Cluster ${routeNum + 1} has invalid ticket at index ${j}`);
      }
    }

    const waypoints: LatLng[] = routeTickets.map((t) => ({
      latitude: t.latitude,
      longitude: t.longitude,
    }));

    console.log(`[optimize] Route ${routeNum + 1}: Optimizing ${waypoints.length} waypoints`);

    // Optimize with Google Routes API
    const googleResult = await optimizeRoute(origin, waypoints);
    console.log(`[optimize] Route ${routeNum + 1}: Got optimizedOrder [${googleResult.optimizedOrder.join(', ')}]`);

    // Validate optimizedOrder indices
    for (const idx of googleResult.optimizedOrder) {
      if (idx < 0 || idx >= waypoints.length) {
        console.error(`[optimize] Route ${routeNum + 1}: Invalid index ${idx} in optimizedOrder (waypoints.length=${waypoints.length})`);
        throw new Error(`Invalid optimized index ${idx} for ${waypoints.length} waypoints`);
      }
    }

    // Build stops
    const routeResult = buildOptimizedStops(
      routeTickets,
      googleResult.optimizedOrder,
      googleResult.legs,
      startTime,
      allowOvertime
    );

    // Build Google Maps URL with validated waypoints
    const orderedWaypoints = googleResult.optimizedOrder
      .map(i => waypoints[i])
      .filter((wp): wp is LatLng => wp != null);

    const googleMapsUrl = generateGoogleMapsUrl(origin, orderedWaypoints);

    routes.push({
      route_number: routeNum + 1,
      stops: routeResult.stops,
      distance_meters: routeResult.totalDistanceMeters,
      travel_minutes: routeResult.totalTravelMinutes,
      work_minutes: routeResult.totalWorkMinutes,
      duration_minutes: routeResult.totalTravelMinutes + routeResult.totalWorkMinutes,
      start_time: startTime,
      end_time: routeResult.endTime,
      overtime_stops: routeResult.overtimeStops,
      google_maps_url: googleMapsUrl,
    });

    totalDistance += routeResult.totalDistanceMeters;
    totalTravelMinutes += routeResult.totalTravelMinutes;
    totalWorkMinutes += routeResult.totalWorkMinutes;
    totalOvertimeStops += routeResult.overtimeStops;

    if (compareTime(routeResult.endTime, latestEndTime) > 0) {
      latestEndTime = routeResult.endTime;
    }
  }

  return {
    routes,
    optimized_route: routes[0]?.stops || [],
    summary: {
      total_stops: tickets.length,
      total_distance_meters: totalDistance,
      total_travel_minutes: totalTravelMinutes,
      total_work_minutes: totalWorkMinutes,
      total_duration_minutes: totalTravelMinutes + totalWorkMinutes,
      start_time: startTime,
      end_time: latestEndTime,
      overtime_stops: totalOvertimeStops,
      start_location: garage,
    },
    google_maps_url: routes[0]?.google_maps_url || null,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

interface BuildStopsResult {
  stops: OptimizedStop[];
  totalTravelMinutes: number;
  totalWorkMinutes: number;
  overtimeStops: number;
  endTime: string;
  totalDistanceMeters: number;
}

function buildOptimizedStops(
  tickets: TicketWaypoint[],
  optimizedOrder: number[],
  legs: Array<{ distanceMeters: number; durationMinutes: number }>,
  startTime: string,
  allowOvertime: boolean
): BuildStopsResult {
  const WORK_END_TIME = '17:30';
  const stops: OptimizedStop[] = [];
  let currentTime = startTime;
  let totalTravelMinutes = 0;
  let totalWorkMinutes = 0;
  let totalDistanceMeters = 0;
  let overtimeStops = 0;

  console.log(`[optimize] buildOptimizedStops: tickets=${tickets.length}, optimizedOrder=${JSON.stringify(optimizedOrder)}`);

  for (let i = 0; i < optimizedOrder.length; i++) {
    const originalIndex = optimizedOrder[i];
    const ticket = tickets[originalIndex];
    if (!ticket) {
      console.error(`[optimize] buildOptimizedStops: No ticket at index ${originalIndex}`);
      continue;
    }
    if (ticket.latitude == null || ticket.longitude == null) {
      console.error(`[optimize] buildOptimizedStops: Ticket ${ticket.ticket_code} has null lat/long`);
      throw new Error(`Ticket ${ticket.ticket_code} ไม่มีพิกัด`);
    }

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

  return {
    stops,
    totalTravelMinutes,
    totalWorkMinutes,
    overtimeStops,
    endTime,
    totalDistanceMeters,
  };
}

/**
 * Simple K-means clustering for geographic grouping
 */
function kMeansClustering(
  tickets: TicketWaypoint[],
  k: number,
  origin: LatLng
): TicketWaypoint[][] {
  // Filter tickets to only those with valid coordinates
  const validTickets = tickets.filter(t =>
    t != null &&
    typeof t.latitude === 'number' &&
    typeof t.longitude === 'number' &&
    !isNaN(t.latitude) &&
    !isNaN(t.longitude)
  );

  console.log(`[optimize] kMeansClustering: ${tickets.length} input, ${validTickets.length} valid, k=${k}`);

  if (validTickets.length === 0) {
    return [];
  }

  if (validTickets.length <= k) {
    return validTickets.map(t => [t]);
  }

  // Initialize centroids using k-means++
  const centroids: LatLng[] = [];
  const firstIdx = Math.floor(Math.random() * validTickets.length);
  const firstTicket = validTickets[firstIdx];
  centroids.push({ latitude: firstTicket.latitude, longitude: firstTicket.longitude });

  while (centroids.length < k) {
    const distances = validTickets.map(t => {
      let minDist = Infinity;
      for (const c of centroids) {
        const dist = haversineDistance(t.latitude, t.longitude, c.latitude, c.longitude);
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    let random = Math.random() * totalDist;
    for (let i = 0; i < validTickets.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        const ticket = validTickets[i];
        centroids.push({ latitude: ticket.latitude, longitude: ticket.longitude });
        break;
      }
    }
  }

  // Iterate k-means
  let clusters: TicketWaypoint[][] = [];
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    clusters = Array.from({ length: centroids.length }, () => []);

    for (const ticket of validTickets) {
      let minDist = Infinity;
      let closestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineDistance(ticket.latitude, ticket.longitude, centroids[i].latitude, centroids[i].longitude);
        if (dist < minDist) {
          minDist = dist;
          closestCluster = i;
        }
      }

      clusters[closestCluster].push(ticket);
    }

    // Update centroids
    let converged = true;
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) continue;

      const clusterTickets = clusters[i].filter(t =>
        typeof t.latitude === 'number' && typeof t.longitude === 'number'
      );
      if (clusterTickets.length === 0) continue;

      const newLat = clusterTickets.reduce((sum, t) => sum + t.latitude, 0) / clusterTickets.length;
      const newLng = clusterTickets.reduce((sum, t) => sum + t.longitude, 0) / clusterTickets.length;

      if (Math.abs(newLat - centroids[i].latitude) > 0.001 || Math.abs(newLng - centroids[i].longitude) > 0.001) {
        converged = false;
      }

      centroids[i] = { latitude: newLat, longitude: newLng };
    }

    if (converged) break;
  }

  return clusters.filter(c => c.length > 0);
}

/**
 * Enforce max tickets per route
 */
function enforceMaxPerRoute(
  clusters: TicketWaypoint[][],
  maxPerRoute: number
): TicketWaypoint[][] {
  const result = clusters.map(c => [...c]);

  for (let i = 0; i < result.length; i++) {
    while (result[i].length > maxPerRoute) {
      let targetIdx = -1;
      for (let j = 0; j < result.length; j++) {
        if (j !== i && result[j].length < maxPerRoute) {
          targetIdx = j;
          break;
        }
      }

      if (targetIdx === -1) {
        result.push([]);
        targetIdx = result.length - 1;
      }

      const ticket = result[i].pop()!;
      result[targetIdx].push(ticket);
    }
  }

  return result.filter(c => c.length > 0);
}

function getClusterCenterDistance(cluster: TicketWaypoint[], origin: LatLng): number {
  const validTickets = cluster.filter(t =>
    t != null &&
    typeof t.latitude === 'number' &&
    typeof t.longitude === 'number' &&
    !isNaN(t.latitude) &&
    !isNaN(t.longitude)
  );
  if (validTickets.length === 0) return Infinity;
  const centerLat = validTickets.reduce((sum, t) => sum + t.latitude, 0) / validTickets.length;
  const centerLng = validTickets.reduce((sum, t) => sum + t.longitude, 0) / validTickets.length;
  return haversineDistance(origin.latitude, origin.longitude, centerLat, centerLng);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
