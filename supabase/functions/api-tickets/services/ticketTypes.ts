/**
 * Ticket service types and interfaces
 */

export interface TicketQueryParams {
  page: number;
  limit: number;
  status_id?: string;
  work_type_id?: string;
  employee_id?: string;
  site_id?: string;
  start_date?: string;
  end_date?: string;
  exclude_backlog?: boolean; // Exclude tickets with appointment_type = 'backlog'
  only_backlog?: boolean; // Only return tickets with appointment_id = NULL (backlog tickets)
}

export interface MasterTicketCreateInput {
  // Ticket data (required)
  ticket: {
    details?: string;
    work_type_id: string;
    assigner_id: string;
    status_id: string;
    additional?: string;
  };

  // Company data (optional - find or create)
  company?: {
    tax_id: string;
    name_th?: string;
    name_en?: string;
    address_detail?: string;
    // Include other company fields as needed
    [key: string]: unknown;
  };

  // Site data (optional - find or create)
  site?: {
    id?: string; // If provided, use existing site
    name?: string;
    address_detail?: string;
    subdistrict_code?: number;
    postal_code?: number;
    district_code?: number;
    province_code?: number;
    map_url?: string;
    company_id?: string; // Will use company.tax_id if company provided
  };

  // Contact data (optional - find or create)
  contact?: {
    id?: string; // If provided, use existing contact
    person_name?: string;
    nickname?: string;
    phone?: string[];
    email?: string[];
    line_id?: string;
    note?: string;
  };

  // Appointment data (optional)
  appointment?: {
    appointment_date?: string; // DATE format: YYYY-MM-DD
    appointment_time_start?: string; // TIME format: HH:MM:SS
    appointment_time_end?: string; // TIME format: HH:MM:SS
    appointment_type?: 'call_to_schedule' | 'scheduled' | 'backlog';
  };

  // Employee IDs to assign to ticket (technicians)
  employee_ids?: string[];

  // Merchandise IDs to link to ticket
  merchandise_ids?: string[];
}

export interface MasterTicketUpdateInput {
  // Ticket data (optional)
  ticket?: {
    details?: string;
    work_type_id?: string;
    assigner_id?: string;
    status_id?: string;
    additional?: string;
  };

  // Company data (optional - update or create)
  company?: {
    tax_id: string;
    name_th?: string;
    name_en?: string;
    address_detail?: string;
    [key: string]: unknown;
  };

  // Site data (optional - update or create, or null to clear)
  site?: {
    id?: string; // If provided, update existing; otherwise create new
    name?: string;
    address_detail?: string;
    subdistrict_code?: number;
    postal_code?: number;
    district_code?: number;
    province_code?: number;
    map_url?: string;
    company_id?: string;
  } | null;

  // Contact data (optional - update or create, or null to clear)
  contact?: {
    id?: string; // If provided, update existing; otherwise create new
    person_name?: string;
    nickname?: string;
    phone?: string[];
    email?: string[];
    line_id?: string;
    note?: string;
  } | null;

  // Appointment data (optional - update or create, or null to clear/unlink)
  appointment?: {
    appointment_date?: string;
    appointment_time_start?: string;
    appointment_time_end?: string;
    appointment_type?: 'call_to_schedule' | 'scheduled' | 'backlog';
  } | null;

  // Employee IDs to assign (replaces all existing)
  employee_ids?: string[];

  // Merchandise IDs to link (replaces all existing)
  merchandise_ids?: string[];
}

export type DateType = 'create' | 'update' | 'appointed';

