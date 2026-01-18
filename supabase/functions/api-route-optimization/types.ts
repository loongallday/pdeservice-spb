/**
 * Route Optimization Types
 */

export type BalanceMode = 'geography' | 'workload' | 'balanced';

export interface OptimizeRequest {
  date: string; // Required - YYYY-MM-DD
  garage_id: string; // Required - starting point UUID
  ticket_ids?: string[]; // Optional - if not provided, fetch all tickets for date
  max_per_route?: number; // Optional - max stops per route (default: all in one route)
  allow_overtime?: boolean; // Optional - allow scheduling past 17:30 (default: true)
  start_time?: string; // Optional - work start time (default: "08:00")
  balance_mode?: BalanceMode; // Optional - route balancing mode (default: "balanced")
}

export interface AppointmentInfo {
  date: string;
  time_start: string | null;
  time_end: string | null;
  type: string | null;
}

export interface TicketWaypoint {
  ticket_id: string;
  ticket_code: string | null;
  site_id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  appointment: AppointmentInfo;
  work_type_code: string | null;
  work_type_name: string | null;
  work_duration_minutes: number; // From child_ticket_work_estimates (default 0)
}

export interface LunchBreakInfo {
  start: string;
  end: string;
  duration: number;
}

export interface OptimizedStop {
  order: number;
  ticket_id: string;
  ticket_code: string | null;
  site_name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  appointment: AppointmentInfo;
  work_type: string | null;
  estimated_arrival: string | null;
  work_start: string | null;           // When actual work begins (may differ from arrival)
  work_end: string | null;             // When work completes
  estimated_departure: string | null;
  travel_time_minutes: number;
  work_duration_minutes: number;
  wait_time_minutes: number;           // Time waiting for appointment window or lunch
  distance_meters: number;
  is_overtime: boolean;                // true if departure is after 17:30
  lunch_break?: LunchBreakInfo;        // Present if lunch taken at/before this stop
  appointment_status: 'on_time' | 'early_wait' | 'late' | 'no_window';
  is_return?: boolean;                 // true for final "return to garage" stop
}

export interface StartLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Balance metrics using Coefficient of Variation (CV)
 * CV = (stdDev / mean) × 100%
 * - CV < 15% = excellent balance
 * - CV < 25% = acceptable balance
 */
export interface BalanceMetrics {
  coefficient_of_variation: number;  // CV as percentage
  is_balanced: boolean;              // CV < target threshold
  workloads: number[];               // Workload per route (minutes)
  mean_workload: number;             // Average workload
  standard_deviation: number;        // Std dev of workloads
}

/**
 * Suggested appointment time change for customer
 * AI may suggest changing appointment times to optimize routes
 */
export interface TimeSuggestion {
  ticket_id: string;
  ticket_code: string | null;
  site_name: string;
  current_time: string;       // Current appointment time
  suggested_time: string;     // Suggested new time
  reason: string;             // Reason in Thai
  savings_minutes: number;    // Estimated time saved
}

export interface RouteSummary {
  total_stops: number;
  total_distance_meters: number;
  total_travel_minutes: number;
  total_work_minutes: number;
  total_duration_minutes: number; // travel + work
  start_time: string;
  end_time: string;
  overtime_stops: number; // Count of stops in overtime
  start_location: StartLocation;
  balance?: BalanceMetrics; // Present when multiple routes
}

export interface SingleRoute {
  route_number: number;
  stops: OptimizedStop[];
  distance_meters: number;
  travel_minutes: number;
  work_minutes: number;
  duration_minutes: number; // travel + work
  start_time: string;
  end_time: string;
  overtime_stops: number;
  google_maps_url: string | null;
}

export interface OptimizeResponse {
  routes: SingleRoute[];
  summary: RouteSummary;
  // AI optimization info
  ai_reasoning?: string;              // AI's explanation of the route order
  suggestions?: TimeSuggestion[];     // Suggested appointment time changes
  // Legacy fields for backward compatibility (first route)
  optimized_route: OptimizedStop[];
  google_maps_url: string | null;
}

// Google Routes API types
export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteWaypoint {
  location: {
    latLng: LatLng;
  };
}

export interface RouteLeg {
  distanceMeters: number;
  duration: string; // e.g., "1234s"
  startLocation?: {
    latLng: LatLng;
  };
  endLocation?: {
    latLng: LatLng;
  };
}

export interface GoogleRoutesResponse {
  routes?: Array<{
    optimizedIntermediateWaypointIndex?: number[];
    legs?: RouteLeg[];
    distanceMeters?: number;
    duration?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
