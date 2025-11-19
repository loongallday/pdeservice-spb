/**
 * Master Ticket Service - Comprehensive ticket operations with all related data
 * Handles ticket creation/update/delete including:
 * - Company information
 * - Site information
 * - Contact information
 * - Appointment information
 * - Merchandise associations
 * - Employee/technician assignments
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';

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

export class MasterTicketService {
  /**
   * Create a comprehensive ticket with all related data
   */
  static async createMaster(input: MasterTicketCreateInput): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Step 1: Handle Company (find or create)
    let companyId: string | null = null;
    if (input.company) {
      companyId = await this.findOrCreateCompany(input.company);
    }

    // Step 2: Handle Site (find or create)
    let siteId: string | null = null;
    if (input.site) {
      // If site.id provided, use it; otherwise create
      if (input.site.id) {
        siteId = input.site.id;
      } else {
        // Use company_id from company if provided
        const siteData = {
          ...input.site,
          company_id: input.site.company_id || companyId,
        };
        siteId = await this.findOrCreateSite(siteData);
      }
    }

    // Step 3: Handle Contact (find or create)
    let contactId: string | null = null;
    if (input.contact) {
      if (input.contact.id) {
        contactId = input.contact.id;
      } else {
        const contactData = {
          ...input.contact,
          site_id: siteId,
        };
        contactId = await this.findOrCreateContact(contactData);
      }
    }

    // Step 4: Create Ticket
    const ticketData = {
      ...input.ticket,
      site_id: siteId,
      contact_id: contactId,
    };

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();

    if (ticketError) {
      throw new DatabaseError(`ไม่สามารถสร้างตั๋วงานได้: ${ticketError.message}`);
    }
    if (!ticket) {
      throw new DatabaseError('ไม่สามารถสร้างตั๋วงานได้');
    }

    // Step 5: Create Appointment (if provided)
    let appointmentId: string | null = null;
    if (input.appointment) {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          ...input.appointment,
          ticket_id: ticket.id,
        }])
        .select()
        .single();

      if (appointmentError) {
        throw new DatabaseError(`ไม่สามารถสร้างนัดหมายได้: ${appointmentError.message}`);
      }
      if (appointment) {
        appointmentId = appointment.id;

        // Update ticket with appointment_id
        const { error: updateError } = await supabase
          .from('tickets')
          .update({ appointment_id: appointmentId })
          .eq('id', ticket.id);

        if (updateError) {
          console.error('Failed to update ticket appointment_id:', updateError);
        }
      }
    }

    // Step 6: Link Employees (technicians)
    if (input.employee_ids && input.employee_ids.length > 0) {
      const uniqueEmployeeIds = [...new Set(input.employee_ids)];
      const { error: employeeError } = await supabase
        .from('ticket_employees')
        .insert(
          uniqueEmployeeIds.map(employeeId => ({
            ticket_id: ticket.id,
            employee_id: employeeId,
          }))
        );

      if (employeeError) {
        throw new DatabaseError(`ไม่สามารถเชื่อมโยงพนักงานได้: ${employeeError.message}`);
      }
    }

    // Step 7: Link Merchandise
    if (input.merchandise_ids && input.merchandise_ids.length > 0) {
      await this.linkMerchandise(ticket.id, input.merchandise_ids, siteId);
    }

    // Step 8: Fetch and return complete ticket data
    return await this.getCompleteTicket(ticket.id);
  }

  /**
   * Update a comprehensive ticket with all related data
   */
  static async updateMaster(ticketId: string, input: MasterTicketUpdateInput): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Verify ticket exists
    const { data: existingTicket, error: checkError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (checkError || !existingTicket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Step 1: Handle Company (update or create)
    let companyId: string | null = existingTicket.company_id || null;
    if (input.company) {
      companyId = await this.findOrCreateCompany(input.company);
    }

    // Step 2: Handle Site (update or create)
    let siteId: string | null = existingTicket.site_id || null;
    let siteChanged = false;
    
    if ('site' in input) {
      // Field is present in request
      if (input.site === null) {
        // Explicit null - clear the site
        siteId = null;
        siteChanged = true;
      } else if (input.site) {
        // Site data provided
        if (input.site.id) {
          // Update existing site
          const siteData = { ...input.site };
          delete siteData.id;
          if (Object.keys(siteData).length > 0) {
            await this.updateSite(input.site.id, siteData);
          }
          siteId = input.site.id;
        } else {
          // Create new site
          const siteData = {
            ...input.site,
            company_id: input.site.company_id || companyId,
          };
          siteId = await this.findOrCreateSite(siteData);
        }
        siteChanged = siteId !== existingTicket.site_id;
      }
    }

    // Step 3: Handle Contact (update or create)
    let contactId: string | null = existingTicket.contact_id || null;
    let contactChanged = false;
    
    if ('contact' in input) {
      // Field is present in request
      if (input.contact === null) {
        // Explicit null - clear the contact
        contactId = null;
        contactChanged = true;
      } else if (input.contact) {
        // Contact data provided
        if (input.contact.id) {
          // Update existing contact
          const contactData = { ...input.contact };
          delete contactData.id;
          if (Object.keys(contactData).length > 0) {
            await this.updateContact(input.contact.id, contactData);
          }
          contactId = input.contact.id;
        } else {
          // Create new contact
          const contactData = {
            ...input.contact,
            site_id: siteId,
          };
          contactId = await this.findOrCreateContact(contactData);
        }
        contactChanged = contactId !== existingTicket.contact_id;
      }
    }

    // Step 4: Update Ticket
    if (input.ticket || siteChanged || contactChanged) {
      const ticketUpdate = {
        ...(input.ticket || {}),
        site_id: siteId,
        contact_id: contactId,
      };

      const { error: ticketError } = await supabase
        .from('tickets')
        .update(ticketUpdate)
        .eq('id', ticketId);

      if (ticketError) {
        throw new DatabaseError(`ไม่สามารถอัพเดทตั๋วงานได้: ${ticketError.message}`);
      }
    }

    // Step 5: Update Appointment
    if ('appointment' in input) {
      // Field is present in request
      if (input.appointment === null) {
        // Explicit null - clear the appointment (unlink it from ticket)
        if (existingTicket.appointment_id) {
          const { error: unlinkError } = await supabase
            .from('tickets')
            .update({ appointment_id: null })
            .eq('id', ticketId);
          
          if (unlinkError) {
            throw new DatabaseError(`ไม่สามารถยกเลิกการเชื่อมโยงนัดหมายได้: ${unlinkError.message}`);
          }
        }
      } else if (input.appointment) {
        // Appointment data provided
        if (existingTicket.appointment_id) {
          // Update existing appointment
          const { error: appointmentError } = await supabase
            .from('appointments')
            .update(input.appointment)
            .eq('id', existingTicket.appointment_id);

          if (appointmentError) {
            throw new DatabaseError(`ไม่สามารถอัพเดทนัดหมายได้: ${appointmentError.message}`);
          }
        } else {
          // Create new appointment
          const { data: appointment, error: appointmentError } = await supabase
            .from('appointments')
            .insert([{
              ...input.appointment,
              ticket_id: ticketId,
            }])
            .select()
            .single();

          if (appointmentError) {
            throw new DatabaseError(`ไม่สามารถสร้างนัดหมายได้: ${appointmentError.message}`);
          }

          if (appointment) {
            // Update ticket with new appointment_id
            await supabase
              .from('tickets')
              .update({ appointment_id: appointment.id })
              .eq('id', ticketId);
          }
        }
      }
    }

    // Step 6: Update Employee assignments
    if (input.employee_ids !== undefined) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('ticket_employees')
        .delete()
        .eq('ticket_id', ticketId);

      if (deleteError) {
        throw new DatabaseError(`ไม่สามารถลบการเชื่อมโยงพนักงานเดิมได้: ${deleteError.message}`);
      }

      // Insert new assignments
      if (input.employee_ids.length > 0) {
        const uniqueEmployeeIds = [...new Set(input.employee_ids)];
        const { error: employeeError } = await supabase
          .from('ticket_employees')
          .insert(
            uniqueEmployeeIds.map(employeeId => ({
              ticket_id: ticketId,
              employee_id: employeeId,
            }))
          );

        if (employeeError) {
          throw new DatabaseError(`ไม่สามารถเชื่อมโยงพนักงานได้: ${employeeError.message}`);
        }
      }
    }

    // Step 7: Update Merchandise associations
    if (input.merchandise_ids !== undefined) {
      // Delete existing associations
      const { error: deleteError } = await supabase
        .from('ticket_merchandise')
        .delete()
        .eq('ticket_id', ticketId);

      if (deleteError) {
        throw new DatabaseError(`ไม่สามารถลบการเชื่อมโยงอุปกรณ์เดิมได้: ${deleteError.message}`);
      }

      // Insert new associations
      if (input.merchandise_ids.length > 0) {
        await this.linkMerchandise(ticketId, input.merchandise_ids, siteId);
      }
    }

    // Step 8: Fetch and return complete ticket data
    return await this.getCompleteTicket(ticketId);
  }

  /**
   * Delete ticket and optionally clean up related data
   */
  static async deleteMaster(ticketId: string, options?: {
    deleteAppointment?: boolean;
    deleteContact?: boolean;
  }): Promise<void> {
    const supabase = createServiceClient();

    // Verify ticket exists and get related IDs
    const { data: ticket, error: checkError } = await supabase
      .from('tickets')
      .select('id, appointment_id, contact_id')
      .eq('id', ticketId)
      .single();

    if (checkError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Delete appointment if requested
    if (options?.deleteAppointment && ticket.appointment_id) {
      const { error: appointmentError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', ticket.appointment_id);

      if (appointmentError) {
        console.error('Failed to delete appointment:', appointmentError);
        // Don't fail the whole operation
      }
    }

    // Delete ticket (cascade will handle ticket_employees and ticket_merchandise)
    const { error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticketId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบตั๋วงานได้: ${deleteError.message}`);
    }

    // Delete contact if requested and no other tickets use it
    if (options?.deleteContact && ticket.contact_id) {
      const { data: otherTickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('contact_id', ticket.contact_id)
        .limit(1);

      if (!otherTickets || otherTickets.length === 0) {
        await supabase
          .from('contacts')
          .delete()
          .eq('id', ticket.contact_id);
      }
    }
  }

  /**
   * Get complete ticket data with all relationships
   */
  private static async getCompleteTicket(ticketId: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        details,
        work_type_id,
        assigner_id,
        status_id,
        additional,
        created_at,
        updated_at,
        site_id,
        contact_id,
        work_result_id,
        appointment_id,
        work_type:work_types(*),
        assigner:employees!tickets_assigner_id_fkey(*),
        status:ticket_statuses(*),
        site:sites(
          *,
          company:companies(*)
        ),
        contact:contacts(*),
        appointment:appointments!tickets_appointment_id_fkey(*),
        employees:ticket_employees(
          employee:employees(*)
        ),
        merchandise:ticket_merchandise(
          merchandise:merchandise(
            *,
            model:models!merchandise_model_id_fkey(*),
            site:sites!merchandise_site_id_fkey(*)
          )
        )
      `)
      .eq('id', ticketId)
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลตั๋วงานได้: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Transform employees array
    const employees = Array.isArray(data.employees)
      ? data.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean)
      : [];

    // Transform merchandise array
    const merchandise = Array.isArray(data.merchandise)
      ? data.merchandise.map((tm: Record<string, unknown>) => (tm as { merchandise: Record<string, unknown> }).merchandise).filter(Boolean)
      : [];

    return {
      ...data,
      employees,
      merchandise,
    };
  }

  /**
   * Find or create company
   */
  private static async findOrCreateCompany(companyData: Record<string, unknown>): Promise<string> {
    const supabase = createServiceClient();
    const taxId = companyData.tax_id as string;

    if (!taxId) {
      throw new ValidationError('กรุณาระบุเลขประจำตัวผู้เสียภาษี');
    }

    // Check if exists
    const { data: existing } = await supabase
      .from('companies')
      .select('tax_id')
      .eq('tax_id', taxId)
      .single();

    if (existing) {
      // Update if additional data provided
      const updateData = { ...companyData };
      delete updateData.tax_id;
      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('companies')
          .update(updateData)
          .eq('tax_id', taxId);
      }
      return taxId;
    }

    // Create new
    const { error } = await supabase
      .from('companies')
      .insert([companyData]);

    if (error) {
      throw new DatabaseError(`ไม่สามารถสร้างบริษัทได้: ${error.message}`);
    }

    return taxId;
  }

  /**
   * Find or create site
   */
  private static async findOrCreateSite(siteData: Record<string, unknown>): Promise<string> {
    const supabase = createServiceClient();

    // If name and company_id provided, try to find existing
    if (siteData.name && siteData.company_id) {
      const { data: existing } = await supabase
        .from('sites')
        .select('id')
        .eq('name', siteData.name)
        .eq('company_id', siteData.company_id)
        .single();

      if (existing) {
        return existing.id;
      }
    }

    // Create new site
    const { data, error } = await supabase
      .from('sites')
      .insert([siteData])
      .select('id')
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถสร้างสถานที่ได้: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update existing site
   */
  private static async updateSite(siteId: string, siteData: Record<string, unknown>): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('sites')
      .update(siteData)
      .eq('id', siteId);

    if (error) {
      throw new DatabaseError(`ไม่สามารถอัพเดทสถานที่ได้: ${error.message}`);
    }
  }

  /**
   * Find or create contact
   */
  private static async findOrCreateContact(contactData: Record<string, unknown>): Promise<string> {
    const supabase = createServiceClient();

    // If person_name and site_id provided, try to find existing
    if (contactData.person_name && contactData.site_id) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('person_name', contactData.person_name)
        .eq('site_id', contactData.site_id)
        .single();

      if (existing) {
        return existing.id;
      }
    }

    // Create new contact
    const { data, error } = await supabase
      .from('contacts')
      .insert([contactData])
      .select('id')
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถสร้างผู้ติดต่อได้: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update existing contact
   */
  private static async updateContact(contactId: string, contactData: Record<string, unknown>): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('contacts')
      .update(contactData)
      .eq('id', contactId);

    if (error) {
      throw new DatabaseError(`ไม่สามารถอัพเดทผู้ติดต่อได้: ${error.message}`);
    }
  }

  /**
   * Link merchandise to ticket
   */
  private static async linkMerchandise(ticketId: string, merchandiseIds: string[], siteId: string | null): Promise<void> {
    const supabase = createServiceClient();
    const uniqueMerchandiseIds = [...new Set(merchandiseIds)];

    // Validate all merchandise exist and are in the same site
    for (const merchandiseId of uniqueMerchandiseIds) {
      const { data: merchandise, error: merchError } = await supabase
        .from('merchandise')
        .select('id, site_id')
        .eq('id', merchandiseId)
        .single();

      if (merchError) {
        throw new DatabaseError(`ไม่สามารถดึงข้อมูลอุปกรณ์ ${merchandiseId} ได้`);
      }
      if (!merchandise) {
        throw new NotFoundError(`ไม่พบอุปกรณ์ ${merchandiseId}`);
      }

      // Validate site match
      if (siteId && merchandise.site_id && siteId !== merchandise.site_id) {
        throw new ValidationError(`อุปกรณ์ ${merchandiseId} ต้องอยู่ในสถานที่เดียวกับตั๋วงาน`);
      }
    }

    // Insert all associations
    const { error: insertError } = await supabase
      .from('ticket_merchandise')
      .insert(
        uniqueMerchandiseIds.map(merchandiseId => ({
          ticket_id: ticketId,
          merchandise_id: merchandiseId,
        }))
      );

    if (insertError) {
      if (insertError.message.includes('same site')) {
        throw new ValidationError('อุปกรณ์ต้องอยู่ในสถานที่เดียวกับตั๋วงาน');
      }
      throw new DatabaseError(`ไม่สามารถเชื่อมโยงอุปกรณ์ได้: ${insertError.message}`);
    }
  }
}

