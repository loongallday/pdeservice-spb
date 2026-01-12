/**
 * Ticket CRUD service - Business logic for creating, updating, and deleting tickets
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import type { MasterTicketCreateInput, MasterTicketUpdateInput } from './ticketTypes.ts';
import { linkMerchandiseToTicket, logTicketAudit } from './ticketHelperService.ts';
import { getById } from './ticketSearchService.ts';
import { WatcherService } from './watcherService.ts';
import { NotificationService } from './notificationService.ts';
import {
  generateTicketSummary,
  TicketSummaryContext,
  MerchandiseItem,
  ContactInfo,
  AppointmentInfo,
  SiteInfo,
} from '../../_shared/summaryUtils.ts';

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
  let resolvedSiteName: string | null = null;
  if (input.site) {
    if (input.site.id) {
      // Use existing site - validate it exists and get the name
      const { data: existingSite } = await supabase
        .from('main_sites')
        .select('id, name')
        .eq('id', input.site.id)
        .single();

      if (!existingSite) {
        throw new NotFoundError('ไม่พบสถานที่');
      }
      siteId = input.site.id;
      resolvedSiteName = existingSite.name;
    } else {
      // Create new site
      const siteData = {
        ...input.site,
        company_id: input.site.company_id || companyId,
      };
      const { data: newSite, error: siteError } = await supabase
        .from('main_sites')
        .insert([siteData])
        .select('id, name')
        .single();

      if (siteError) {
        throw new DatabaseError(`ไม่สามารถสร้างสถานที่ได้: ${siteError.message}`);
      }
      siteId = newSite.id;
      resolvedSiteName = newSite.name;
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
  // Extract work_giver_id from ticket data (stored in separate child table)
  const { work_giver_id, ...ticketFieldsWithoutWorkGiver } = input.ticket;

  // Generate AI summary if flag is set - using full ticket context with ALL details
  let detailsSummary: string | null = null;
  if (input.summarize) {
    // Build comprehensive summary context with ALL ticket information
    const summaryContext: TicketSummaryContext = {
      details: input.ticket.details || null,
      additional: input.ticket.additional || null,
    };

    // Fetch work type
    if (input.ticket.work_type_id) {
      const { data: workType } = await supabase
        .from('ref_ticket_work_types')
        .select('name, code')
        .eq('id', input.ticket.work_type_id)
        .single();
      if (workType) {
        summaryContext.workType = workType.name;
        summaryContext.workTypeCode = workType.code;
      }
    }

    // Fetch status
    if (input.ticket.status_id) {
      const { data: status } = await supabase
        .from('ref_ticket_statuses')
        .select('name, code')
        .eq('id', input.ticket.status_id)
        .single();
      if (status) {
        summaryContext.status = status.name;
        summaryContext.statusCode = status.code;
      }
    }

    // Fetch assigner
    if (input.ticket.assigner_id) {
      const { data: assigner } = await supabase
        .from('main_employees')
        .select('name, nickname')
        .eq('id', input.ticket.assigner_id)
        .single();
      if (assigner) {
        summaryContext.assignerName = assigner.nickname || assigner.name;
      }
    }

    // Fetch company
    if (companyId) {
      const { data: company } = await supabase
        .from('main_companies')
        .select('name_th, name_en, tax_id')
        .eq('tax_id', companyId)
        .single();
      if (company) {
        summaryContext.companyName = company.name_th || company.name_en;
        summaryContext.companyTaxId = company.tax_id;
      }
    }

    // Fetch site with full location details
    if (siteId) {
      const { data: site } = await supabase
        .from('main_sites')
        .select('name, address_detail, province_code, district_code, subdistrict_code, postal_code, map_url')
        .eq('id', siteId)
        .single();

      if (site) {
        const siteInfo: SiteInfo = {
          name: site.name,
          addressDetail: site.address_detail,
          postalCode: site.postal_code?.toString() || null,
          mapUrl: site.map_url,
        };

        // Resolve location names
        if (site.province_code) {
          const { data: province } = await supabase
            .from('ref_provinces')
            .select('name_th')
            .eq('code', site.province_code)
            .single();
          siteInfo.provinceName = province?.name_th || null;
        }
        if (site.district_code) {
          const { data: district } = await supabase
            .from('ref_districts')
            .select('name_th')
            .eq('code', site.district_code)
            .single();
          siteInfo.districtName = district?.name_th || null;
        }
        if (site.subdistrict_code) {
          const { data: subdistrict } = await supabase
            .from('ref_subdistricts')
            .select('name_th')
            .eq('code', site.subdistrict_code)
            .single();
          siteInfo.subdistrictName = subdistrict?.name_th || null;
        }

        summaryContext.site = siteInfo;
      }
    }

    // Fetch contact with all details
    if (contactId) {
      const { data: contact } = await supabase
        .from('child_site_contacts')
        .select('person_name, nickname, phone, email, line_id, note')
        .eq('id', contactId)
        .single();

      if (contact) {
        const contactInfo: ContactInfo = {
          name: contact.person_name,
          nickname: contact.nickname,
          phone: Array.isArray(contact.phone) ? contact.phone : null,
          email: Array.isArray(contact.email) ? contact.email : null,
          lineId: contact.line_id,
          note: contact.note,
        };
        summaryContext.contact = contactInfo;
      }
    }

    // Build appointment info
    if (input.appointment) {
      const apptInfo: AppointmentInfo = {
        date: input.appointment.appointment_date || null,
        timeStart: input.appointment.appointment_time_start || null,
        timeEnd: input.appointment.appointment_time_end || null,
        type: input.appointment.appointment_type || null,
      };
      summaryContext.appointment = apptInfo;
    }

    // Fetch employees with key employee info
    if (input.employee_ids && input.employee_ids.length > 0) {
      const normalizedEmps = normalizeEmployeeIds(input.employee_ids);
      const empIds = normalizedEmps.map(e => e.id);
      const { data: employees } = await supabase
        .from('main_employees')
        .select('id, nickname, first_name, name')
        .in('id', empIds);

      if (employees) {
        const employeeNames: string[] = [];
        let keyEmployee: string | null = null;

        for (const emp of employees) {
          const empName = emp.nickname || emp.first_name || emp.name || 'ช่าง';
          employeeNames.push(empName);

          // Check if this is the key employee
          const empConfig = normalizedEmps.find(e => e.id === emp.id);
          if (empConfig?.is_key) {
            keyEmployee = empName;
          }
        }

        summaryContext.employees = employeeNames;
        summaryContext.keyEmployee = keyEmployee;
      }
    }

    // Fetch merchandise with model details
    if (input.merchandise_ids && input.merchandise_ids.length > 0) {
      const { data: merchandiseData } = await supabase
        .from('main_merchandise')
        .select(`
          serial_no,
          model:main_models(
            model,
            brand:ref_brands(name),
            capacity:ref_capacities(name)
          )
        `)
        .in('id', input.merchandise_ids);

      if (merchandiseData && merchandiseData.length > 0) {
        const merchItems: MerchandiseItem[] = merchandiseData.map(m => {
          const model = m.model as {
            model?: string;
            brand?: { name?: string } | null;
            capacity?: { name?: string } | null;
          } | null;

          return {
            serialNo: m.serial_no,
            modelName: model?.model || null,
            brand: model?.brand?.name || null,
            capacity: model?.capacity?.name || null,
          };
        });
        summaryContext.merchandise = merchItems;
      }
    }

    // Fetch work giver
    if (work_giver_id) {
      const { data: workGiver } = await supabase
        .from('ref_work_givers')
        .select('name')
        .eq('id', work_giver_id)
        .single();
      if (workGiver) {
        summaryContext.workGiver = workGiver.name;
      }
    }

    console.log('[ticket-create] Summary context fields:', Object.keys(summaryContext).filter(k => {
      const val = summaryContext[k as keyof TicketSummaryContext];
      return val !== null && val !== undefined;
    }));
    detailsSummary = await generateTicketSummary(summaryContext);
    console.log('[ticket-create] Generated summary:', detailsSummary);
  }

  const ticketData = {
    ...ticketFieldsWithoutWorkGiver,
    site_id: siteId,
    contact_id: contactId,
    created_by: employeeId,
    details_summary: detailsSummary,
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

  // Step 7.5: Link Work Giver (if provided)
  if (work_giver_id) {
    // Validate work_giver exists and is active
    const { data: workGiver, error: workGiverCheckError } = await supabase
      .from('ref_work_givers')
      .select('id, is_active')
      .eq('id', work_giver_id)
      .single();

    if (workGiverCheckError || !workGiver) {
      throw new ValidationError('ไม่พบผู้ว่าจ้าง (Work Giver) ที่ระบุ');
    }

    if (!workGiver.is_active) {
      throw new ValidationError('ผู้ว่าจ้าง (Work Giver) ที่ระบุไม่ได้เปิดใช้งาน');
    }

    // Insert into child_ticket_work_givers
    const { error: workGiverError } = await supabase
      .from('child_ticket_work_givers')
      .insert([{
        ticket_id: ticket.id,
        work_giver_id: work_giver_id,
      }]);

    if (workGiverError) {
      throw new DatabaseError(`ไม่สามารถเชื่อมโยงผู้ว่าจ้างได้: ${workGiverError.message}`);
    }
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
      work_giver_id: work_giver_id || null,
    },
    metadata: {
      company_created: companyCreated,
      site_created: input.site && !input.site.id ? true : false,
      contact_created: input.contact && !input.contact.id ? true : false,
      appointment_created: !!appointmentId,
      work_giver_linked: !!work_giver_id,
    },
  });

  // Step 8.5: Add creator and assigner as auto-watchers (async, non-blocking)
  WatcherService.addAutoWatchers(ticket.id, employeeId, ticketData.assigner_id || null)
    .catch(err => {
      console.error('[ticket-create] Failed to add auto-watchers:', err);
    });

  // Step 8.6: Notify approvers about new ticket (async, non-blocking)
  const siteName = resolvedSiteName || 'ไม่ระบุสถานที่';
  NotificationService.createApprovalRequestNotifications(
    ticket.id,
    employeeId,
    siteName,
    ticketData.work_type
  ).catch(err => {
    console.error('[ticket-create] Failed to notify approvers:', err);
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

  // Check if appointment was approved (for auto-unapproval logic)
  let wasApproved = false;
  let siteName = '';
  if (existingTicket.appointment_id) {
    const { data: appointment } = await supabase
      .from('main_appointments')
      .select('is_approved')
      .eq('id', existingTicket.appointment_id)
      .single();
    wasApproved = appointment?.is_approved === true;
  }

  // Check if user can approve appointments (to determine if auto-unapproval is needed)
  const { data: approverCheck } = await supabase
    .from('jct_appointment_approvers')
    .select('id')
    .eq('employee_id', employeeId)
    .maybeSingle();
  const userCanApprove = approverCheck !== null;

  // Get site name for notification
  if (existingTicket.site_id) {
    const { data: site } = await supabase
      .from('main_sites')
      .select('name')
      .eq('id', existingTicket.site_id)
      .single();
    siteName = site?.name || 'ไม่ระบุสถานที่';
  } else {
    siteName = 'ไม่ระบุสถานที่';
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
  if (input.ticket || siteChanged || contactChanged || input.summarize) {
    // Remove created_by and work_giver_id if included (work_giver stored in child table)
    const ticketInputData = input.ticket || {};
    const {
      created_by: _created_by,
      work_giver_id: _work_giver_id,
      ...ticketDataWithoutWorkGiver
    } = ticketInputData as Record<string, unknown> & { created_by?: string; work_giver_id?: string | null };

    // Suppress unused variable warnings (these are intentionally extracted to exclude from update)
    void _created_by;
    void _work_giver_id;

    // Generate AI summary if flag is set - using full ticket context with ALL details
    let detailsSummary: string | null | undefined = undefined;
    if (input.summarize) {
      // Build comprehensive summary context with ALL ticket information
      const summaryContext: TicketSummaryContext = {
        ticketId: ticketId,
        details: input.ticket?.details ?? existingTicket.details ?? null,
        additional: input.ticket?.additional ?? existingTicket.additional ?? null,
      };

      // Fetch work type
      const workTypeId = input.ticket?.work_type_id || existingTicket.work_type_id;
      if (workTypeId) {
        const { data: workType } = await supabase
          .from('ref_ticket_work_types')
          .select('name, code')
          .eq('id', workTypeId)
          .single();
        if (workType) {
          summaryContext.workType = workType.name;
          summaryContext.workTypeCode = workType.code;
        }
      }

      // Fetch status
      const statusId = input.ticket?.status_id || existingTicket.status_id;
      if (statusId) {
        const { data: status } = await supabase
          .from('ref_ticket_statuses')
          .select('name, code')
          .eq('id', statusId)
          .single();
        if (status) {
          summaryContext.status = status.name;
          summaryContext.statusCode = status.code;
        }
      }

      // Fetch assigner
      const assignerId = input.ticket?.assigner_id || existingTicket.assigner_id;
      if (assignerId) {
        const { data: assigner } = await supabase
          .from('main_employees')
          .select('name, nickname')
          .eq('id', assignerId)
          .single();
        if (assigner) {
          summaryContext.assignerName = assigner.nickname || assigner.name;
        }
      }

      // Fetch company
      if (companyId) {
        const { data: company } = await supabase
          .from('main_companies')
          .select('name_th, name_en, tax_id')
          .eq('tax_id', companyId)
          .single();
        if (company) {
          summaryContext.companyName = company.name_th || company.name_en;
          summaryContext.companyTaxId = company.tax_id;
        }
      }

      // Fetch site with full location details
      if (siteId) {
        const { data: site } = await supabase
          .from('main_sites')
          .select('name, address_detail, province_code, district_code, subdistrict_code, postal_code, map_url')
          .eq('id', siteId)
          .single();

        if (site) {
          const siteInfo: SiteInfo = {
            name: site.name,
            addressDetail: site.address_detail,
            postalCode: site.postal_code?.toString() || null,
            mapUrl: site.map_url,
          };

          // Resolve location names
          if (site.province_code) {
            const { data: province } = await supabase
              .from('ref_provinces')
              .select('name_th')
              .eq('code', site.province_code)
              .single();
            siteInfo.provinceName = province?.name_th || null;
          }
          if (site.district_code) {
            const { data: district } = await supabase
              .from('ref_districts')
              .select('name_th')
              .eq('code', site.district_code)
              .single();
            siteInfo.districtName = district?.name_th || null;
          }
          if (site.subdistrict_code) {
            const { data: subdistrict } = await supabase
              .from('ref_subdistricts')
              .select('name_th')
              .eq('code', site.subdistrict_code)
              .single();
            siteInfo.subdistrictName = subdistrict?.name_th || null;
          }

          summaryContext.site = siteInfo;
        }
      }

      // Fetch contact with all details
      if (contactId) {
        const { data: contact } = await supabase
          .from('child_site_contacts')
          .select('person_name, nickname, phone, email, line_id, note')
          .eq('id', contactId)
          .single();

        if (contact) {
          const contactInfo: ContactInfo = {
            name: contact.person_name,
            nickname: contact.nickname,
            phone: Array.isArray(contact.phone) ? contact.phone : null,
            email: Array.isArray(contact.email) ? contact.email : null,
            lineId: contact.line_id,
            note: contact.note,
          };
          summaryContext.contact = contactInfo;
        }
      }

      // Build appointment info
      if ('appointment' in input && input.appointment !== null && input.appointment) {
        const apptInfo: AppointmentInfo = {
          date: input.appointment.appointment_date || null,
          timeStart: input.appointment.appointment_time_start || null,
          timeEnd: input.appointment.appointment_time_end || null,
          type: input.appointment.appointment_type || null,
        };
        summaryContext.appointment = apptInfo;
      } else if (existingTicket.appointment_id) {
        const { data: existingAppt } = await supabase
          .from('main_appointments')
          .select('appointment_date, appointment_time_start, appointment_time_end, appointment_type, is_approved')
          .eq('id', existingTicket.appointment_id)
          .single();
        if (existingAppt) {
          summaryContext.appointment = {
            date: existingAppt.appointment_date,
            timeStart: existingAppt.appointment_time_start,
            timeEnd: existingAppt.appointment_time_end,
            type: existingAppt.appointment_type,
            isApproved: existingAppt.is_approved,
          };
        }
      }

      // Fetch employees with key employee info
      if (input.employee_ids !== undefined) {
        const normalizedEmps = normalizeEmployeeIds(input.employee_ids);
        const empIds = normalizedEmps.map(e => e.id);
        if (empIds.length > 0) {
          const { data: employees } = await supabase
            .from('main_employees')
            .select('id, nickname, first_name, name')
            .in('id', empIds);

          if (employees) {
            const employeeNames: string[] = [];
            let keyEmployee: string | null = null;

            for (const emp of employees) {
              const empName = emp.nickname || emp.first_name || emp.name || 'ช่าง';
              employeeNames.push(empName);

              const empConfig = normalizedEmps.find(e => e.id === emp.id);
              if (empConfig?.is_key) {
                keyEmployee = empName;
              }
            }

            summaryContext.employees = employeeNames;
            summaryContext.keyEmployee = keyEmployee;
          }
        }
      } else {
        // Use existing employees
        const { data: ticketEmps } = await supabase
          .from('jct_ticket_employees')
          .select('is_key_employee, employee:main_employees(nickname, first_name, name)')
          .eq('ticket_id', ticketId);

        if (ticketEmps && ticketEmps.length > 0) {
          const employeeNames: string[] = [];
          let keyEmployee: string | null = null;

          for (const te of ticketEmps) {
            const emp = te.employee as { nickname?: string; first_name?: string; name?: string } | null;
            const empName = emp?.nickname || emp?.first_name || emp?.name || 'ช่าง';
            employeeNames.push(empName);
            if (te.is_key_employee) {
              keyEmployee = empName;
            }
          }

          summaryContext.employees = employeeNames;
          summaryContext.keyEmployee = keyEmployee;
        }
      }

      // Fetch confirmed employees
      const { data: confirmedEmps } = await supabase
        .from('jct_ticket_employees_cf')
        .select('employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(nickname, first_name, name)')
        .eq('ticket_id', ticketId);

      if (confirmedEmps && confirmedEmps.length > 0) {
        summaryContext.confirmedEmployees = confirmedEmps.map(ce => {
          const emp = ce.employee as { nickname?: string; first_name?: string; name?: string } | null;
          return emp?.nickname || emp?.first_name || emp?.name || 'ช่าง';
        });
      }

      // Fetch merchandise with model details
      const merchandiseIds = input.merchandise_ids !== undefined ? input.merchandise_ids : null;
      if (merchandiseIds !== null && merchandiseIds.length > 0) {
        const { data: merchandiseData } = await supabase
          .from('main_merchandise')
          .select(`
            serial_no,
            model:main_models(
              model,
              brand:ref_brands(name),
              capacity:ref_capacities(name)
            )
          `)
          .in('id', merchandiseIds);

        if (merchandiseData && merchandiseData.length > 0) {
          summaryContext.merchandise = merchandiseData.map(m => {
            const model = m.model as {
              model?: string;
              brand?: { name?: string } | null;
              capacity?: { name?: string } | null;
            } | null;

            return {
              serialNo: m.serial_no,
              modelName: model?.model || null,
              brand: model?.brand?.name || null,
              capacity: model?.capacity?.name || null,
            };
          });
        }
      } else if (merchandiseIds === null) {
        // Use existing merchandise
        const { data: ticketMerch } = await supabase
          .from('jct_ticket_merchandise')
          .select(`
            merchandise:main_merchandise(
              serial_no,
              model:main_models(
                model,
                brand:ref_brands(name),
                capacity:ref_capacities(name)
              )
            )
          `)
          .eq('ticket_id', ticketId);

        if (ticketMerch && ticketMerch.length > 0) {
          const merchItems: MerchandiseItem[] = [];
          for (const tm of ticketMerch) {
            const merch = tm.merchandise as {
              serial_no?: string;
              model?: {
                model?: string;
                brand?: { name?: string } | null;
                capacity?: { name?: string } | null;
              } | null;
            } | null;

            if (merch) {
              merchItems.push({
                serialNo: merch.serial_no,
                modelName: merch.model?.model || null,
                brand: merch.model?.brand?.name || null,
                capacity: merch.model?.capacity?.name || null,
              });
            }
          }
          if (merchItems.length > 0) {
            summaryContext.merchandise = merchItems;
          }
        }
      }

      // Fetch work giver
      const { data: workGiverData } = await supabase
        .from('child_ticket_work_givers')
        .select('ref_work_givers:work_giver_id(name)')
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (workGiverData?.ref_work_givers) {
        const wg = workGiverData.ref_work_givers as { name?: string };
        summaryContext.workGiver = wg.name || null;
      }

      console.log('[ticket-update] Summary context fields:', Object.keys(summaryContext).filter(k => {
        const val = summaryContext[k as keyof TicketSummaryContext];
        return val !== null && val !== undefined;
      }));
      detailsSummary = await generateTicketSummary(summaryContext);
      console.log('[ticket-update] Generated summary:', detailsSummary);
    }

    const ticketUpdate: Record<string, unknown> = {
      ...ticketDataWithoutWorkGiver,
      site_id: siteId,
      contact_id: contactId,
    };

    // Only include details_summary if we generated one
    if (detailsSummary !== undefined) {
      ticketUpdate.details_summary = detailsSummary;
    }

    const { error: ticketError } = await supabase
      .from('main_tickets')
      .update(ticketUpdate)
      .eq('id', ticketId);

    if (ticketError) {
      throw new DatabaseError(`ไม่สามารถอัพเดทตั๋วงานได้: ${ticketError.message}`);
    }
  }

  // Step 4.5: Update Work Giver
  let oldWorkGiverId: string | null = null;
  let workGiverChanged = false;

  // Get current work_giver for the ticket
  const { data: currentWorkGiver } = await supabase
    .from('child_ticket_work_givers')
    .select('id, work_giver_id')
    .eq('ticket_id', ticketId)
    .single();
  
  if (currentWorkGiver) {
    oldWorkGiverId = currentWorkGiver.work_giver_id as string;
  }

  // Check if work_giver_id is explicitly set in the input.ticket
  if (input.ticket && 'work_giver_id' in input.ticket) {
    if (input.ticket.work_giver_id === null) {
      // Explicit null - remove work_giver link
      if (currentWorkGiver) {
        const { error: deleteWorkGiverError } = await supabase
          .from('child_ticket_work_givers')
          .delete()
          .eq('ticket_id', ticketId);
        
        if (deleteWorkGiverError) {
          throw new DatabaseError(`ไม่สามารถลบผู้ว่าจ้างได้: ${deleteWorkGiverError.message}`);
        }
        workGiverChanged = true;
      }
    } else if (input.ticket.work_giver_id) {
      // Validate work_giver exists and is active
      const { data: workGiver, error: workGiverCheckError } = await supabase
        .from('ref_work_givers')
        .select('id, is_active')
        .eq('id', input.ticket.work_giver_id)
        .single();

      if (workGiverCheckError || !workGiver) {
        throw new ValidationError('ไม่พบผู้ว่าจ้าง (Work Giver) ที่ระบุ');
      }

      if (!workGiver.is_active) {
        throw new ValidationError('ผู้ว่าจ้าง (Work Giver) ที่ระบุไม่ได้เปิดใช้งาน');
      }

      if (currentWorkGiver) {
        // Update existing work_giver link
        if (currentWorkGiver.work_giver_id !== input.ticket.work_giver_id) {
          const { error: updateWorkGiverError } = await supabase
            .from('child_ticket_work_givers')
            .update({ 
              work_giver_id: input.ticket.work_giver_id,
              updated_at: new Date().toISOString(),
            })
            .eq('ticket_id', ticketId);
          
          if (updateWorkGiverError) {
            throw new DatabaseError(`ไม่สามารถอัพเดทผู้ว่าจ้างได้: ${updateWorkGiverError.message}`);
          }
          workGiverChanged = true;
        }
      } else {
        // Create new work_giver link
        const { error: insertWorkGiverError } = await supabase
          .from('child_ticket_work_givers')
          .insert([{
            ticket_id: ticketId,
            work_giver_id: input.ticket.work_giver_id,
          }]);
        
        if (insertWorkGiverError) {
          throw new DatabaseError(`ไม่สามารถเชื่อมโยงผู้ว่าจ้างได้: ${insertWorkGiverError.message}`);
        }
        workGiverChanged = true;
      }
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

  // Track work_giver changes
  if (workGiverChanged) {
    const newWorkGiverId = input.ticket?.work_giver_id ?? null;
    oldValues.work_giver_id = oldWorkGiverId;
    newValues.work_giver_id = newWorkGiverId;
    changedFields.push('work_giver_id');
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
        work_giver_changed: workGiverChanged,
      },
    });

    // Step 8.5: Auto-unapprove if appointment details were changed by non-approver
    // Only appointment-related changes should trigger unapproval, not other ticket details
    const appointmentFieldsChanged = changedFields.some(field =>
      field.startsWith('appointment.') || field === 'appointment_id'
    );

    if (wasApproved && !userCanApprove && existingTicket.appointment_id && appointmentFieldsChanged) {
      // Update appointment to unapproved
      const { error: unapproveError } = await supabase
        .from('main_appointments')
        .update({ is_approved: false })
        .eq('id', existingTicket.appointment_id);

      if (!unapproveError) {
        // Log unapproval audit entry
        const auditId = await logTicketAudit({
          ticketId,
          action: 'unapproved',
          changedBy: employeeId,
          oldValues: { is_approved: true },
          newValues: { is_approved: false },
          changedFields: ['is_approved'],
          metadata: {
            auto_unapproved: true,
            reason: 'ticket_edited_by_non_approver',
            appointment_id: existingTicket.appointment_id,
          },
        });

        // Get current site name for notification (may have changed during update)
        let currentSiteName = siteName;
        if (siteId && siteId !== existingTicket.site_id) {
          const { data: newSite } = await supabase
            .from('main_sites')
            .select('name')
            .eq('id', siteId)
            .single();
          currentSiteName = newSite?.name || siteName;
        }

        // Notify the original approver (async, don't wait)
        NotificationService.createUnapprovalNotificationToApprover(
          ticketId,
          employeeId,
          currentSiteName,
          auditId
        ).catch(err => {
          console.error('[ticket-update] Failed to notify approver:', err);
        });

        // Also notify confirmed technicians about the unapproval
        NotificationService.createApprovalNotifications(
          ticketId,
          false, // is_approved = false
          employeeId,
          auditId
        ).catch(err => {
          console.error('[ticket-update] Failed to notify technicians:', err);
        });

        console.log('[ticket-update] Auto-unapproved ticket:', ticketId);
      }
    }
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

