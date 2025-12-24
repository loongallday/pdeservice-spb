/**
 * Ticket CRUD service - Business logic for creating, updating, and deleting tickets
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import type { MasterTicketCreateInput, MasterTicketUpdateInput } from './ticketTypes.ts';
import { linkMerchandiseToTicket, logTicketAudit } from './ticketHelperService.ts';
import { getById } from './ticketSearchService.ts';

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
      .from('companies')
      .select('tax_id')
      .eq('tax_id', taxId)
      .single();

    if (existingCompany) {
      // Company exists, use it
      companyId = taxId;
    } else {
      // Create new company
      const { error: companyError } = await supabase
        .from('companies')
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
        .from('sites')
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
        .from('sites')
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
        .from('contacts')
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
        .from('contacts')
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

  // Step 5: Create Appointment (always create, even if empty)
  let appointmentId: string | null = null;
  const appointmentData = input.appointment || {};
  
  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert([{
      ...appointmentData,
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
      throw new DatabaseError(`ไม่สามารถอัพเดท appointment_id ในตั๋วงานได้: ${updateError.message}`);
    }
  }

  // Step 6: Link Employees (technicians)
  if (input.employee_ids && input.employee_ids.length > 0) {
    const uniqueEmployeeIds = [...new Set(input.employee_ids)];

    // Determine the date for assignment (use appointment_date if available, otherwise current date)
    const appointmentDate = appointmentData.appointment_date as string | null | undefined;
    const assignmentDate = appointmentDate || new Date().toISOString().split('T')[0];

    const { error: employeeError } = await supabase
      .from('ticket_employees')
      .insert(
        uniqueEmployeeIds.map(employeeId => ({
          ticket_id: ticket.id,
          employee_id: employeeId,
          date: assignmentDate,
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
    .from('tickets')
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
      .from('companies')
      .select('tax_id')
      .eq('tax_id', taxId)
      .single();

    if (existingCompany) {
      // Company exists, use it
      companyId = taxId;
    } else {
      // Create new company
      const { error: companyError } = await supabase
        .from('companies')
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
          .from('sites')
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
          .from('sites')
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
            .from('contacts')
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
            .from('contacts')
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
    const { created_by, ...ticketData } = input.ticket || {};
    const ticketUpdate = {
      ...ticketData,
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
  let oldAppointmentData: Record<string, unknown> | null = null;
  if ('appointment' in input) {
    // Get old appointment data before updating (for audit log)
    if (existingTicket.appointment_id) {
      const { data: oldAppointment } = await supabase
        .from('appointments')
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
  let oldEmployeeIds: string[] = [];
  if (input.employee_ids !== undefined) {
    // Get current employee IDs before deletion (for audit log)
    const { data: currentEmployees } = await supabase
      .from('ticket_employees')
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
        .from('appointments')
        .select('appointment_date')
        .eq('id', existingTicket.appointment_id)
        .single();

      if (existingAppointment) {
        appointmentDate = existingAppointment.appointment_date as string | null;
      }
    }

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
      // Determine the date for assignment (use appointment_date if available, otherwise current date)
      const assignmentDate = appointmentDate || new Date().toISOString().split('T')[0];
      
      const { error: employeeError } = await supabase
        .from('ticket_employees')
        .insert(
          uniqueEmployeeIds.map(employeeId => ({
            ticket_id: ticketId,
            employee_id: employeeId,
            date: assignmentDate,
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
      .from('ticket_merchandise')
      .select('merchandise_id')
      .eq('ticket_id', ticketId);
    
    oldMerchandiseIds = (currentMerchandise || []).map(m => m.merchandise_id as string);
    newMerchandiseIds = input.merchandise_ids || [];

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
        // New appointment created
        const { data: newAppointment } = await supabase
          .from('appointments')
          .select('id')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (newAppointment) {
          oldValues.appointment_id = null;
          newValues.appointment_id = newAppointment.id;
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
  changedByEmployeeId: string
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
    .from('ticket_employees')
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
    .from('ticket_employees')
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
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (checkError || !fullTicket) {
    throw new NotFoundError('ไม่พบตั๋วงาน');
  }

  // Get related data for audit log
  const { data: ticketEmployees } = await supabase
    .from('ticket_employees')
    .select('employee_id')
    .eq('ticket_id', ticketId);
  
  const { data: ticketMerchandise } = await supabase
    .from('ticket_merchandise')
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
      .from('appointments')
      .delete()
      .eq('id', fullTicket.appointment_id);

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
      .from('tickets')
      .select('id')
      .eq('contact_id', fullTicket.contact_id)
      .limit(1);

    if (!otherTickets || otherTickets.length === 0) {
      await supabase
        .from('contacts')
        .delete()
        .eq('id', fullTicket.contact_id);
    }
  }
}

