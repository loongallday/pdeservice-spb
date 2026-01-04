/**
 * Ticket CRUD service - Business logic for creating, updating, and deleting tickets
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import type { MasterTicketCreateInput, MasterTicketUpdateInput } from './ticketTypes.ts';
import { linkMerchandiseToTicket, logTicketAudit } from './ticketHelperService.ts';
import { getById } from './ticketSearchService.ts';

/**
 * Normalize employee_ids to array of objects with id and is_key
 * Supports both old format (string[]) and new format (Array<{id: string, is_key?: boolean}>)
 */
function normalizeEmployeeIds(
  employeeIds: string[] | Array<{ id: string; is_key?: boolean }> | undefined
): Array<{ id: string; is_key: boolean }> {
  if (!employeeIds || employeeIds.length === 0) {
    return [];
  }

  // Check if it's the old format (string array)
  if (typeof employeeIds[0] === 'string') {
    return (employeeIds as string[]).map(id => ({ id, is_key: false }));
  }

  // New format (array of objects)
  return (employeeIds as Array<{ id: string; is_key?: boolean }>).map(emp => ({
    id: emp.id,
    is_key: emp.is_key ?? false,
  }));
}

/**
 * Create a comprehensive ticket with all related data
 */
export async function create(input: MasterTicketCreateInput, employeeId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  // Step 1: Handle Company
  let companyId: string | null = null;
  let companyCreated = false;
  if (input.company) {
    const taxId = input.company.tax_id as string;
    if (!taxId) {
      throw new ValidationError('กรุณาระบุเลขประจำตัวผู้เสียภาษี');
    }

    // Check if company exists
    const { data: existingCompany } = await supabase
      .from('main_companies')
      .select('tax_id')
      .eq('tax_id', taxId)
      .single();

    if (existingCompany) {
      // Company exists, use it
      companyId = taxId;
    } else {
      // Create new company
      const { error: companyError } = await supabase
        .from('main_companies')
        .insert([input.company]);

      if (companyError) {
        throw new DatabaseError(`ไม่สามารถสร้างบริษัทได้: ${companyError.message}`);
      }
      companyId = taxId;
      companyCreated = true;
    }
  }

  // Step 2: Handle Site
  let siteId: string | null = null;
  if (input.site) {
    if (input.site.id) {
      // Use existing site - validate it exists
      const { data: existingSite } = await supabase
        .from('main_sites')
        .select('id')
        .eq('id', input.site.id)
        .single();

      if (!existingSite) {
        throw new NotFoundError('ไม่พบสถานที่');
      }
      siteId = input.site.id;
    } else {
      // Create new site
      const siteData = {
        ...input.site,
        company_id: input.site.company_id || companyId,
      };
      const { data: newSite, error: siteError } = await supabase
        .from('main_sites')
        .insert([siteData])
        .select('id')
        .single();

      if (siteError) {
        throw new DatabaseError(`ไม่สามารถสร้างสถานที่ได้: ${siteError.message}`);
      }
      siteId = newSite.id;
    }
  }

  // Step 3: Handle Contact
  let contactId: string | null = null;
  if (input.contact) {
    if (input.contact.id) {
      // Use existing contact - validate it exists
      const { data: existingContact } = await supabase
        .from('child_site_contacts')
        .select('id')
        .eq('id', input.contact.id)
        .single();

      if (!existingContact) {
        throw new NotFoundError('ไม่พบผู้ติดต่อ');
      }
      contactId = input.contact.id;
    } else {
      // Create new contact
      const contactData = {
        ...input.contact,
        site_id: siteId,
      };
      const { data: newContact, error: contactError } = await supabase
        .from('child_site_contacts')
        .insert([contactData])
        .select('id')
        .single();

      if (contactError) {
        throw new DatabaseError(`ไม่สามารถสร้างผู้ติดต่อได้: ${contactError.message}`);
      }
      contactId = newContact.id;
    }
  }

  // Step 4: Create Ticket
  const ticketData = {
    ...input.ticket,
    site_id: siteId,
    contact_id: contactId,
    created_by: employeeId,
  };

  const { data: ticket, error: ticketError } = await supabase
    .from('main_tickets')
    .insert([ticketData])
    .select()
    .single();

  if (ticketError) {
    throw new DatabaseError(`ไม่สามารถสร้างตั๋วงานได้: ${ticketError.message}`);
  }
  if (!ticket) {
    throw new DatabaseError('ไม่สามารถสร้างตั๋วงานได้');
  }

  // Step 5: Create Appointment (always create, even if empty)
  let appointmentId: string | null = null;
  const appointmentData = input.appointment || {};
  
  // Note: appointments table no longer has ticket_id column
  // The relationship is now only via tickets.appointment_id
  const { data: appointment, error: appointmentError } = await supabase
    .from('main_appointments')
    .insert([appointmentData])
    .select()
    .single();

  if (appointmentError) {
    throw new DatabaseError(`ไม่สามารถสร้างนัดหมายได้: ${appointmentError.message}`);
  }
  if (appointment) {
    appointmentId = appointment.id;

    // Update ticket with appointment_id
    const { error: updateError } = await supabase
      .from('main_tickets')
      .update({ appointment_id: appointmentId })
      .eq('id', ticket.id);

    if (updateError) {
      throw new DatabaseError(`ไม่สามารถอัพเดท appointment_id ในตั๋วงานได้: ${updateError.message}`);
    }
  }

  // Step 6: Link Employees (technicians)
  if (input.employee_ids && input.employee_ids.length > 0) {
    // Normalize employee_ids to support both old and new formats
    const normalizedEmployees = normalizeEmployeeIds(input.employee_ids);
    
    // Remove duplicates by employee ID (keep first occurrence)
    const uniqueEmployees = normalizedEmployees.filter((emp, index, self) =>
      index === self.findIndex(e => e.id === emp.id)
    );

    // Determine the date for assignment (use appointment_date if available, otherwise current date)
    const appointmentDate = appointmentData.appointment_date as string | null | undefined;
    const assignmentDate = appointmentDate || new Date().toISOString().split('T')[0];

    const { error: employeeError } = await supabase
      .from('jct_ticket_employees')
      .insert(
        uniqueEmployees.map(emp => ({
          ticket_id: ticket.id,
          employee_id: emp.id,
          date: assignmentDate,
          is_key_employee: emp.is_key,
        }))
      );

    if (employeeError) {
      if (employeeError.message.includes('unique') || employeeError.message.includes('duplicate')) {
        throw new ValidationError('พนักงานนี้ถูกมอบหมายให้ตั๋วงานนี้ในวันที่นี้แล้ว');
      }
      throw new DatabaseError(`ไม่สามารถเชื่อมโยงพนักงานได้: ${employeeError.message}`);
    }
  }

  // Step 7: Link Merchandise
  if (input.merchandise_ids && input.merchandise_ids.length > 0) {
    await linkMerchandiseToTicket(ticket.id, input.merchandise_ids, siteId);
  }

  // Step 8: Log audit entry for ticket creation
  await logTicketAudit({
    ticketId: ticket.id,
    action: 'created',
    changedBy: employeeId,
    newValues: {
      ...ticketData,
      appointment_id: appointmentId,
      employee_ids: input.employee_ids || [],
      merchandise_ids: input.merchandise_ids || [],
    },
    metadata: {
      company_created: companyCreated,
      site_created: input.site && !input.site.id ? true : false,
      contact_created: input.contact && !input.contact.id ? true : false,
      appointment_created: !!appointmentId,
    },
  });

  // Step 9: Fetch and return complete ticket data
  return await getById(ticket.id);
}

/**
 * Update a comprehensive ticket with all related data
 */
export async function update(ticketId: string, input: MasterTicketUpdateInput, employeeId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  // Verify ticket exists
  const { data: existingTicket, error: checkError } = await supabase
    .from('main_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (checkError || !existingTicket) {
    throw new NotFoundError('ไม่พบตั๋วงาน');
  }

  // Step 1: Handle Company
  let companyId: string | null = existingTicket.company_id || null;
  if (input.company) {
    const taxId = input.company.tax_id as string;
    if (!taxId) {
      throw new ValidationError('กรุณาระบุเลขประจำตัวผู้เสียภาษี');
    }

    // Check if company exists
    const { data: existingCompany } = await supabase
      .from('main_companies')
      .select('tax_id')
      .eq('tax_id', taxId)
      .single();

    if (existingCompany) {
      // Company exists, use it
      companyId = taxId;
    } else {
      // Create new company
      const { error: companyError } = await supabase
        .from('main_companies')
        .insert([input.company]);

      if (companyError) {
        throw new DatabaseError(`ไม่สามารถสร้างบริษัทได้: ${companyError.message}`);
      }
      companyId = taxId;
    }
  }

  // Step 2: Handle Site
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
        // Use existing site - validate it exists
        const { data: existingSite } = await supabase
          .from('main_sites')
          .select('id')
          .eq('id', input.site.id)
          .single();

        if (!existingSite) {
          throw new NotFoundError('ไม่พบสถานที่');
        }

        // Use the existing site (no updates allowed)
        siteId = input.site.id;
      } else {
        // Create new site
        const siteData = {
          ...input.site,
          company_id: input.site.company_id || companyId,
        };
        const { data: newSite, error: siteError } = await supabase
          .from('main_sites')
          .insert([siteData])
          .select('id')
          .single();

        if (siteError) {
          throw new DatabaseError(`ไม่สามารถสร้างสถานที่ได้: ${siteError.message}`);
        }
        siteId = newSite.id;
      }
      siteChanged = siteId !== existingTicket.site_id;
    }
  }

    // Step 3: Handle Contact
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
          // Use existing contact - validate it exists
          const { data: existingContact } = await supabase
            .from('child_site_contacts')
            .select('id')
            .eq('id', input.contact.id)
            .single();

          if (!existingContact) {
            throw new NotFoundError('ไม่พบผู้ติดต่อ');
          }

          // Use the existing contact (no updates allowed)
          contactId = input.contact.id;
        } else {
          // Create new contact
          const contactData = {
            ...input.contact,
            site_id: siteId,
          };
          const { data: newContact, error: contactError } = await supabase
            .from('child_site_contacts')
            .insert([contactData])
            .select('id')
            .single();

          if (contactError) {
            throw new DatabaseError(`ไม่สามารถสร้างผู้ติดต่อได้: ${contactError.message}`);
          }
          contactId = newContact.id;
        }
        contactChanged = contactId !== existingTicket.contact_id;
      }
    }

  // Step 4: Update Ticket
  if (input.ticket || siteChanged || contactChanged) {
    // Remove created_by if somehow included (should not be updatable)
    const { created_by: _created_by, ...ticketData } = (input.ticket || {}) as Record<string, unknown>;
    const ticketUpdate = {
      ...ticketData,
      site_id: siteId,
      contact_id: contactId,
    };

    const { error: ticketError } = await supabase
      .from('main_tickets')
      .update(ticketUpdate)
      .eq('id', ticketId);

    if (ticketError) {
      throw new DatabaseError(`ไม่สามารถอัพเดทตั๋วงานได้: ${ticketError.message}`);
    }
  }

  // Step 5: Update Appointment
  let oldAppointmentData: Record<string, unknown> | null = null;
  if ('appointment' in input) {
    // Get old appointment data before updating (for audit log)
    if (existingTicket.appointment_id) {
      const { data: oldAppointment } = await supabase
        .from('main_appointments')
        .select('*')
        .eq('id', existingTicket.appointment_id)
        .single();
      
      if (oldAppointment) {
        oldAppointmentData = oldAppointment;
      }
    }

    // Field is present in request
    if (input.appointment === null) {
      // Explicit null - clear the appointment (unlink it from ticket)
      if (existingTicket.appointment_id) {
        const { error: unlinkError } = await supabase
          .from('main_tickets')
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
          .from('main_appointments')
          .update(input.appointment)
          .eq('id', existingTicket.appointment_id);

        if (appointmentError) {
          throw new DatabaseError(`ไม่สามารถอัพเดทนัดหมายได้: ${appointmentError.message}`);
        }
      } else {
        // Create new appointment
        // Note: appointments table no longer has ticket_id column
        const { data: appointment, error: appointmentError } = await supabase
          .from('main_appointments')
          .insert([input.appointment])
          .select()
          .single();

        if (appointmentError) {
          throw new DatabaseError(`ไม่สามารถสร้างนัดหมายได้: ${appointmentError.message}`);
        }

        if (appointment) {
          // Update ticket with new appointment_id
          // This will trigger sync_ticket_denorm_on_change to populate appointment_* fields
          await supabase
            .from('main_tickets')
            .update({ appointment_id: appointment.id })
            .eq('id', ticketId);
        }
      }
    }
  }

  // Step 6: Update Employee assignments
  let oldEmployeeIds: string[] = [];
  if (input.employee_ids !== undefined) {
    // Get current employee IDs before deletion (for audit log)
    const { data: currentEmployees } = await supabase
      .from('jct_ticket_employees')
      .select('employee_id')
      .eq('ticket_id', ticketId);
    
    oldEmployeeIds = (currentEmployees || []).map(e => e.employee_id as string);

    // Get appointment date for assignment (either from input or existing)
    let appointmentDate: string | null | undefined = null;

    if ('appointment' in input && input.appointment !== null && input.appointment) {
      // New appointment data provided
      appointmentDate = input.appointment.appointment_date;
    } else if (existingTicket.appointment_id) {
      // Use existing appointment
      const { data: existingAppointment } = await supabase
        .from('main_appointments')
        .select('appointment_date')
        .eq('id', existingTicket.appointment_id)
        .single();

      if (existingAppointment) {
        appointmentDate = existingAppointment.appointment_date as string | null;
      }
    }

    // Delete existing assignments
    const { error: deleteError } = await supabase
      .from('jct_ticket_employees')
      .delete()
      .eq('ticket_id', ticketId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบการเชื่อมโยงพนักงานเดิมได้: ${deleteError.message}`);
    }

    // Insert new assignments
    if (input.employee_ids.length > 0) {
      // Normalize employee_ids to support both old and new formats
      const normalizedEmployees = normalizeEmployeeIds(input.employee_ids);
      
      // Remove duplicates by employee ID (keep first occurrence)
      const uniqueEmployees = normalizedEmployees.filter((emp, index, self) =>
        index === self.findIndex(e => e.id === emp.id)
      );
      
      // Determine the date for assignment (use appointment_date if available, otherwise current date)
      const assignmentDate = appointmentDate || new Date().toISOString().split('T')[0];
      
      const { error: employeeError } = await supabase
        .from('jct_ticket_employees')
        .insert(
          uniqueEmployees.map(emp => ({
            ticket_id: ticketId,
            employee_id: emp.id,
            date: assignmentDate,
            is_key_employee: emp.is_key,
          }))
        );

      if (employeeError) {
        if (employeeError.message.includes('unique') || employeeError.message.includes('duplicate')) {
          throw new ValidationError('พนักงานนี้ถูกมอบหมายให้ตั๋วงานนี้ในวันที่นี้แล้ว');
        }
        throw new DatabaseError(`ไม่สามารถเชื่อมโยงพนักงานได้: ${employeeError.message}`);
      }
    }
  }

  // Step 7: Update Merchandise associations
  let oldMerchandiseIds: string[] = [];
  let newMerchandiseIds: string[] = [];
  if (input.merchandise_ids !== undefined) {
    // Get current merchandise IDs
    const { data: currentMerchandise } = await supabase
      .from('jct_ticket_merchandise')
      .select('merchandise_id')
      .eq('ticket_id', ticketId);
    
    oldMerchandiseIds = (currentMerchandise || []).map(m => m.merchandise_id as string);
    newMerchandiseIds = input.merchandise_ids || [];

    // Delete existing associations
    const { error: deleteError } = await supabase
      .from('jct_ticket_merchandise')
      .delete()
      .eq('ticket_id', ticketId);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบการเชื่อมโยงอุปกรณ์เดิมได้: ${deleteError.message}`);
    }

    // Insert new associations
    if (input.merchandise_ids.length > 0) {
      await linkMerchandiseToTicket(ticketId, input.merchandise_ids, siteId);
    }
  }

  // Step 8: Get updated ticket data and prepare audit log
  const updatedTicket = await getById(ticketId);
  
  // Prepare old and new values for audit
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const changedFields: string[] = [];

  // Compare ticket fields
  if (input.ticket || siteChanged || contactChanged) {
    const ticketUpdate = {
      ...(input.ticket || {}),
      site_id: siteId,
      contact_id: contactId,
    };
    
    for (const [key, newValue] of Object.entries(ticketUpdate)) {
      const oldValue = existingTicket[key];
      if (oldValue !== newValue) {
        oldValues[key] = oldValue;
        newValues[key] = newValue;
        changedFields.push(key);
      }
    }
  }

  // Track employee_ids changes
  if (input.employee_ids !== undefined) {
    const newEmployeeIds = (input.employee_ids || []).sort();
    const sortedOldEmployeeIds = oldEmployeeIds.sort();
    
    if (JSON.stringify(sortedOldEmployeeIds) !== JSON.stringify(newEmployeeIds)) {
      oldValues.employee_ids = sortedOldEmployeeIds;
      newValues.employee_ids = newEmployeeIds;
      changedFields.push('employee_ids');
    }
  }

  // Track merchandise_ids changes
  if (input.merchandise_ids !== undefined) {
    if (JSON.stringify(oldMerchandiseIds.sort()) !== JSON.stringify(newMerchandiseIds.sort())) {
      oldValues.merchandise_ids = oldMerchandiseIds;
      newValues.merchandise_ids = newMerchandiseIds;
      changedFields.push('merchandise_ids');
    }
  }

  // Track appointment changes
  if ('appointment' in input) {
    if (input.appointment === null) {
      if (existingTicket.appointment_id) {
        oldValues.appointment_id = existingTicket.appointment_id;
        newValues.appointment_id = null;
        changedFields.push('appointment_id');
      }
    } else if (input.appointment) {
      if (existingTicket.appointment_id && oldAppointmentData) {
        // Update existing appointment - track appointment field changes
        for (const [key, newValue] of Object.entries(input.appointment)) {
          const oldValue = oldAppointmentData[key];
          if (oldValue !== newValue) {
            oldValues[`appointment.${key}`] = oldValue;
            newValues[`appointment.${key}`] = newValue;
            changedFields.push(`appointment.${key}`);
          }
        }
      } else {
        // New appointment created - get the updated ticket to find the new appointment_id
        const { data: refreshedTicket } = await supabase
          .from('main_tickets')
          .select('appointment_id')
          .eq('id', ticketId)
          .single();
        
        if (refreshedTicket?.appointment_id) {
          oldValues.appointment_id = null;
          newValues.appointment_id = refreshedTicket.appointment_id;
          changedFields.push('appointment_id');
        }
      }
    }
  }

  // Log audit entry if there were any changes
  if (changedFields.length > 0) {
    await logTicketAudit({
      ticketId,
      action: 'updated',
      changedBy: employeeId,
      oldValues: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValues: Object.keys(newValues).length > 0 ? newValues : undefined,
      changedFields,
      metadata: {
        company_changed: input.company ? true : false,
        site_changed: siteChanged,
        contact_changed: contactChanged,
      },
    });
  }

  // Step 9: Return updated ticket data
  return updatedTicket;
}

/**
 * Delete ticket and optionally clean up related data
 */
/**
 * Remove a ticket-employee assignment
 * Requires: ticket_id, employee_id, and date
 */
export async function removeTicketEmployee(
  ticketId: string,
  employeeId: string,
  date: string,
  _changedByEmployeeId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Validate inputs
  if (!ticketId || !employeeId || !date) {
    throw new ValidationError('กรุณาระบุ ticket_id, employee_id และ date');
  }

  // Validate date format
  if (isNaN(Date.parse(date))) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง');
  }

  // Check if assignment exists
  const { data: existing, error: checkError } = await supabase
    .from('jct_ticket_employees')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('employee_id', employeeId)
    .eq('date', date)
    .single();

  if (checkError) {
    if (checkError.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบการมอบหมายพนักงานนี้');
    }
    throw new DatabaseError(`ไม่สามารถตรวจสอบการมอบหมายได้: ${checkError.message}`);
  }

  if (!existing) {
    throw new NotFoundError('ไม่พบการมอบหมายพนักงานนี้');
  }

  // Delete the assignment
  const { error: deleteError } = await supabase
    .from('jct_ticket_employees')
    .delete()
    .eq('ticket_id', ticketId)
    .eq('employee_id', employeeId)
    .eq('date', date);

  if (deleteError) {
    throw new DatabaseError(`ไม่สามารถลบการมอบหมายได้: ${deleteError.message}`);
  }
}

export async function deleteTicket(ticketId: string, employeeId: string, options?: {
  deleteAppointment?: boolean;
  deleteContact?: boolean;
}): Promise<void> {
  const supabase = createServiceClient();

  // Get full ticket data before deletion for audit log
  const { data: fullTicket, error: checkError } = await supabase
    .from('main_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (checkError || !fullTicket) {
    throw new NotFoundError('ไม่พบตั๋วงาน');
  }

  // Get related data for audit log
  const { data: ticketEmployees } = await supabase
    .from('jct_ticket_employees')
    .select('employee_id')
    .eq('ticket_id', ticketId);
  
  const { data: ticketMerchandise } = await supabase
    .from('jct_ticket_merchandise')
    .select('merchandise_id')
    .eq('ticket_id', ticketId);

  const employeeIds = (ticketEmployees || []).map(e => e.employee_id as string);
  const merchandiseIds = (ticketMerchandise || []).map(m => m.merchandise_id as string);

  // Prepare old values for audit log
  const oldValues = {
    ...fullTicket,
    employee_ids: employeeIds,
    merchandise_ids: merchandiseIds,
  };

  // Delete appointment if requested
  if (options?.deleteAppointment && fullTicket.appointment_id) {
    const { error: appointmentError } = await supabase
      .from('main_appointments')
      .delete()
      .eq('id', fullTicket.appointment_id);

    if (appointmentError) {
      console.error('Failed to delete appointment:', appointmentError);
      // Don't fail the whole operation
    }
  }

  // Delete ticket (cascade will handle ticket_employees and ticket_merchandise)
  const { error: deleteError } = await supabase
    .from('main_tickets')
    .delete()
    .eq('id', ticketId);

  if (deleteError) {
    throw new DatabaseError(`ไม่สามารถลบตั๋วงานได้: ${deleteError.message}`);
  }

  // Log audit entry for deletion
  await logTicketAudit({
    ticketId,
    action: 'deleted',
    changedBy: employeeId,
    oldValues,
    metadata: {
      delete_appointment: options?.deleteAppointment || false,
      delete_contact: options?.deleteContact || false,
    },
  });

  // Delete contact if requested and no other tickets use it
  if (options?.deleteContact && fullTicket.contact_id) {
    const { data: otherTickets } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('contact_id', fullTicket.contact_id)
      .limit(1);

    if (!otherTickets || otherTickets.length === 0) {
      await supabase
        .from('child_site_contacts')
        .delete()
        .eq('id', fullTicket.contact_id);
    }
  }
}

