/**
 * Route Optimization Handler
 */

import { success, error as errorResponse } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { getGarage, getTicketsForDate, getTicketsByIds } from '../services/routeService.ts';
import {
  optimizeRoute,
  generateGoogleMapsUrl,
  RoutesApiError,
} from '../services/googleRoutesService.ts';
import type {
  OptimizeRequest,
  OptimizeResponse,
  OptimizedStop,
  TicketWaypoint,
  LatLng,
  SingleRoute,
  RouteSummary,
  LunchBreakInfo,
  BalanceMode,
  BalanceMetrics,
  TimeSuggestion,
} from '../types.ts';
import { optimizeRouteWithAI, type OptimizedRoute as AIOptimizedRoute } from '../services/aiRouteOptimizer.ts';

/**
 * Time window interface for appointment constraints
 */
interface TimeWindow {
  start: string;
  end: string;
}

/**
 * Break configuration for lunch scheduling
 */
interface BreakConfig {
  type: 'FLOATING' | 'FIXED';
  minStart: string;   // Earliest break can start
  maxStart: string;   // Latest break can start
  duration: number;   // Duration in minutes
}

/**
 * Result of calculating stop timing
 */
interface StopTiming {
  arrivalTime: string;
  workStart: string;
  workEnd: string;
  departureTime: string;
  lunchTaken: boolean;
  lunchStart?: string;
  lunchEnd?: string;
  feasible: boolean;
  appointmentViolation?: string;
}

/**
 * Default lunch configuration (12:00-13:00, 60 min)
 */
const DEFAULT_LUNCH_CONFIG: BreakConfig = {
  type: 'FIXED',
  minStart: '12:00',
  maxStart: '12:00',
  duration: 60,
};

const MAX_WAYPOINTS = 100;
const MIN_PER_ROUTE = 1;
const MAX_PER_ROUTE = 50;
const DEFAULT_START_TIME = '08:00';
const WORK_END_TIME = '17:30'; // 17:30 is end of regular work hours

/**
 * Validate date format (YYYY-MM-DD)
 */
function validateDate(date: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new ValidationError('วันที่ไม่ถูกต้อง');
  }
}

/**
 * Validate UUID format
 */
function validateUUID(uuid: string, fieldName: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new ValidationError(`${fieldName} ไม่ถูกต้อง`);
  }
}

/**
 * Validate time format (HH:MM)
 */
function validateTime(time: string): void {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    throw new ValidationError('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }
}

/**
 * Handle POST /optimize - Optimize route for a day
 */
export async function handleOptimize(req: Request): Promise<Response> {
  try {
    const body: OptimizeRequest = await req.json();

    // Validate required fields
    if (!body.date) {
      throw new ValidationError('กรุณาระบุวันที่ (date)');
    }
    validateDate(body.date);

    if (!body.garage_id) {
      throw new ValidationError('กรุณาระบุจุดเริ่มต้น (garage_id)');
    }
    validateUUID(body.garage_id, 'garage_id');

    // Validate ticket_ids if provided
    if (body.ticket_ids && body.ticket_ids.length > 0) {
      for (const ticketId of body.ticket_ids) {
        validateUUID(ticketId, 'ticket_id');
      }
    }

    // Validate max_per_route if provided
    if (body.max_per_route !== undefined) {
      if (body.max_per_route < MIN_PER_ROUTE || body.max_per_route > MAX_PER_ROUTE) {
        throw new ValidationError(`max_per_route ต้องอยู่ระหว่าง ${MIN_PER_ROUTE} ถึง ${MAX_PER_ROUTE}`);
      }
    }

    // Validate start_time if provided
    const startTime = body.start_time || DEFAULT_START_TIME;
    validateTime(startTime);

    // Default allow_overtime to true
    const allowOvertime = body.allow_overtime !== false;

    // Get garage (starting point)
    const garage = await getGarage(body.garage_id);
    const origin: LatLng = {
      latitude: garage.latitude,
      longitude: garage.longitude,
    };

    // Get tickets
    let tickets: TicketWaypoint[];
    if (body.ticket_ids && body.ticket_ids.length > 0) {
      tickets = await getTicketsByIds(body.ticket_ids);
    } else {
      tickets = await getTicketsForDate(body.date);
    }

    // If no tickets found, return empty response
    if (tickets.length === 0) {
      const emptyResponse: OptimizeResponse = {
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
      };
      return success(emptyResponse);
    }

    // Check waypoint limit
    if (tickets.length > MAX_WAYPOINTS) {
      throw new ValidationError(
        `จำนวนงานเกินขีดจำกัด (สูงสุด ${MAX_WAYPOINTS} งาน, พบ ${tickets.length} งาน)`
      );
    }

    // Split into multiple routes if max_per_route specified
    const maxPerRoute = body.max_per_route;
    const balanceMode: BalanceMode = body.balance_mode || 'balanced';

    if (maxPerRoute && tickets.length > maxPerRoute) {
      return await handleMultipleRoutes(tickets, origin, garage, maxPerRoute, startTime, allowOvertime, balanceMode);
    } else {
      return await handleSingleRoute(tickets, origin, garage, startTime, allowOvertime);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400);
    }
    if (err instanceof RoutesApiError) {
      console.error('Routes API error:', err.code, err.message);
      return errorResponse(`ไม่สามารถคำนวณเส้นทางได้: ${err.message}`, 503);
    }
    console.error('Optimize route error:', err);
    return errorResponse('เกิดข้อผิดพลาดในการคำนวณเส้นทาง', 500);
  }
}

/**
 * Handle single route optimization with AI
 */
async function handleSingleRoute(
  tickets: TicketWaypoint[],
  origin: LatLng,
  garage: { id: string; name: string; latitude: number; longitude: number },
  startTime: string,
  allowOvertime: boolean
): Promise<Response> {
  // Use AI-powered optimization for intelligent route planning
  let aiResult: AIOptimizedRoute;
  try {
    aiResult = await optimizeRouteWithAI(tickets, origin, startTime);
    console.log('[optimize] AI optimization completed:', aiResult.reasoning);
  } catch (err) {
    console.error('[optimize] AI optimization failed, falling back to Google Routes:', err);
    // Fall back to Google Routes API
    const waypoints: LatLng[] = tickets.map((t) => ({
      latitude: t.latitude,
      longitude: t.longitude,
    }));
    const googleResult = await optimizeRoute(origin, waypoints);
    aiResult = {
      order: googleResult.optimizedOrder,
      reasoning: 'ใช้ Google Routes API (AI ไม่พร้อมใช้งาน)',
      suggestions: [],
      totalDistance: googleResult.totalDistanceMeters / 1000,
      estimatedDuration: googleResult.totalDurationMinutes,
    };
  }

  // Build optimization result from AI order
  const optimizationResult = buildOptimizationResultFromOrder(tickets, aiResult.order, origin);

  const { stops, totalTravelMinutes, totalWorkMinutes, overtimeStops, endTime, totalDistanceMeters } =
    buildOptimizedStops(tickets, optimizationResult, startTime, allowOvertime, garage);

  const orderedWaypoints = optimizationResult.optimizedOrder
    .filter((i) => i >= 0 && i < tickets.length && tickets[i])
    .map((i) => ({
      latitude: tickets[i].latitude,
      longitude: tickets[i].longitude,
    }));
  const googleMapsUrl = generateGoogleMapsUrl(origin, orderedWaypoints);

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

  const response: OptimizeResponse = {
    routes: [singleRoute],
    ai_reasoning: aiResult.reasoning,
    suggestions: aiResult.suggestions.length > 0 ? aiResult.suggestions : undefined,
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

  return success(response);
}

/**
 * Build optimization result from AI-provided order
 */
function buildOptimizationResultFromOrder(
  tickets: TicketWaypoint[],
  order: number[],
  origin: LatLng
): { optimizedOrder: number[]; legs: Array<{ distanceMeters: number; durationMinutes: number }> } {
  const legs: Array<{ distanceMeters: number; durationMinutes: number }> = [];
  const AVG_SPEED = 30; // km/h

  let prevLat = origin.latitude;
  let prevLng = origin.longitude;

  for (const idx of order) {
    const ticket = tickets[idx];
    if (!ticket) continue;

    const distanceKm = haversineDistance(prevLat, prevLng, ticket.latitude, ticket.longitude) * 1.3; // Road factor
    const durationMinutes = Math.round((distanceKm / AVG_SPEED) * 60);

    legs.push({
      distanceMeters: Math.round(distanceKm * 1000),
      durationMinutes,
    });

    prevLat = ticket.latitude;
    prevLng = ticket.longitude;
  }

  return { optimizedOrder: order, legs };
}

/**
 * Handle multiple routes optimization using geographical clustering with load balancing and AI
 */
async function handleMultipleRoutes(
  tickets: TicketWaypoint[],
  origin: LatLng,
  garage: { id: string; name: string; latitude: number; longitude: number },
  maxPerRoute: number,
  startTime: string,
  allowOvertime: boolean,
  balanceMode: BalanceMode = 'balanced'
): Promise<Response> {
  const numRoutes = Math.ceil(tickets.length / maxPerRoute);

  // Use k-means clustering to group nearby stops
  let clusters = kMeansClustering(tickets, numRoutes, origin);

  // Apply load balancing based on mode
  clusters = balanceClusters(clusters, maxPerRoute, balanceMode);

  // Calculate balance metrics for response
  const balanceMetrics = calculateBalanceMetrics(clusters);

  const routes: SingleRoute[] = [];
  let totalDistance = 0;
  let totalTravelMinutes = 0;
  let totalWorkMinutes = 0;
  let totalOvertimeStops = 0;
  let allStops: OptimizedStop[] = [];
  let latestEndTime = startTime;
  let allSuggestions: TimeSuggestion[] = [];
  const allReasonings: string[] = [];

  // Sort clusters by distance from origin (nearest first)
  clusters.sort((a, b) => {
    const distA = getClusterCenterDistance(a, origin);
    const distB = getClusterCenterDistance(b, origin);
    return distA - distB;
  });

  for (let routeNum = 0; routeNum < clusters.length; routeNum++) {
    const routeTickets = clusters[routeNum];

    if (routeTickets.length === 0) continue;

    // Use AI optimization for each cluster
    let aiResult: AIOptimizedRoute;
    try {
      aiResult = await optimizeRouteWithAI(routeTickets, origin, startTime);
      console.log(`[optimize] Route ${routeNum + 1} AI completed:`, aiResult.reasoning);
      allReasonings.push(`เส้นทาง ${routeNum + 1}: ${aiResult.reasoning}`);
      allSuggestions = allSuggestions.concat(aiResult.suggestions);
    } catch (err) {
      console.error(`[optimize] Route ${routeNum + 1} AI failed, using Google Routes:`, err);
      const routeWaypoints: LatLng[] = routeTickets.map((t) => ({
        latitude: t.latitude,
        longitude: t.longitude,
      }));
      const googleResult = await optimizeRoute(origin, routeWaypoints);
      aiResult = {
        order: googleResult.optimizedOrder,
        reasoning: 'ใช้ Google Routes API',
        suggestions: [],
        totalDistance: googleResult.totalDistanceMeters / 1000,
        estimatedDuration: googleResult.totalDurationMinutes,
      };
      allReasonings.push(`เส้นทาง ${routeNum + 1}: ${aiResult.reasoning}`);
    }

    const routeOptimization = buildOptimizationResultFromOrder(routeTickets, aiResult.order, origin);

    const { stops: routeStops, totalTravelMinutes: routeTravelMins, totalWorkMinutes: routeWorkMins, overtimeStops: routeOvertimeStops, endTime: routeEndTime, totalDistanceMeters: routeDistanceMeters } =
      buildOptimizedStops(routeTickets, routeOptimization, startTime, allowOvertime, garage);

    const routeOrderedWaypoints = routeOptimization.optimizedOrder
      .filter((i) => i >= 0 && i < routeTickets.length && routeTickets[i])
      .map((i) => ({
        latitude: routeTickets[i].latitude,
        longitude: routeTickets[i].longitude,
      }));
    const routeGoogleMapsUrl = generateGoogleMapsUrl(origin, routeOrderedWaypoints);

    routes.push({
      route_number: routeNum + 1,
      stops: routeStops,
      distance_meters: routeDistanceMeters,
      travel_minutes: routeTravelMins,
      work_minutes: routeWorkMins,
      duration_minutes: routeTravelMins + routeWorkMins,
      start_time: startTime,
      end_time: routeEndTime,
      overtime_stops: routeOvertimeStops,
      google_maps_url: routeGoogleMapsUrl,
    });

    totalDistance += routeDistanceMeters;
    totalTravelMinutes += routeTravelMins;
    totalWorkMinutes += routeWorkMins;
    totalOvertimeStops += routeOvertimeStops;
    allStops = allStops.concat(routeStops);

    if (compareTime(routeEndTime, latestEndTime) > 0) {
      latestEndTime = routeEndTime;
    }
  }

  const firstRoute = routes[0];

  const response: OptimizeResponse = {
    routes,
    ai_reasoning: allReasonings.join('\n'),
    suggestions: allSuggestions.length > 0 ? allSuggestions : undefined,
    optimized_route: firstRoute?.stops || [],
    summary: {
      total_stops: allStops.length,
      total_distance_meters: totalDistance,
      total_travel_minutes: totalTravelMinutes,
      total_work_minutes: totalWorkMinutes,
      total_duration_minutes: totalTravelMinutes + totalWorkMinutes,
      start_time: startTime,
      end_time: latestEndTime,
      overtime_stops: totalOvertimeStops,
      start_location: garage,
      balance: balanceMetrics,
    },
    google_maps_url: firstRoute?.google_maps_url || null,
  };

  return success(response);
}

/**
 * K-means clustering to group nearby tickets
 */
function kMeansClustering(
  tickets: TicketWaypoint[],
  k: number,
  origin: LatLng
): TicketWaypoint[][] {
  // Filter tickets with valid coordinates
  const validTickets = tickets.filter(
    t => t && t.latitude != null && t.longitude != null
  );

  if (validTickets.length === 0) {
    return [];
  }

  if (validTickets.length <= k) {
    // Each ticket gets its own cluster
    return validTickets.map(t => [t]);
  }

  // Initialize centroids using k-means++ strategy
  const centroids: LatLng[] = initializeCentroids(validTickets, k);

  if (centroids.length === 0) {
    // Fallback: put all tickets in one cluster
    return [validTickets];
  }

  let clusters: TicketWaypoint[][] = [];
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign tickets to nearest centroid
    clusters = Array.from({ length: centroids.length }, () => []);

    for (const ticket of validTickets) {
      if (!ticket || ticket.latitude == null || ticket.longitude == null) continue;

      let minDist = Infinity;
      let closestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const centroid = centroids[i];
        if (!centroid || centroid.latitude == null || centroid.longitude == null) continue;

        const dist = haversineDistance(
          ticket.latitude, ticket.longitude,
          centroid.latitude, centroid.longitude
        );
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

      const validClusterTickets = clusters[i].filter(
        t => t && t.latitude != null && t.longitude != null
      );
      if (validClusterTickets.length === 0) continue;

      const newLat = validClusterTickets.reduce((sum, t) => sum + t.latitude, 0) / validClusterTickets.length;
      const newLng = validClusterTickets.reduce((sum, t) => sum + t.longitude, 0) / validClusterTickets.length;

      if (Math.abs(newLat - centroids[i].latitude) > 0.001 ||
          Math.abs(newLng - centroids[i].longitude) > 0.001) {
        converged = false;
      }

      centroids[i] = { latitude: newLat, longitude: newLng };
    }

    if (converged) break;
  }

  // Filter out empty clusters
  return clusters.filter(c => c.length > 0);
}

/**
 * Initialize centroids using k-means++ for better distribution
 */
function initializeCentroids(tickets: TicketWaypoint[], k: number): LatLng[] {
  // Filter tickets with valid coordinates
  const validTickets = tickets.filter(
    t => t && t.latitude != null && t.longitude != null
  );

  if (validTickets.length === 0) {
    return [];
  }

  const centroids: LatLng[] = [];

  // Pick first centroid randomly
  const firstIdx = Math.floor(Math.random() * validTickets.length);
  const firstTicket = validTickets[firstIdx];
  centroids.push({
    latitude: firstTicket.latitude,
    longitude: firstTicket.longitude,
  });

  // Pick remaining centroids with probability proportional to distance squared
  while (centroids.length < k && centroids.length < validTickets.length) {
    const distances: number[] = validTickets.map(t => {
      if (!t || t.latitude == null || t.longitude == null) return 0;
      let minDist = Infinity;
      for (const c of centroids) {
        const dist = haversineDistance(t.latitude, t.longitude, c.latitude, c.longitude);
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist; // Square for probability weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    let random = Math.random() * totalDist;

    for (let i = 0; i < validTickets.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        const ticket = validTickets[i];
        if (ticket && ticket.latitude != null && ticket.longitude != null) {
          centroids.push({
            latitude: ticket.latitude,
            longitude: ticket.longitude,
          });
        }
        break;
      }
    }
  }

  return centroids;
}

/**
 * Haversine distance between two points (in km)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get average distance from cluster center to origin
 */
function getClusterCenterDistance(cluster: TicketWaypoint[], origin: LatLng): number {
  const validTickets = cluster.filter(t => t && t.latitude != null && t.longitude != null);
  if (validTickets.length === 0) return Infinity;
  if (!origin || origin.latitude == null || origin.longitude == null) return Infinity;

  const centerLat = validTickets.reduce((sum, t) => sum + t.latitude, 0) / validTickets.length;
  const centerLng = validTickets.reduce((sum, t) => sum + t.longitude, 0) / validTickets.length;

  return haversineDistance(origin.latitude, origin.longitude, centerLat, centerLng);
}

/**
 * Get total work duration for a cluster
 */
function getClusterWorkload(cluster: TicketWaypoint[]): number {
  return cluster.reduce((sum, t) => sum + (t.work_duration_minutes || 0), 0);
}

/**
 * Get cluster center coordinates
 */
function getClusterCenter(cluster: TicketWaypoint[]): LatLng {
  const validTickets = cluster.filter(t => t && t.latitude != null && t.longitude != null);
  if (validTickets.length === 0) return { latitude: 0, longitude: 0 };
  return {
    latitude: validTickets.reduce((sum, t) => sum + t.latitude, 0) / validTickets.length,
    longitude: validTickets.reduce((sum, t) => sum + t.longitude, 0) / validTickets.length,
  };
}

// Target CV for "balanced" mode - 20% is considered good balance
const TARGET_CV = 20;

/**
 * Calculate balance metrics using Coefficient of Variation (CV)
 * CV = (stdDev / mean) × 100%
 *
 * Industry standards:
 * - CV < 15% = excellent balance
 * - CV < 25% = acceptable balance
 * - CV > 30% = poor balance
 */
function calculateBalanceMetrics(
  clusters: TicketWaypoint[][],
  targetCV: number = TARGET_CV
): BalanceMetrics {
  const workloads = clusters.map(c =>
    c.reduce((sum, t) => sum + (t.work_duration_minutes || 0), 0)
  );

  const n = workloads.length;
  if (n === 0) {
    return {
      coefficient_of_variation: 0,
      is_balanced: true,
      workloads: [],
      mean_workload: 0,
      standard_deviation: 0,
    };
  }

  const mean = workloads.reduce((a, b) => a + b, 0) / n;
  const variance = workloads.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

  return {
    coefficient_of_variation: Math.round(cv * 10) / 10, // Round to 1 decimal
    is_balanced: cv <= targetCV,
    workloads,
    mean_workload: Math.round(mean),
    standard_deviation: Math.round(stdDev),
  };
}

/**
 * Balance clusters based on selected mode
 *
 * Modes:
 * - 'geography': Keep K-means result as-is (optimal geography, ignores workload)
 * - 'workload': First-Fit Decreasing bin-packing (optimal workload, ignores geography)
 * - 'balanced': Hybrid iteration (good geography + good workload)
 */
function balanceClusters(
  clusters: TicketWaypoint[][],
  maxPerRoute: number,
  mode: BalanceMode
): TicketWaypoint[][] {
  if (clusters.length <= 1) return clusters;

  switch (mode) {
    case 'geography':
      // Pure K-means result - only enforce max limit, no workload balancing
      return enforceMaxPerRoute(clusters, maxPerRoute);

    case 'workload':
      // First-Fit Decreasing bin-packing - optimal workload balance
      return balanceByWorkloadFFD(clusters, maxPerRoute);

    case 'balanced':
    default:
      // Hybrid: start with geography, iterate until CV < target
      return balanceHybridWithCV(clusters, maxPerRoute, TARGET_CV);
  }
}

/**
 * Enforce max stops per route without changing distribution
 */
function enforceMaxPerRoute(
  clusters: TicketWaypoint[][],
  maxPerRoute: number
): TicketWaypoint[][] {
  const result = clusters.map(c => [...c]);

  for (let i = 0; i < result.length; i++) {
    while (result[i].length > maxPerRoute) {
      // Find nearest cluster with room
      let bestTargetIdx = -1;
      let bestDistance = Infinity;
      const sourceCenter = getClusterCenter(result[i]);

      for (let j = 0; j < result.length; j++) {
        if (j !== i && result[j].length < maxPerRoute) {
          const targetCenter = getClusterCenter(result[j]);
          const dist = haversineDistance(
            sourceCenter.latitude, sourceCenter.longitude,
            targetCenter.latitude, targetCenter.longitude
          );
          if (dist < bestDistance) {
            bestDistance = dist;
            bestTargetIdx = j;
          }
        }
      }

      if (bestTargetIdx === -1) {
        // Create new cluster if no room
        result.push([]);
        bestTargetIdx = result.length - 1;
      }

      // Move the ticket furthest from source center to target
      let furthestIdx = 0;
      let furthestDist = 0;
      for (let k = 0; k < result[i].length; k++) {
        const dist = haversineDistance(
          result[i][k].latitude, result[i][k].longitude,
          sourceCenter.latitude, sourceCenter.longitude
        );
        if (dist > furthestDist) {
          furthestDist = dist;
          furthestIdx = k;
        }
      }

      const [ticket] = result[i].splice(furthestIdx, 1);
      result[bestTargetIdx].push(ticket);
    }
  }

  return result.filter(c => c.length > 0);
}

/**
 * First-Fit Decreasing (FFD) bin-packing algorithm for workload balancing
 *
 * This completely ignores geography and focuses solely on balancing workload.
 * Algorithm:
 * 1. Sort tickets by workload descending (largest first)
 * 2. For each ticket, assign to route with MINIMUM current workload
 * 3. Results in very balanced workloads (typically CV < 10%)
 *
 * Best for: Equal technician work hours, even if routes are geographically scattered
 */
function balanceByWorkloadFFD(
  clusters: TicketWaypoint[][],
  maxPerRoute: number
): TicketWaypoint[][] {
  // Flatten all tickets
  const allTickets = clusters.flat();
  const numRoutes = Math.max(clusters.length, Math.ceil(allTickets.length / maxPerRoute));

  // Sort tickets by workload descending (First-Fit Decreasing)
  // This is crucial for FFD - largest items first gives better bin packing
  const sortedTickets = [...allTickets].sort((a, b) =>
    (b.work_duration_minutes || 0) - (a.work_duration_minutes || 0)
  );

  // Initialize empty routes
  const routes: TicketWaypoint[][] = Array.from({ length: numRoutes }, () => []);
  const routeWorkloads: number[] = Array(numRoutes).fill(0);

  // Assign each ticket to the route with MINIMUM current workload (that has room)
  for (const ticket of sortedTickets) {
    const workload = ticket.work_duration_minutes || 0;

    // Find route with minimum workload that has room
    let bestRouteIdx = 0;
    let minWorkload = Infinity;

    for (let i = 0; i < numRoutes; i++) {
      if (routes[i].length < maxPerRoute && routeWorkloads[i] < minWorkload) {
        minWorkload = routeWorkloads[i];
        bestRouteIdx = i;
      }
    }

    routes[bestRouteIdx].push(ticket);
    routeWorkloads[bestRouteIdx] += workload;
  }

  return routes.filter(r => r.length > 0);
}

/**
 * Hybrid balancing using CV-based iteration
 *
 * Algorithm (Two-Phase):
 * 1. Start with K-means geographical clustering (enforced max per route)
 * 2. Measure Coefficient of Variation (CV)
 * 3. If CV > target, iteratively move tickets from overloaded → underloaded
 * 4. Prefer moving tickets that are CLOSER to the target cluster (distance penalty)
 * 5. Stop when CV < target OR no beneficial moves remain
 *
 * This preserves geographical grouping while improving workload balance.
 * Best for: Real-world use where both travel time and fair workload matter.
 */
function balanceHybridWithCV(
  clusters: TicketWaypoint[][],
  maxPerRoute: number,
  targetCV: number = TARGET_CV
): TicketWaypoint[][] {
  // Phase 1: Enforce max per route (geography-preserving)
  let result = enforceMaxPerRoute(clusters, maxPerRoute);
  if (result.length <= 1) return result;

  // Phase 2: Iteratively rebalance until CV target met
  const maxIterations = 100;

  for (let iter = 0; iter < maxIterations; iter++) {
    const metrics = calculateBalanceMetrics(result, targetCV);

    // Stop if balanced enough (CV < target)
    if (metrics.is_balanced) break;

    // Find most overloaded and most underloaded clusters
    const workloads = result.map(c => getClusterWorkload(c));
    const maxWorkload = Math.max(...workloads);
    const maxIdx = workloads.indexOf(maxWorkload);

    // Find underloaded cluster with room
    let minIdx = -1;
    let minWorkload = Infinity;
    for (let i = 0; i < result.length; i++) {
      if (i !== maxIdx && result[i].length < maxPerRoute && workloads[i] < minWorkload) {
        minWorkload = workloads[i];
        minIdx = i;
      }
    }

    if (minIdx === -1 || maxIdx === minIdx || result[maxIdx].length <= 1) break;

    // Find best ticket to move (considering both workload impact AND distance)
    const bestMove = findBestMoveForBalance(
      result[maxIdx],
      result[minIdx],
      maxWorkload,
      minWorkload
    );

    if (!bestMove) break;

    // Execute move
    const [ticket] = result[maxIdx].splice(bestMove.ticketIdx, 1);
    result[minIdx].push(ticket);
  }

  return result.filter(c => c.length > 0);
}

/**
 * Find the best ticket to move from source to target cluster
 *
 * Scoring:
 * - 70% weight on workload improvement (how much it reduces imbalance)
 * - 30% weight on distance (prefer tickets closer to target cluster)
 *
 * Returns null if no beneficial move exists.
 */
function findBestMoveForBalance(
  sourceCluster: TicketWaypoint[],
  targetCluster: TicketWaypoint[],
  sourceWorkload: number,
  targetWorkload: number
): { ticketIdx: number; score: number } | null {
  const targetCenter = getClusterCenter(targetCluster);
  const currentImbalance = sourceWorkload - targetWorkload;

  let best: { ticketIdx: number; score: number } | null = null;

  for (let i = 0; i < sourceCluster.length; i++) {
    const ticket = sourceCluster[i];
    const workload = ticket.work_duration_minutes || 0;

    // Skip tickets with no workload (won't help balance)
    if (workload === 0) continue;

    // Calculate new imbalance after move
    const newSourceWorkload = sourceWorkload - workload;
    const newTargetWorkload = targetWorkload + workload;
    const newImbalance = Math.abs(newSourceWorkload - newTargetWorkload);

    // Only consider moves that IMPROVE balance
    if (newImbalance >= currentImbalance) continue;

    // Calculate improvement ratio (0-1, higher is better)
    const improvement = (currentImbalance - newImbalance) / currentImbalance;

    // Calculate distance penalty (0-1, lower is better)
    const distance = haversineDistance(
      ticket.latitude, ticket.longitude,
      targetCenter.latitude, targetCenter.longitude
    );
    const distancePenalty = Math.min(distance / 100, 1); // 100km = max penalty

    // Combined score: improvement - distance penalty
    // Weight: 70% improvement, 30% distance
    const score = improvement * 0.7 - distancePenalty * 0.3;

    if (!best || score > best.score) {
      best = { ticketIdx: i, score };
    }
  }

  return best;
}

interface GarageInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Smart route reordering with time window constraints
 *
 * Uses a greedy nearest-neighbor algorithm that respects appointment times:
 * 1. At each step, find all tickets we can still reach on time
 * 2. Among reachable tickets, pick the nearest one
 * 3. This balances geography AND time constraints
 */
function reorderForAppointments(
  tickets: TicketWaypoint[],
  optimizationResult: { optimizedOrder: number[]; legs: Array<{ distanceMeters: number; durationMinutes: number }> },
  startTime: string,
  originLat?: number,
  originLng?: number
): { optimizedOrder: number[]; legs: Array<{ distanceMeters: number; durationMinutes: number }> } {
  const originalOrder = optimizationResult.optimizedOrder;

  // Safety check: return as-is if empty or single item
  if (!originalOrder || originalOrder.length <= 1) {
    return optimizationResult;
  }

  // Safety check: ensure tickets array is valid
  if (!tickets || tickets.length === 0) {
    return optimizationResult;
  }

  // Build list of all tickets with their appointment info
  const allTickets: Array<{
    idx: number;
    timeStart: string | null;
    lat: number;
    lng: number;
    workMinutes: number;
  }> = [];

  for (const idx of originalOrder) {
    if (idx < 0 || idx >= tickets.length) continue;
    const ticket = tickets[idx];
    if (!ticket) continue;

    const timeStart = ticket.appointment?.time_start;
    allTickets.push({
      idx,
      timeStart: timeStart ? normalizeTime(timeStart) : null,
      lat: ticket.latitude,
      lng: ticket.longitude,
      workMinutes: ticket.work_duration_minutes || 0,
    });
  }

  // If no tickets with appointments, keep Google's optimized order
  const hasAppointments = allTickets.some(t => t.timeStart !== null);
  if (!hasAppointments) {
    return optimizationResult;
  }

  // Greedy nearest-neighbor with time windows
  const AVG_SPEED_KM_PER_MIN = 0.5; // ~30 km/h
  const newOrder: number[] = [];
  const remaining = new Set(allTickets.map((_, i) => i));

  // Start position (use origin if provided, else first ticket)
  let currentLat = originLat ?? allTickets[0]?.lat ?? 0;
  let currentLng = originLng ?? allTickets[0]?.lng ?? 0;
  let currentTime = startTime;

  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestDistance = Infinity;
    let bestArrivalTime = '';

    for (const i of remaining) {
      const ticket = allTickets[i];

      // Calculate travel time to this ticket
      const distance = haversineDistance(currentLat, currentLng, ticket.lat, ticket.lng);
      const travelMinutes = Math.round(distance / AVG_SPEED_KM_PER_MIN);
      const arrivalTime = addMinutesToTime(currentTime, travelMinutes);

      // Check if we can make the appointment
      if (ticket.timeStart) {
        // If we'd arrive AFTER appointment time, check how late
        const lateness = getMinutesBetween(ticket.timeStart, arrivalTime);
        if (lateness > 15) {
          // More than 15 min late - skip this ticket for now
          // (We might come back to it if all others are also late)
          continue;
        }
      }

      // Among reachable tickets, pick the nearest
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIdx = i;
        bestArrivalTime = arrivalTime;
      }
    }

    // If no reachable ticket found, pick the one with earliest appointment
    // (We'll be late, but we have to go somewhere)
    if (bestIdx === -1) {
      let earliestTime = '99:99';
      for (const i of remaining) {
        const ticket = allTickets[i];
        const time = ticket.timeStart || '23:59';
        if (compareTime(time, earliestTime) < 0) {
          earliestTime = time;
          bestIdx = i;
          const distance = haversineDistance(currentLat, currentLng, ticket.lat, ticket.lng);
          const travelMinutes = Math.round(distance / AVG_SPEED_KM_PER_MIN);
          bestArrivalTime = addMinutesToTime(currentTime, travelMinutes);
        }
      }
    }

    if (bestIdx === -1) break; // Should never happen

    const chosenTicket = allTickets[bestIdx];
    newOrder.push(chosenTicket.idx);
    remaining.delete(bestIdx);

    // Update current position and time
    currentLat = chosenTicket.lat;
    currentLng = chosenTicket.lng;

    // If we arrive early, wait until appointment time
    if (chosenTicket.timeStart && compareTime(bestArrivalTime, chosenTicket.timeStart) < 0) {
      currentTime = addMinutesToTime(chosenTicket.timeStart, chosenTicket.workMinutes);
    } else {
      currentTime = addMinutesToTime(bestArrivalTime, chosenTicket.workMinutes);
    }
  }

  // Recalculate legs based on new order
  const newLegs = calculateLegsForOrder(tickets, newOrder, optimizationResult.legs, originalOrder);

  return {
    optimizedOrder: newOrder,
    legs: newLegs,
  };
}

/**
 * Normalize time string to HH:MM format
 * Handles "HH:MM:SS" -> "HH:MM" and "HH:MM" -> "HH:MM"
 */
function normalizeTime(time: string): string {
  if (!time) return '00:00';
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return time;
}

/**
 * Optimize adjacent appointments to reduce zigzag routes
 *
 * Only swaps adjacent appointments if:
 * 1. Swapping reduces travel distance significantly
 * 2. We can STILL meet the earlier appointment time after visiting the later one first
 *
 * This is only possible when:
 * - The "later" appointment is geographically on the way
 * - We have enough slack time to visit it and still make the "earlier" appointment
 */
function optimizeAdjacentAppointments(
  appointments: Array<{ idx: number; timeStart: string }>,
  tickets: TicketWaypoint[],
  startTime: string
): Array<{ idx: number; timeStart: string }> {
  if (appointments.length <= 1) return appointments;

  const result = [...appointments];
  const AVG_SPEED_KM_PER_MIN = 0.5; // ~30 km/h in city traffic

  // Multiple passes to handle chain effects
  for (let pass = 0; pass < 3; pass++) {
    let swapped = false;

    for (let i = 0; i < result.length - 1; i++) {
      const earlier = result[i];     // Has earlier appointment time (e.g., 09:07)
      const later = result[i + 1];   // Has later appointment time (e.g., 09:15)

      const earlierTicket = tickets[earlier.idx];
      const laterTicket = tickets[later.idx];

      if (!earlierTicket || !laterTicket) continue;

      // Calculate time gap between appointments
      const timeGapMinutes = getMinutesBetween(earlier.timeStart, later.timeStart);

      // If appointments are more than 60 min apart, don't try to swap
      // (The earlier one is likely meant to be visited first)
      if (timeGapMinutes > 60) continue;

      // If appointments are very close in time (<10 min), we can't swap
      // (No time to visit one and make it to the other)
      if (timeGapMinutes < 10) continue;

      // Get previous stop location for distance calculation
      let prevLat: number, prevLng: number;
      if (i > 0) {
        const prevTicket = tickets[result[i - 1].idx];
        if (prevTicket) {
          prevLat = prevTicket.latitude;
          prevLng = prevTicket.longitude;
        } else {
          continue;
        }
      } else {
        // First stop - skip optimization (origin matters more)
        continue;
      }

      // Calculate distances
      const distToEarlier = haversineDistance(prevLat, prevLng, earlierTicket.latitude, earlierTicket.longitude);
      const distToLater = haversineDistance(prevLat, prevLng, laterTicket.latitude, laterTicket.longitude);
      const distBetween = haversineDistance(
        earlierTicket.latitude, earlierTicket.longitude,
        laterTicket.latitude, laterTicket.longitude
      );

      // Current order: prev → earlier → later = distToEarlier + distBetween
      const currentDist = distToEarlier + distBetween;

      // Swapped order: prev → later → earlier = distToLater + distBetween
      const swappedDist = distToLater + distBetween;

      // Only swap if we save at least 2km
      if (swappedDist >= currentDist - 2) continue;

      // Calculate if we can still make the earlier appointment after visiting later first
      const travelToLater = distToLater / AVG_SPEED_KM_PER_MIN;
      const workAtLater = laterTicket.work_duration_minutes || 0;
      const travelLaterToEarlier = distBetween / AVG_SPEED_KM_PER_MIN;

      // Total time needed: travel to later + wait for appointment + work + travel to earlier
      const totalTimeNeeded = travelToLater + workAtLater + travelLaterToEarlier;

      // We'd arrive at "later" stop, wait for its appointment time, do work, then go to "earlier"
      // The question: after doing all that, would we still be on time for "earlier"?

      // If the later appointment time + work + travel is still before the earlier appointment time,
      // then we CAN swap (we'd arrive early to the "earlier" stop and wait)
      // Example: later=09:15, work=15min, travel=5min → finish at 09:35
      //          earlier=09:07 → we'd be 28 min LATE
      //
      // The only way this works is if earlier appointment is AFTER we'd arrive
      // This means we must have significant slack

      // Calculate when we'd arrive at "earlier" if we visit "later" first
      // Assume we arrive at "later" just in time for its appointment
      const arriveAtLater = later.timeStart;
      const leaveFromLater = addMinutesToTime(arriveAtLater, workAtLater);
      const arriveAtEarlier = addMinutesToTime(leaveFromLater, Math.round(travelLaterToEarlier));

      // If we'd arrive at "earlier" stop AFTER its appointment time, can't swap
      if (compareTime(arriveAtEarlier, earlier.timeStart) > 0) {
        continue;
      }

      // Swap is beneficial and feasible!
      result[i] = later;
      result[i + 1] = earlier;
      swapped = true;
    }

    if (!swapped) break;
  }

  return result;
}

/**
 * Check if a flexible ticket can be completed before an appointment time
 */
function canFitBefore(
  tickets: TicketWaypoint[],
  currentOrder: number[],
  flexibleIdx: number,
  appointmentTime: string,
  startTime: string
): boolean {
  // Safety check
  if (!tickets || flexibleIdx < 0 || flexibleIdx >= tickets.length) {
    return false;
  }

  // Simulate current time after completing existing stops
  let currentTime = startTime;

  for (const idx of currentOrder) {
    if (idx < 0 || idx >= tickets.length) continue;

    const ticket = tickets[idx];
    if (!ticket) continue;

    // If this ticket has an appointment, wait until appointment time
    const apptStart = ticket.appointment?.time_start;
    if (apptStart && compareTime(currentTime, apptStart) < 0) {
      currentTime = apptStart;
    }
    const workMinutes = ticket.work_duration_minutes || 0;
    currentTime = addMinutesToTime(currentTime, workMinutes + 30); // +30 min travel estimate
  }

  // Estimate time to complete flexible ticket
  const flexTicket = tickets[flexibleIdx];
  if (!flexTicket) return false;

  const flexWorkMinutes = flexTicket.work_duration_minutes || 0;
  const completionTime = addMinutesToTime(currentTime, flexWorkMinutes + 30); // +30 travel

  // Check if we can complete before appointment and travel to it
  return compareTime(completionTime, appointmentTime) <= 0;
}

/**
 * Calculate legs for a new order using haversine estimates
 */
function calculateLegsForOrder(
  tickets: TicketWaypoint[],
  newOrder: number[],
  originalLegs: Array<{ distanceMeters: number; durationMinutes: number }>,
  originalOrder: number[]
): Array<{ distanceMeters: number; durationMinutes: number }> {
  // Safety check
  if (!tickets || !newOrder || newOrder.length === 0) {
    return [];
  }

  return newOrder.map((idx, i) => {
    // Default leg
    const defaultLeg = { distanceMeters: 20000, durationMinutes: 30 };

    // Safety check for index bounds
    if (idx < 0 || idx >= tickets.length) {
      return defaultLeg;
    }

    // First leg: use original if same ticket, otherwise estimate
    if (i === 0) {
      const origPos = originalOrder?.indexOf(idx) ?? -1;
      if (origPos === 0 && originalLegs?.[0]) {
        return originalLegs[0];
      }
      // Estimate from origin (we don't have origin coords here, use 30 min default)
      return defaultLeg;
    }

    const prevIdx = newOrder[i - 1];

    // Safety check for previous index
    if (prevIdx < 0 || prevIdx >= tickets.length) {
      return defaultLeg;
    }

    const prevTicket = tickets[prevIdx];
    const currTicket = tickets[idx];

    // Safety check for ticket existence
    if (!prevTicket || !currTicket) {
      return defaultLeg;
    }

    const distKm = haversineDistance(
      prevTicket.latitude, prevTicket.longitude,
      currTicket.latitude, currTicket.longitude
    ) * 1.3; // Road factor

    return {
      distanceMeters: Math.round(distKm * 1000),
      durationMinutes: Math.round(distKm / 40 * 60), // 40 km/h avg
    };
  });
}

interface BuildStopsResult {
  stops: OptimizedStop[];
  totalTravelMinutes: number;
  totalWorkMinutes: number;
  totalWaitMinutes: number;
  overtimeStops: number;
  endTime: string;
  lunchInfo: LunchBreakInfo | null;
  totalDistanceMeters: number;
}

/**
 * Build optimized stops array from tickets and optimization result
 * Enhanced version with detailed time calculation, lunch break handling,
 * and return-to-garage stop
 */
function buildOptimizedStops(
  tickets: TicketWaypoint[],
  optimizationResult: { optimizedOrder: number[]; legs: Array<{ distanceMeters: number; durationMinutes: number }> },
  startTime: string,
  allowOvertime: boolean,
  garage: GarageInfo,
  lunchConfig: BreakConfig = DEFAULT_LUNCH_CONFIG
): BuildStopsResult {
  const stops: OptimizedStop[] = [];
  let currentTime = startTime;
  let totalTravelMinutes = 0;
  let totalWorkMinutes = 0;
  let totalWaitMinutes = 0;
  let totalDistanceMeters = 0;
  let overtimeStops = 0;
  let lunchTaken = false;
  let lunchInfo: LunchBreakInfo | null = null;

  for (let i = 0; i < optimizationResult.optimizedOrder.length; i++) {
    const originalIndex = optimizationResult.optimizedOrder[i];
    const ticket = tickets[originalIndex];
    const leg = optimizationResult.legs[i];
    const travelMinutes = leg?.durationMinutes || 0;
    const workMinutes = ticket.work_duration_minutes || 0;
    const distanceMeters = leg?.distanceMeters || 0;

    // Build appointment window from ticket data (if available)
    const appointmentWindow = ticket.appointment.time_start && ticket.appointment.time_end
      ? { start: ticket.appointment.time_start, end: ticket.appointment.time_end }
      : null;

    // Calculate timing with enhanced algorithm
    const timing = calculateStopTiming(
      currentTime,
      travelMinutes,
      workMinutes,
      appointmentWindow,
      lunchConfig,
      lunchTaken
    );

    // Track lunch if taken at this stop
    if (timing.lunchTaken && !lunchTaken) {
      lunchTaken = true;
      if (timing.lunchStart && timing.lunchEnd) {
        lunchInfo = {
          start: timing.lunchStart,
          end: timing.lunchEnd,
          duration: lunchConfig.duration,
        };
      }
    }

    // Calculate wait time (time between arrival and work start)
    const waitMinutes = getMinutesBetween(timing.arrivalTime, timing.workStart);

    // Determine appointment status
    let appointmentStatus: 'on_time' | 'early_wait' | 'late' | 'no_window' = 'no_window';
    if (appointmentWindow) {
      const rawArrival = addMinutesToTime(currentTime, travelMinutes);
      if (compareTime(rawArrival, appointmentWindow.start) < 0) {
        appointmentStatus = 'early_wait';
      } else if (compareTime(rawArrival, appointmentWindow.end) <= 0) {
        appointmentStatus = 'on_time';
      } else {
        appointmentStatus = 'late';
      }
    }

    // Check if this stop is overtime (departure after 17:30)
    const isOvertime = compareTime(timing.departureTime, WORK_END_TIME) > 0;
    if (isOvertime) {
      overtimeStops++;
    }

    // Build lunch break info for this stop (if lunch taken during this stop)
    const stopLunchBreak: LunchBreakInfo | undefined = timing.lunchStart && timing.lunchEnd
      ? { start: timing.lunchStart, end: timing.lunchEnd, duration: lunchConfig.duration }
      : undefined;

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
      estimated_arrival: timing.arrivalTime,
      work_start: timing.workStart,
      work_end: timing.workEnd,
      estimated_departure: timing.departureTime,
      travel_time_minutes: travelMinutes,
      work_duration_minutes: workMinutes,
      wait_time_minutes: waitMinutes,
      distance_meters: distanceMeters,
      is_overtime: isOvertime,
      lunch_break: stopLunchBreak,
      appointment_status: appointmentStatus,
    });

    // Update for next iteration
    currentTime = timing.departureTime;
    totalTravelMinutes += travelMinutes;
    totalWorkMinutes += workMinutes;
    totalWaitMinutes += waitMinutes;
    totalDistanceMeters += distanceMeters;
  }

  // Return-to-garage stop (commented out for now)
  // if (stops.length > 0) {
  //   const lastStop = stops[stops.length - 1];
  //
  //   // Estimate return travel (use haversine * 1.3 for road distance, 40 km/h avg speed)
  //   const returnDistanceKm = haversineDistance(
  //     lastStop.latitude, lastStop.longitude,
  //     garage.latitude, garage.longitude
  //   ) * 1.3; // Road distance factor
  //   const returnDistanceMeters = Math.round(returnDistanceKm * 1000);
  //   const returnTravelMinutes = Math.round(returnDistanceKm / 40 * 60); // 40 km/h average
  //
  //   const returnArrival = addMinutesToTime(currentTime, returnTravelMinutes);
  //   const isReturnOvertime = compareTime(returnArrival, WORK_END_TIME) > 0;
  //
  //   stops.push({
  //     order: stops.length + 1,
  //     ticket_id: '',
  //     ticket_code: null,
  //     site_name: `กลับโรงรถ (${garage.name})`,
  //     latitude: garage.latitude,
  //     longitude: garage.longitude,
  //     address: null,
  //     appointment: { date: '', time_start: null, time_end: null, type: null },
  //     work_type: null,
  //     estimated_arrival: returnArrival,
  //     work_start: null,
  //     work_end: null,
  //     estimated_departure: returnArrival,
  //     travel_time_minutes: returnTravelMinutes,
  //     work_duration_minutes: 0,
  //     wait_time_minutes: 0,
  //     distance_meters: returnDistanceMeters,
  //     is_overtime: isReturnOvertime,
  //     appointment_status: 'no_window',
  //     is_return: true,
  //   });
  //
  //   totalTravelMinutes += returnTravelMinutes;
  //   totalDistanceMeters += returnDistanceMeters;
  //   if (isReturnOvertime) {
  //     overtimeStops++;
  //   }
  //   currentTime = returnArrival;
  // }

  const endTime = stops.length > 0
    ? stops[stops.length - 1].estimated_departure || startTime
    : startTime;

  return {
    stops,
    totalTravelMinutes,
    totalWorkMinutes,
    totalWaitMinutes,
    overtimeStops,
    endTime,
    lunchInfo,
    totalDistanceMeters,
  };
}

/**
 * Add minutes to a time string
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * Compare two time strings
 * Returns: negative if time1 < time2, 0 if equal, positive if time1 > time2
 */
function compareTime(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h1 * 60 + m1) - (h2 * 60 + m2);
}

/**
 * Get minutes between two times
 */
function getMinutesBetween(time1: string, time2: string): number {
  return Math.max(0, compareTime(time2, time1));
}

/**
 * Check if a time is within a time window
 */
function isWithinWindow(time: string, window: TimeWindow): boolean {
  return compareTime(time, window.start) >= 0 && compareTime(time, window.end) < 0;
}

/**
 * Calculate stop timing with lunch break and appointment window handling
 * Uses MILP interval intersection approach for optimal break placement
 */
function calculateStopTiming(
  previousDeparture: string,
  travelMinutes: number,
  workMinutes: number,
  appointmentWindow: TimeWindow | null,
  lunchConfig: BreakConfig,
  lunchAlreadyTaken: boolean
): StopTiming {
  const LUNCH_START = lunchConfig.minStart;
  const LUNCH_END = addMinutesToTime(lunchConfig.minStart, lunchConfig.duration);

  // 1. Calculate raw arrival after travel
  let arrivalTime = addMinutesToTime(previousDeparture, travelMinutes);

  // 2. Handle appointment time window (if specified)
  if (appointmentWindow) {
    if (compareTime(arrivalTime, appointmentWindow.start) < 0) {
      // Early arrival - wait for appointment window to open
      arrivalTime = appointmentWindow.start;
    }
    if (compareTime(arrivalTime, appointmentWindow.end) > 0) {
      // Late arrival - infeasible schedule
      return {
        arrivalTime,
        workStart: arrivalTime,
        workEnd: addMinutesToTime(arrivalTime, workMinutes),
        departureTime: addMinutesToTime(arrivalTime, workMinutes),
        lunchTaken: lunchAlreadyTaken,
        feasible: false,
        appointmentViolation: 'arrive_too_late',
      };
    }
  }

  // 3. Determine work timing with lunch break logic
  let workStart = arrivalTime;
  let lunchTaken = lunchAlreadyTaken;
  let lunchStart: string | undefined;
  let lunchEnd: string | undefined;

  if (!lunchTaken) {
    // Case A: Arrival during lunch (12:00-13:00) → wait until lunch ends
    if (compareTime(arrivalTime, LUNCH_START) >= 0 && compareTime(arrivalTime, LUNCH_END) < 0) {
      workStart = LUNCH_END;
      lunchStart = LUNCH_START;
      lunchEnd = LUNCH_END;
      lunchTaken = true;
    }
    // Case B: Before lunch - check if work spans lunch
    else if (compareTime(arrivalTime, LUNCH_START) < 0) {
      const workEndIfNoLunch = addMinutesToTime(arrivalTime, workMinutes);

      if (compareTime(workEndIfNoLunch, LUNCH_START) > 0) {
        // Work would span lunch - SPLIT across lunch
        const minutesBeforeLunch = getMinutesBetween(arrivalTime, LUNCH_START);

        if (minutesBeforeLunch >= 15 && workMinutes > minutesBeforeLunch) {
          // Enough time to do partial work before lunch (at least 15 min)
          // Work: arrivalTime → 12:00, Lunch: 12:00-13:00, Work: 13:00 → remaining
          const remainingWork = workMinutes - minutesBeforeLunch;
          lunchStart = LUNCH_START;
          lunchEnd = LUNCH_END;
          const workEnd = addMinutesToTime(LUNCH_END, remainingWork);
          lunchTaken = true;

          return {
            arrivalTime,
            workStart: arrivalTime,
            workEnd,
            departureTime: workEnd,
            lunchTaken: true,
            lunchStart,
            lunchEnd,
            feasible: true,
          };
        } else if (minutesBeforeLunch < 15) {
          // Not enough time before lunch (<15 min) - take lunch first, then work
          workStart = LUNCH_END;
          lunchStart = LUNCH_START;
          lunchEnd = LUNCH_END;
          lunchTaken = true;
        }
        // If workMinutes <= minutesBeforeLunch, work finishes before lunch - no split needed
      }
    }
    // Case C: After lunch window - mark lunch as "taken" (passed)
    else if (compareTime(arrivalTime, LUNCH_END) >= 0) {
      lunchTaken = true;
    }
  }

  // 4. Calculate final work end and departure
  const workEnd = addMinutesToTime(workStart, workMinutes);
  const departureTime = workEnd;

  // 5. Validate appointment window for departure (if specified)
  if (appointmentWindow && compareTime(departureTime, appointmentWindow.end) > 0) {
    return {
      arrivalTime,
      workStart,
      workEnd,
      departureTime,
      lunchTaken,
      lunchStart,
      lunchEnd,
      feasible: false,
      appointmentViolation: 'work_exceeds_window',
    };
  }

  return {
    arrivalTime,
    workStart,
    workEnd,
    departureTime,
    lunchTaken,
    lunchStart,
    lunchEnd,
    feasible: true,
  };
}
