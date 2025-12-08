/**
 * Ticket service - Main service class that aggregates all ticket operations
 * 
 * This file re-exports methods from specialized service files:
 * - ticketSearchService.ts: Search operations (search, searchByDuration, getById)
 * - ticketCrudService.ts: CRUD operations (create, update, deleteTicket)
 * - ticketHelperService.ts: Helper methods (findOrCreateCompany, etc.)
 */

import type {
  TicketQueryParams,
  MasterTicketCreateInput,
  MasterTicketUpdateInput,
  DateType,
} from './ticketTypes.ts';

import {
  search as searchTickets,
  searchByDuration as searchTicketsByDuration,
  getById as searchGetById,
} from './ticketSearchService.ts';

import {
  create as crudCreate,
  update as crudUpdate,
  deleteTicket as crudDeleteTicket,
  removeTicketEmployee as crudRemoveTicketEmployee,
} from './ticketCrudService.ts';

import {
  linkMerchandiseToTicket,
} from './ticketHelperService.ts';

// Re-export types
export type {
  TicketQueryParams,
  MasterTicketCreateInput,
  MasterTicketUpdateInput,
  DateType,
};

// Re-export search methods
export {
  searchTickets as search,
  searchTicketsByDuration as searchByDuration,
  searchGetById as getById,
};

// Re-export CRUD methods
export {
  crudCreate as create,
  crudUpdate as update,
  crudDeleteTicket as deleteTicket,
  crudRemoveTicketEmployee as removeTicketEmployee,
};

// Re-export helper methods (for internal use)
export {
  linkMerchandiseToTicket,
};

/**
 * TicketService class - Provides a unified interface for all ticket operations
 * 
 * All methods are static and delegate to the specialized service files.
 * This maintains backward compatibility with existing handlers.
 */
export class TicketService {
  // Fetch operations
  static async getById(id: string) {
    return await searchGetById(id);
  }

  // Search operations
  static async search(params: {
    page: number;
    limit: number;
    id?: string;
    details?: string;
    work_type_id?: string;
    assigner_id?: string;
    status_id?: string;
    additional?: string;
    site_id?: string;
    contact_id?: string;
    work_result_id?: string;
    appointment_id?: string;
    created_at?: string;
    updated_at?: string;
    start_date?: string;
    end_date?: string;
    exclude_backlog?: boolean;
    department_id?: string | string[];
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    return await searchTickets(params);
  }

  static async searchByDuration(params: {
    page: number;
    limit: number;
    startDate: string;
    endDate: string;
    dateType: DateType;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    return await searchTicketsByDuration(params);
  }

  // CRUD operations
  static async create(input: MasterTicketCreateInput, employeeId: string) {
    return await crudCreate(input, employeeId);
  }

  static async update(ticketId: string, input: MasterTicketUpdateInput, employeeId: string) {
    return await crudUpdate(ticketId, input, employeeId);
  }

  static async deleteTicket(ticketId: string, employeeId: string, options?: {
    deleteAppointment?: boolean;
    deleteContact?: boolean;
  }) {
    return await crudDeleteTicket(ticketId, employeeId, options);
  }

  static async removeTicketEmployee(
    ticketId: string,
    employeeId: string,
    date: string,
    changedByEmployeeId: string
  ) {
    return await crudRemoveTicketEmployee(ticketId, employeeId, date, changedByEmployeeId);
  }
}
