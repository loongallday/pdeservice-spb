/**
 * Ticket display types - Display-ready response interfaces for the enhanced ticket search API
 * 
 * These types represent the transformed data that can be used directly by the frontend
 * without any additional processing or lookup.
 */

/**
 * Location information with pre-resolved names
 */
export interface TicketLocation {
  province_code: number | null;
  province_name: string | null;
  district_code: number | null;
  district_name: string | null;
  subdistrict_code: number | null;
  subdistrict_name: string | null;
  address_detail: string | null;
  /** Pre-formatted display string, e.g., "พระนคร, กทม." */
  display: string;
}

/**
 * Appointment type values
 */
export type AppointmentType = 
  | 'full_day' 
  | 'time_range' 
  | 'half_morning' 
  | 'half_afternoon' 
  | 'call_to_schedule' 
  | 'backlog'
  | 'scheduled';

/**
 * Appointment information with pre-formatted display
 */
export interface TicketAppointment {
  id: string | null;
  date: string | null;  // YYYY-MM-DD format
  time_start: string | null;  // HH:MM format
  time_end: string | null;  // HH:MM format
  type: AppointmentType | null;
  /** Pre-formatted display string, e.g., "09:00 - 12:00" or "เต็มวัน" */
  type_display: string;
  is_approved: boolean | null;
}

/**
 * Employee information for display
 */
export interface TicketEmployee {
  id: string;
  name: string;
  code: string | null;
  is_key: boolean;
  profile_image_url: string | null;
}

/**
 * Merchandise summary for display
 */
export interface TicketMerchandiseSummary {
  id: string;
  serial_no: string;
  model_name: string | null;
}

/**
 * IDs for updates (optional, only included when needed)
 */
export interface TicketIds {
  site_id: string | null;
  status_id: string;
  work_type_id: string;
  assigner_id: string;
  contact_id: string | null;
}

/**
 * Display-ready ticket item from search results
 * 
 * This interface represents a ticket with all data pre-resolved
 * and formatted for direct display in the UI.
 */
export interface TicketDisplayItem {
  // === Core Identity ===
  id: string;

  // === Display Strings (No transformation needed!) ===
  site_name: string | null;
  company_name: string | null;
  work_type_name: string | null;
  work_type_code: string | null;
  status_name: string | null;
  status_code: string | null;
  assigner_name: string | null;
  creator_name: string | null;

  // === Location (Pre-resolved names!) ===
  location: TicketLocation;

  // === Appointment (Flattened with pre-formatted display) ===
  appointment: TicketAppointment;

  // === Employees (Full data, no lookup needed) ===
  employees: TicketEmployee[];
  employee_count: number;

  // === Content ===
  details: string | null;
  additional: string | null;

  // === Merchandise Summary ===
  merchandise: TicketMerchandiseSummary[];
  merchandise_count: number;

  // === Timestamps ===
  created_at: string;
  updated_at: string;

  // === IDs for Updates (Optional, only when include=full) ===
  _ids?: TicketIds;
}

/**
 * Include mode for search results
 * - minimal: Reduced data for table views (excludes _ids, reduces employee details)
 * - full: Complete data for cards/detail views (default)
 */
export type IncludeMode = 'minimal' | 'full';

/**
 * Helper functions for formatting appointment display
 */
export function formatAppointmentTypeDisplay(
  type: AppointmentType | string | null,
  timeStart: string | null,
  timeEnd: string | null
): string {
  if (!type) return '';
  
  switch (type) {
    case 'time_range':
    case 'scheduled':
      if (timeStart && timeEnd) {
        // Format time to HH:MM
        const start = timeStart.substring(0, 5);
        const end = timeEnd.substring(0, 5);
        return `${start} - ${end}`;
      }
      if (timeStart) {
        return timeStart.substring(0, 5);
      }
      return 'มีนัดหมาย';
    case 'full_day':
      return 'เต็มวัน';
    case 'half_morning':
      return 'ครึ่งเช้า';
    case 'half_afternoon':
      return 'ครึ่งบ่าย';
    case 'call_to_schedule':
      return 'รอนัดหมาย';
    case 'backlog':
      return 'Backlog';
    default:
      return type;
  }
}

/**
 * Normalize appointment type to standard enum value
 */
export function normalizeAppointmentType(type: string | null): AppointmentType | null {
  if (!type) return null;
  
  const normalized = type.toLowerCase().replace(/_/g, '_');
  
  switch (normalized) {
    case 'full_day':
    case 'time_range':
    case 'half_morning':
    case 'half_afternoon':
    case 'call_to_schedule':
    case 'backlog':
    case 'scheduled':
      return normalized as AppointmentType;
    default:
      return type as AppointmentType;
  }
}

