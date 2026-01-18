/**
 * Google Routes API Service
 * Uses the Routes API for route optimization
 * https://developers.google.com/maps/documentation/routes
 */

import type {
  GoogleRoutesResponse,
  LatLng,
  RouteLeg,
  RouteWaypoint,
} from '../types.ts';

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY'); // Reuse same key
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export class RoutesApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RoutesApiError';
    this.code = code;
  }
}

/**
 * Validate API key is configured
 */
function validateApiKey(): void {
  if (!GOOGLE_API_KEY) {
    throw new RoutesApiError('CONFIGURATION_ERROR', 'Google API key is not configured');
  }
}

export interface OptimizedRouteResult {
  optimizedOrder: number[]; // Original waypoint indices in optimized order
  legs: Array<{
    distanceMeters: number;
    durationMinutes: number;
  }>;
  totalDistanceMeters: number;
  totalDurationMinutes: number;
}

// Google Routes API limit: 98 waypoints with coordinates, 25 with Place IDs
// We use coordinates, so max intermediates is 96 (98 - origin - destination)
const MAX_WAYPOINTS_PER_CHUNK = 96;

/**
 * Optimize route using Google Routes API
 * Supports up to 100 waypoints by splitting into chunks
 * @param origin Starting point coordinates
 * @param waypoints Array of waypoint coordinates (will be optimized)
 * @returns Optimized order and route details
 */
export async function optimizeRoute(
  origin: LatLng,
  waypoints: LatLng[]
): Promise<OptimizedRouteResult> {
  validateApiKey();

  // Validate origin
  if (!origin || origin.latitude == null || origin.longitude == null) {
    throw new RoutesApiError('INVALID_ORIGIN', 'Origin coordinates are missing');
  }

  // Filter out any invalid waypoints
  const validWaypoints = waypoints.filter(
    (wp) => wp && wp.latitude != null && wp.longitude != null
  );

  // If no valid waypoints, return empty result
  if (validWaypoints.length === 0) {
    return {
      optimizedOrder: [],
      legs: [],
      totalDistanceMeters: 0,
      totalDurationMinutes: 0,
    };
  }

  // If only one waypoint, no optimization needed
  if (validWaypoints.length === 1) {
    return await computeSingleDestinationRoute(origin, validWaypoints[0]);
  }

  // If within limit, optimize directly
  if (validWaypoints.length <= MAX_WAYPOINTS_PER_CHUNK) {
    return await optimizeRouteChunk(origin, validWaypoints, 0);
  }

  // For larger sets, split into chunks and optimize each
  return await optimizeRouteWithChunking(origin, validWaypoints);
}

/**
 * Optimize route with chunking for large waypoint sets
 */
async function optimizeRouteWithChunking(
  origin: LatLng,
  waypoints: LatLng[]
): Promise<OptimizedRouteResult> {
  const allOptimizedOrder: number[] = [];
  const allLegs: Array<{ distanceMeters: number; durationMinutes: number }> = [];
  let totalDistance = 0;
  let totalDuration = 0;

  // Split into chunks
  const chunks: LatLng[][] = [];
  for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS_PER_CHUNK) {
    chunks.push(waypoints.slice(i, i + MAX_WAYPOINTS_PER_CHUNK));
  }

  let currentOrigin = origin;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const baseIndex = chunkIndex * MAX_WAYPOINTS_PER_CHUNK;

    // Optimize this chunk
    const chunkResult = await optimizeRouteChunk(currentOrigin, chunk, baseIndex);

    // Add results
    allOptimizedOrder.push(...chunkResult.optimizedOrder);
    allLegs.push(...chunkResult.legs);
    totalDistance += chunkResult.totalDistanceMeters;
    totalDuration += chunkResult.totalDurationMinutes;

    // Use last waypoint of this chunk as origin for next chunk
    if (chunkResult.optimizedOrder.length > 0) {
      const lastIndex = chunkResult.optimizedOrder[chunkResult.optimizedOrder.length - 1];
      const nextOrigin = waypoints[lastIndex];
      if (nextOrigin && nextOrigin.latitude != null && nextOrigin.longitude != null) {
        currentOrigin = nextOrigin;
      }
    }
  }

  return {
    optimizedOrder: allOptimizedOrder,
    legs: allLegs,
    totalDistanceMeters: totalDistance,
    totalDurationMinutes: totalDuration,
  };
}

/**
 * Optimize a single chunk of waypoints
 */
async function optimizeRouteChunk(
  origin: LatLng,
  waypoints: LatLng[],
  baseIndex: number
): Promise<OptimizedRouteResult> {
  // For multiple waypoints, use route optimization
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(0, -1);

  const requestBody = {
    origin: {
      location: { latLng: origin },
    },
    destination: {
      location: { latLng: destination },
    },
    intermediates: intermediates.map((wp) => ({
      location: { latLng: wp },
    })),
    travelMode: 'DRIVE',
    optimizeWaypointOrder: true,
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'th',
  };

  const fieldMask = [
    'routes.optimizedIntermediateWaypointIndex',
    'routes.legs.distanceMeters',
    'routes.legs.duration',
    'routes.distanceMeters',
    'routes.duration',
  ].join(',');

  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY!,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Routes API error:', response.status, errorText);
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error) {
        throw new RoutesApiError(
          errorData.error.status || 'API_ERROR',
          errorData.error.message || 'Unknown error'
        );
      }
    } catch (e) {
      if (e instanceof RoutesApiError) throw e;
    }
    throw new RoutesApiError('API_ERROR', `Google Routes API returned ${response.status}`);
  }

  const data: GoogleRoutesResponse = await response.json();

  if (data.error) {
    throw new RoutesApiError(data.error.status, data.error.message);
  }

  if (!data.routes || data.routes.length === 0) {
    throw new RoutesApiError('NO_ROUTE', 'ไม่สามารถคำนวณเส้นทางได้');
  }

  const route = data.routes[0];

  // Parse optimized order and adjust indices by baseIndex
  // Google can return -1 for unreachable waypoints - filter those out
  const intermediateOrder = (route.optimizedIntermediateWaypointIndex || [])
    .filter((i) => i >= 0 && i < intermediates.length);

  // If all intermediates are invalid, fall back to original order
  const validIntermediateOrder = intermediateOrder.length > 0
    ? intermediateOrder
    : intermediates.map((_, idx) => idx);

  const optimizedOrder: number[] = [
    ...validIntermediateOrder.map((i) => i + baseIndex),
    baseIndex + waypoints.length - 1, // destination
  ];

  // Parse legs
  const legs = (route.legs || []).map((leg) => ({
    distanceMeters: leg.distanceMeters || 0,
    durationMinutes: parseDurationToMinutes(leg.duration),
  }));

  const totalDistanceMeters = route.distanceMeters || legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  const totalDurationMinutes = parseDurationToMinutes(route.duration) ||
    legs.reduce((sum, leg) => sum + leg.durationMinutes, 0);

  return {
    optimizedOrder,
    legs,
    totalDistanceMeters,
    totalDurationMinutes,
  };
}

/**
 * Compute route for single destination (no optimization needed)
 */
async function computeSingleDestinationRoute(
  origin: LatLng,
  destination: LatLng
): Promise<OptimizedRouteResult> {
  validateApiKey();

  const requestBody = {
    origin: {
      location: { latLng: origin },
    },
    destination: {
      location: { latLng: destination },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'th',
  };

  const fieldMask = [
    'routes.legs.distanceMeters',
    'routes.legs.duration',
    'routes.distanceMeters',
    'routes.duration',
  ].join(',');

  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY!,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Routes API error:', response.status, errorText);
    throw new RoutesApiError('API_ERROR', `Google Routes API returned ${response.status}`);
  }

  const data: GoogleRoutesResponse = await response.json();

  if (data.error) {
    throw new RoutesApiError(data.error.status, data.error.message);
  }

  if (!data.routes || data.routes.length === 0) {
    throw new RoutesApiError('NO_ROUTE', 'ไม่สามารถคำนวณเส้นทางได้');
  }

  const route = data.routes[0];
  const leg = route.legs?.[0];

  return {
    optimizedOrder: [0],
    legs: [{
      distanceMeters: leg?.distanceMeters || route.distanceMeters || 0,
      durationMinutes: parseDurationToMinutes(leg?.duration || route.duration),
    }],
    totalDistanceMeters: route.distanceMeters || leg?.distanceMeters || 0,
    totalDurationMinutes: parseDurationToMinutes(route.duration || leg?.duration),
  };
}

/**
 * Parse Google duration string (e.g., "1234s") to minutes
 */
function parseDurationToMinutes(duration: string | undefined): number {
  if (!duration) return 0;

  // Duration format is like "1234s" (seconds)
  const match = duration.match(/^(\d+)s$/);
  if (match) {
    return Math.round(parseInt(match[1], 10) / 60);
  }

  return 0;
}

/**
 * Calculate route distances for a specific order (NO optimization)
 * Used for recalculating after user rearranges stops
 *
 * @param origin Starting coordinates (garage)
 * @param waypoints Waypoints in user's specified order
 * @returns Array of legs with distance and duration
 */
export async function calculateRouteDistances(
  origin: LatLng,
  waypoints: LatLng[]
): Promise<Array<{ distanceMeters: number; durationMinutes: number }>> {
  validateApiKey();

  // Filter out any invalid waypoints
  const validWaypoints = waypoints.filter(
    (wp) => wp && wp.latitude != null && wp.longitude != null
  );

  if (validWaypoints.length === 0) {
    return [];
  }

  // Validate origin
  if (!origin || origin.latitude == null || origin.longitude == null) {
    throw new RoutesApiError('INVALID_ORIGIN', 'Origin coordinates are missing');
  }

  // Build the request - no optimization, just get distances for the specified order
  const destination = validWaypoints[validWaypoints.length - 1];
  const intermediates = validWaypoints.slice(0, -1);

  const requestBody: Record<string, unknown> = {
    origin: {
      location: { latLng: origin },
    },
    destination: {
      location: { latLng: destination },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'th',
  };

  // Add intermediates if any
  if (intermediates.length > 0) {
    requestBody.intermediates = intermediates.map((wp) => ({
      location: { latLng: wp },
    }));
    // Important: Do NOT set optimizeWaypointOrder - we want exact order
  }

  const fieldMask = [
    'routes.legs.distanceMeters',
    'routes.legs.duration',
  ].join(',');

  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY!,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Routes API error:', response.status, errorText);
    throw new RoutesApiError('API_ERROR', `Google Routes API returned ${response.status}`);
  }

  const data: GoogleRoutesResponse = await response.json();

  if (data.error) {
    throw new RoutesApiError(data.error.status, data.error.message);
  }

  if (!data.routes || data.routes.length === 0) {
    throw new RoutesApiError('NO_ROUTE', 'ไม่สามารถคำนวณเส้นทางได้');
  }

  const route = data.routes[0];

  // Parse legs - each leg corresponds to one segment of the route
  return (route.legs || []).map((leg) => ({
    distanceMeters: leg.distanceMeters || 0,
    durationMinutes: parseDurationToMinutes(leg.duration),
  }));
}

/**
 * Generate Google Maps directions URL for navigation
 * Round-trip: Origin → Waypoints → Origin (returns to starting garage)
 *
 * @param origin Starting coordinates (garage)
 * @param waypoints Ordered customer waypoints
 * @returns Google Maps URL ending at origin (round-trip)
 */
export function generateGoogleMapsUrl(
  origin: LatLng,
  waypoints: LatLng[]
): string {
  // Filter out any invalid waypoints
  const validWaypoints = waypoints.filter(
    (wp) => wp && wp.latitude != null && wp.longitude != null
  );

  if (validWaypoints.length === 0 || !origin || origin.latitude == null || origin.longitude == null) {
    return '';
  }

  const originStr = `${origin.latitude},${origin.longitude}`;

  // Destination is the origin (round-trip back to garage)
  const destinationStr = originStr;

  // All customer waypoints are intermediates
  const waypointsStr = validWaypoints
    .map((wp) => `${wp.latitude},${wp.longitude}`)
    .join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}&travelmode=driving`;

  if (waypointsStr) {
    url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
  }

  return url;
}
