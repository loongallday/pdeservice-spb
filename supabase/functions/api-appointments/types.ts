/**
 * @fileoverview TypeScript interfaces for api-appointments
 *
 * Database table: main_appointments
 * Relationship: main_tickets.appointment_id -> main_appointments.id
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Appointment type options for scheduling
 * - full_day: Available all day
 * - time_range: Specific time window
 * - half_morning: Morning only (AM)
 * - half_afternoon: Afternoon only (PM)
 * - call_to_schedule: Call customer to arrange time
 */
export type AppointmentType =
  | 'full_day'
  | 'time_range'
  | 'half_morning'
  | 'half_afternoon'
  | 'call_to_schedule';

// ============================================================================
// Database Entity
// ============================================================================

/**
 * Appointment entity as stored in main_appointments table
 */
export interface Appointment {
  /** UUID primary key */
  id: string;
  /** Scheduled date (YYYY-MM-DD format) */
  appointment_date: string | null;
  /** Start time (HH:MM:SS format) */
  appointment_time_start: string | null;
  /** End time (HH:MM:SS format) */
  appointment_time_end: string | null;
  /** Type of appointment scheduling */
  appointment_type: AppointmentType;
  /** Whether appointment has been approved by approver */
  is_approved: boolean;
  /** Record creation timestamp */
  created_at: string;
  /** Record last update timestamp */
  updated_at: string;
}

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Request body for creating a new appointment
 * POST /api-appointments
 */
export interface CreateAppointmentInput {
  /** Required: Type of appointment scheduling */
  appointment_type: AppointmentType;
  /** Optional: Scheduled date */
  appointment_date?: string;
  /** Optional: Start time */
  appointment_time_start?: string;
  /** Optional: End time */
  appointment_time_end?: string;
  /** Optional: Ticket ID to link (updates main_tickets.appointment_id) */
  ticket_id?: string;
}

/**
 * Request body for updating an appointment
 * PUT /api-appointments/:id
 */
export interface UpdateAppointmentInput {
  /** Optional: Update scheduled date */
  appointment_date?: string;
  /** Optional: Update start time */
  appointment_time_start?: string;
  /** Optional: Update end time */
  appointment_time_end?: string;
  /** Optional: Update appointment type */
  appointment_type?: AppointmentType;
  /** Optional: Ticket ID to link */
  ticket_id?: string;
}

/**
 * Request body for approving/unapproving an appointment
 * POST /api-appointments/approve
 */
export interface ApproveAppointmentInput {
  /** Required: Appointment ID to approve */
  id: string;
  /** Optional: Set approval status (default: true) */
  is_approved?: boolean;
  /** Optional: Update date while approving */
  appointment_date?: string;
  /** Optional: Update start time while approving */
  appointment_time_start?: string;
  /** Optional: Update end time while approving */
  appointment_time_end?: string;
  /** Optional: Update type while approving */
  appointment_type?: AppointmentType;
}

// ============================================================================
// Query Parameters
// ============================================================================

/**
 * Query parameters for listing appointments
 * GET /api-appointments
 */
export interface ListAppointmentsParams {
  /** Page number (default: 1) */
  page?: number;
  /** Items per page (default: 50) */
  limit?: number;
  /** Filter by ticket ID - finds ticket's linked appointment */
  ticket_id?: string;
}

/**
 * Query parameters for searching appointments
 * GET /api-appointments/search
 */
export interface SearchAppointmentsParams {
  /** Search query text */
  q?: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

/**
 * Single appointment response
 */
export interface AppointmentResponse {
  data: Appointment;
}

/**
 * Paginated list of appointments response
 */
export interface AppointmentListResponse {
  data: Appointment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
