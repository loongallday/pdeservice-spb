/**
 * AI Tool Executor
 * Executes tools called by Claude AI
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { ToolName } from './toolDefinitions.ts';

const DEFAULT_LIMIT = 10;
const MAX_RESULT_ITEMS = 50; // Allow up to 50 results when user asks for more

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Limit array size only - keep complete information
 */
function limitResults(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.slice(0, MAX_RESULT_ITEMS);
  }
  return data;
}

// Work type code to ID mapping
const WORK_TYPE_MAP: Record<string, string> = {
  account: 'a0f4a887-dfe7-496b-851b-e09165ce343f',
  ags_battery: 'ae14043e-3ca0-4afc-b5d4-341f6f3e06ca',
  pickup: '9c3c46e3-c228-433d-8fec-1839030edefb',
  pm: 'f1093c78-0680-4181-8284-dc07ab7ba38a',
  rma: 'f243515b-ef8b-484b-8399-988d54fd122f',
  sales: '7b2a377b-fe11-478b-9a08-e8e9822d027b',
  start_up: '2f6f098f-a156-4bfc-97e9-bb7db9efbc7b',
  survey: '7a08defc-63e0-4461-b6c4-1dbc34f218d3',
};

// Status code to ID mapping
const STATUS_MAP: Record<string, string> = {
  normal: '36491478-9c1f-4635-90e2-a293968314df',
  urgent: '6798860c-4555-456a-a995-d89522b8982b',
};

/**
 * Execute a tool and return the result
 */
export async function executeTool(
  toolName: ToolName,
  toolInput: Record<string, unknown>,
  employee: Employee
): Promise<ToolResult> {
  const supabase = createServiceClient();

  try {
    switch (toolName) {
      case 'search_sites': {
        const query = toolInput.query as string;
        const limit = Math.min((toolInput.limit as number) || DEFAULT_LIMIT, MAX_RESULT_ITEMS);
        const companyId = toolInput.company_id as string | undefined;

        // Sanitize query - replace commas with spaces to avoid breaking PostgREST syntax
        const safeQuery = query.replace(/,/g, ' ').trim();

        // Site select fields including location codes
        const siteSelectFields = 'id, name, address_detail, company_id, is_main_branch, province_code, district_code, subdistrict_code, company:main_companies(name_th, name_en)';

        // Step 1: Find companies matching the query (by name_th, name_en)
        let matchingCompanyIds: string[] = [];
        if (safeQuery.length >= 1) {
          const { data: matchingCompanies, error: companyError } = await supabase
            .from('main_companies')
            .select('id')
            .or(`name_th.ilike.%${safeQuery}%,name_en.ilike.%${safeQuery}%`)
            .limit(100);

          if (companyError) {
            console.error('[ai-tool] search_sites company lookup error:', companyError.message);
          } else {
            matchingCompanyIds = matchingCompanies?.map(c => c.id) || [];
            console.log(`[ai-tool] search_sites found ${matchingCompanyIds.length} matching companies`);
          }
        }

        // Step 2: Search sites using simple approach - avoid complex .or() with .in.()
        // If we have matching company IDs, we'll do a union of results
        let allSites: Array<Record<string, unknown>> = [];

        // Search by name/address_detail
        if (safeQuery.length >= 1) {
          const { data: sitesByName, error: nameError } = await supabase
            .from('main_sites')
            .select(siteSelectFields)
            .or(`name.ilike.%${safeQuery}%,address_detail.ilike.%${safeQuery}%`)
            .order('name')
            .limit(limit);

          if (nameError) {
            console.error('[ai-tool] search_sites name search error:', nameError.message);
            throw nameError;
          }
          allSites = sitesByName || [];
        }

        // Also search sites by matching company IDs (if any)
        if (matchingCompanyIds.length > 0 && allSites.length < limit) {
          const existingIds = new Set(allSites.map(s => s.id));
          const { data: sitesByCompany, error: companyError } = await supabase
            .from('main_sites')
            .select(siteSelectFields)
            .in('company_id', matchingCompanyIds)
            .order('name')
            .limit(limit);

          if (companyError) {
            console.error('[ai-tool] search_sites company filter error:', companyError.message);
          } else if (sitesByCompany) {
            // Add sites not already in results
            for (const site of sitesByCompany) {
              if (!existingIds.has(site.id) && allSites.length < limit) {
                allSites.push(site);
              }
            }
          }
        }

        // Apply company filter if provided
        // Note: companyId might be a UUID or a tax_id - need to handle both
        let data = allSites;
        if (companyId) {
          let actualCompanyId = companyId;
          // Check if companyId looks like a tax_id (numeric, 13 digits) rather than UUID
          const isTaxId = /^\d{13}$/.test(companyId);
          if (isTaxId) {
            // Look up the actual company UUID by tax_id
            const { data: company } = await supabase
              .from('main_companies')
              .select('id')
              .eq('tax_id', companyId)
              .single();
            if (company) {
              actualCompanyId = company.id;
              console.log(`[ai-tool] Resolved tax_id ${companyId} -> company UUID ${actualCompanyId}`);
            }
          }
          data = data.filter(s => s.company_id === actualCompanyId);
        }

        // Step 3: Fetch location names from reference tables
        const provinceCodes = [...new Set(data.map(s => s.province_code).filter(Boolean))] as number[];
        const districtCodes = [...new Set(data.map(s => s.district_code).filter(Boolean))] as number[];
        const subdistrictCodes = [...new Set(data.map(s => s.subdistrict_code).filter(Boolean))] as number[];

        // Fetch province names
        const provinceMap = new Map<number, string>();
        if (provinceCodes.length > 0) {
          const { data: provinces } = await supabase
            .from('ref_provinces')
            .select('id, name_th')
            .in('id', provinceCodes);
          for (const p of provinces || []) {
            provinceMap.set(p.id, p.name_th);
          }
        }

        // Fetch district names
        const districtMap = new Map<number, string>();
        if (districtCodes.length > 0) {
          const { data: districts } = await supabase
            .from('ref_districts')
            .select('id, name_th')
            .in('id', districtCodes);
          for (const d of districts || []) {
            districtMap.set(d.id, d.name_th);
          }
        }

        // Fetch subdistrict names
        const subdistrictMap = new Map<number, string>();
        if (subdistrictCodes.length > 0) {
          const { data: subdistricts } = await supabase
            .from('ref_sub_districts')
            .select('id, name_th')
            .in('id', subdistrictCodes);
          for (const s of subdistricts || []) {
            subdistrictMap.set(s.id, s.name_th);
          }
        }

        // Transform to match globalSearch API response format with location data
        const transformedData = (data || []).map((site: Record<string, unknown>) => {
          const company = site.company as { name_th?: string; name_en?: string } | null;
          const provinceCode = site.province_code as number | null;
          const districtCode = site.district_code as number | null;
          const subdistrictCode = site.subdistrict_code as number | null;

          return {
            id: site.id,
            name: site.name,
            description: site.address_detail || null,
            company_id: site.company_id || null,
            is_main_branch: site.is_main_branch || false,
            company_name: company?.name_th || company?.name_en || null,
            province: provinceCode ? provinceMap.get(provinceCode) || null : null,
            district: districtCode ? districtMap.get(districtCode) || null : null,
            subdistrict: subdistrictCode ? subdistrictMap.get(subdistrictCode) || null : null,
          };
        });

        return { success: true, data: limitResults(transformedData) };
      }

      case 'search_companies': {
        const query = toolInput.query as string;
        const limit = Math.min((toolInput.limit as number) || DEFAULT_LIMIT, MAX_RESULT_ITEMS);

        // Require minimum 2 characters for search (matches API pattern)
        if (!query || query.trim().length < 2) {
          return { success: true, data: [] };
        }

        const searchQuery = query.trim();

        // Search by name_th, name_en, or tax_id
        // Uses same pattern as companyService.globalSearch
        const { data, error } = await supabase
          .from('main_companies')
          .select('id, tax_id, name_th, name_en, address_detail')
          .or(`name_th.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%,tax_id.ilike.%${searchQuery}%`)
          .order('name_th')
          .limit(limit);

        if (error) throw error;

        // Transform to match globalSearch API response format
        const transformedData = (data || []).map((company: Record<string, unknown>) => ({
          id: company.id,
          tax_id: company.tax_id || null,
          name_th: company.name_th,
          name_en: company.name_en,
          description: company.address_detail || null,
        }));

        return { success: true, data: limitResults(transformedData) };
      }

      case 'search_employees': {
        const query = toolInput.query as string | undefined;
        const roleCode = toolInput.role_code as string | undefined;
        const roleId = toolInput.role_id as string | undefined;
        const departmentId = toolInput.department_id as string | undefined;
        const isActive = toolInput.is_active as boolean | undefined;
        // Higher default limit for employees (25) since there are many technician levels
        const limit = Math.min((toolInput.limit as number) || 25, MAX_RESULT_ITEMS);

        // Use v_employees view which has denormalized department info
        // Matches networkSearch API pattern from employeeService.ts
        let queryBuilder = supabase
          .from('v_employees')
          .select('id, code, name, nickname, email, is_active, role_id, role_code, role_name_th, role_name_en, department_id, department_code, department_name_th, department_name_en, profile_image_url');

        // Apply text search if query is provided (name, nickname, email)
        if (query && query.length >= 1) {
          queryBuilder = queryBuilder.or(`name.ilike.%${query}%,nickname.ilike.%${query}%,email.ilike.%${query}%`);
        }

        // Apply filters - role_id takes precedence over role_code
        // Use partial match for role_code to include levels (e.g., technician matches technician, technician_l1, technician_l2)
        if (roleId) {
          queryBuilder = queryBuilder.eq('role_id', roleId);
        } else if (roleCode) {
          queryBuilder = queryBuilder.ilike('role_code', `${roleCode}%`);
        }

        if (departmentId) {
          queryBuilder = queryBuilder.eq('department_id', departmentId);
        }

        // Default to active employees if not specified
        if (isActive !== undefined) {
          queryBuilder = queryBuilder.eq('is_active', isActive);
        } else {
          queryBuilder = queryBuilder.eq('is_active', true);
        }

        const { data, error } = await queryBuilder
          .order('name')
          .limit(limit);

        if (error) throw error;

        // Transform to match networkSearch API response format
        const transformedData = (data || []).map((employee: Record<string, unknown>) => ({
          id: employee.id,
          code: employee.code,
          name: employee.name,
          nickname: employee.nickname || null,
          email: employee.email || null,
          is_active: employee.is_active,
          role_id: employee.role_id,
          role_code: employee.role_code || null,
          role_name: employee.role_name_th || employee.role_name_en || null,
          department_id: employee.department_id || null,
          department_code: employee.department_code || null,
          department_name: employee.department_name_th || employee.department_name_en || null,
          profile_image_url: employee.profile_image_url || null,
        }));

        return { success: true, data: limitResults(transformedData) };
      }

      case 'get_reference_data': {
        const type = toolInput.type as string;

        if (type === 'work_types') {
          const { data, error } = await supabase
            .from('ref_ticket_work_types')
            .select('id, code, name')
            .eq('is_active', true)
            .order('name');

          if (error) throw error;
          return { success: true, data };
        }

        if (type === 'statuses') {
          const { data, error } = await supabase
            .from('ref_ticket_statuses')
            .select('id, code, name')
            .eq('is_active', true)
            .order('name');

          if (error) throw error;
          return { success: true, data };
        }

        if (type === 'work_givers') {
          const { data, error } = await supabase
            .from('ref_work_givers')
            .select('id, code, name')
            .eq('is_active', true)
            .order('name');

          if (error) throw error;
          return { success: true, data };
        }

        return { success: false, error: 'ประเภทข้อมูลไม่ถูกต้อง' };
      }

      case 'create_ticket': {
        // Get work type ID
        const workTypeCode = toolInput.work_type_code as string;
        const workTypeId = WORK_TYPE_MAP[workTypeCode];
        if (!workTypeId) {
          return { success: false, error: `ไม่พบประเภทงาน: ${workTypeCode}` };
        }

        // Get status ID
        const statusCode = (toolInput.status_code as string) || 'normal';
        const statusId = STATUS_MAP[statusCode];
        if (!statusId) {
          return { success: false, error: `ไม่พบสถานะ: ${statusCode}` };
        }

        // Build ticket data
        const ticketData: Record<string, unknown> = {
          work_type_id: workTypeId,
          status_id: statusId,
          assigner_id: employee.id,
          created_by: employee.id,
          details: toolInput.details || null,
        };

        // Helper to extract UUID prefix from potentially formatted string
        const extractUUIDPrefix = (value: string): string | null => {
          const cleaned = value.replace(/[\[\]"'.\s]/g, '').replace(/\.{2,}/g, '');
          const uuidMatch = cleaned.match(/^[0-9a-fA-F-]+/);
          if (!uuidMatch) return null;
          const uuidPart = uuidMatch[0].replace(/-+$/, '');
          const hexOnly = uuidPart.replace(/-/g, '');
          return hexOnly.length >= 4 ? uuidPart : null;
        };

        // Handle site
        // Note: site_id might be a partial UUID from entity memory context
        // Could be various formats: "a1b2c3d4", "[a1b2c3d4]", "a1b2c3d4...", etc.
        let siteId: string | null = null;
        if (toolInput.site_id) {
          const inputSiteId = toolInput.site_id as string;

          // Check if this is a partial UUID (less than 36 chars) or full UUID
          if (inputSiteId.length < 36) {
            // Extract and resolve partial UUID by looking up in database
            const prefix = extractUUIDPrefix(inputSiteId);
            if (prefix) {
              const { data: matchingSite } = await supabase
                .from('main_sites')
                .select('id')
                .ilike('id', `${prefix}%`)
                .limit(1)
                .single();

              if (matchingSite) {
                siteId = matchingSite.id;
                console.log(`[ai-tool] Resolved partial site_id "${inputSiteId}" -> ${siteId}`);
              } else {
                return { success: false, error: `ไม่พบสถานที่ที่มี ID: ${inputSiteId}` };
              }
            } else {
              return { success: false, error: `รูปแบบ ID สถานที่ไม่ถูกต้อง: ${inputSiteId}` };
            }
          } else {
            siteId = inputSiteId;
          }
        } else if (toolInput.site_name) {
          // Create new site
          const siteData: Record<string, unknown> = {
            name: toolInput.site_name,
          };

          // Handle company
          if (toolInput.company_tax_id) {
            // Check if company exists
            const { data: existingCompany } = await supabase
              .from('main_companies')
              .select('tax_id')
              .eq('tax_id', toolInput.company_tax_id)
              .single();

            if (!existingCompany && toolInput.company_name) {
              // Create new company
              await supabase
                .from('main_companies')
                .insert({
                  tax_id: toolInput.company_tax_id,
                  name_th: toolInput.company_name,
                });
            }

            siteData.company_id = toolInput.company_tax_id;
          }

          const { data: newSite, error: siteError } = await supabase
            .from('main_sites')
            .insert(siteData)
            .select('id')
            .single();

          if (siteError) {
            return { success: false, error: `ไม่สามารถสร้างสถานที่: ${siteError.message}` };
          }
          siteId = newSite.id;
        }

        if (siteId) {
          ticketData.site_id = siteId;
        }

        // Handle contact
        if (toolInput.contact_name || toolInput.contact_phone) {
          const contactData: Record<string, unknown> = {
            person_name: toolInput.contact_name || null,
            phone: toolInput.contact_phone ? [toolInput.contact_phone] : null,
            site_id: siteId,
          };

          const { data: newContact, error: contactError } = await supabase
            .from('child_site_contacts')
            .insert(contactData)
            .select('id')
            .single();

          if (!contactError && newContact) {
            ticketData.contact_id = newContact.id;
          }
        }

        // Create appointment
        // Valid appointment_type values: call_to_schedule, full_day, half_morning, half_afternoon, time_range
        const appointmentData: Record<string, unknown> = {};
        if (toolInput.appointment_date) {
          appointmentData.appointment_date = toolInput.appointment_date;
          // Determine appointment type based on time inputs
          if (toolInput.appointment_time_start && toolInput.appointment_time_end) {
            appointmentData.appointment_type = 'time_range';
            appointmentData.appointment_time_start = toolInput.appointment_time_start + ':00';
            appointmentData.appointment_time_end = toolInput.appointment_time_end + ':00';
          } else {
            appointmentData.appointment_type = 'full_day'; // Default to full day when date is set
          }
        } else {
          appointmentData.appointment_type = 'call_to_schedule';
        }

        const { data: appointment, error: appointmentError } = await supabase
          .from('main_appointments')
          .insert(appointmentData)
          .select('id')
          .single();

        if (appointmentError) {
          return { success: false, error: `ไม่สามารถสร้างนัดหมาย: ${appointmentError.message}` };
        }

        ticketData.appointment_id = appointment.id;

        // Create ticket
        const { data: ticket, error: ticketError } = await supabase
          .from('main_tickets')
          .insert(ticketData)
          .select('id')
          .single();

        if (ticketError) {
          return { success: false, error: `ไม่สามารถสร้างตั๋วงาน: ${ticketError.message}` };
        }

        // Link employees
        // Note: employee_ids might be partial UUIDs from entity memory context
        // Could be various formats: "a1b2c3d4", "[a1b2c3d4]", "a1b2c3d4...", etc.
        if (toolInput.employee_ids && Array.isArray(toolInput.employee_ids)) {
          const resolvedEmployeeIds: string[] = [];

          for (const empId of toolInput.employee_ids as string[]) {
            if (empId.length < 36) {
              // Resolve partial UUID
              const prefix = extractUUIDPrefix(empId);
              if (prefix) {
                const { data: matchingEmp } = await supabase
                  .from('main_employees')
                  .select('id')
                  .ilike('id', `${prefix}%`)
                  .limit(1)
                  .single();

                if (matchingEmp) {
                  resolvedEmployeeIds.push(matchingEmp.id);
                  console.log(`[ai-tool] Resolved partial employee_id "${empId}" -> ${matchingEmp.id}`);
                }
              }
            } else {
              resolvedEmployeeIds.push(empId);
            }
          }

          if (resolvedEmployeeIds.length > 0) {
            const employeeLinks = resolvedEmployeeIds.map(empId => ({
              ticket_id: ticket.id,
              employee_id: empId,
            }));

            await supabase
              .from('jct_ticket_employees')
              .insert(employeeLinks);
          }
        }

        // Log audit
        await supabase
          .from('child_ticket_audits')
          .insert({
            ticket_id: ticket.id,
            actor_id: employee.id,
            action: 'created',
            details: { created_by_ai: true },
          });

        return {
          success: true,
          data: {
            ticket_id: ticket.id,
            message: `สร้างตั๋วงานสำเร็จ (ID: ${ticket.id.slice(0, 8)}...)`,
          },
        };
      }

      case 'get_ticket_summary': {
        const date = toolInput.date as string | undefined;
        const startDate = toolInput.start_date as string | undefined;
        const endDate = toolInput.end_date as string | undefined;
        const dateType = (toolInput.date_type as string | undefined) || 'appointed';
        const employeeId = toolInput.employee_id as string | undefined;

        // Map date_type to RPC parameter format
        const rpcDateType = dateType === 'create' ? 'created' : dateType === 'update' ? 'updated' : 'appointed';

        // Calculate date range
        let effectiveStartDate = startDate || null;
        let effectiveEndDate = endDate || null;
        if (date) {
          effectiveStartDate = date;
          effectiveEndDate = date;
        }

        // Use RPC to get ticket IDs matching criteria (we'll count by work_type)
        const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
          p_page: 1,
          p_limit: 1000, // Get all for counting
          p_sort: 'created_at',
          p_order: 'desc',
          p_start_date: effectiveStartDate,
          p_end_date: effectiveEndDate,
          p_date_type: rpcDateType,
          p_site_id: null,
          p_status_id: null,
          p_work_type_id: null,
          p_assigner_id: null,
          p_contact_id: null,
          p_details: null,
          p_exclude_backlog: false,
          p_only_backlog: false,
          p_employee_id: employeeId || null,
          p_department_id: null,
          p_appointment_is_approved: null,
        });

        if (rpcError) {
          console.error('[ai-tool] RPC get_ticket_summary error:', rpcError.message);
          throw rpcError;
        }

        const totalCount = ticketResults?.[0]?.total_count || 0;

        if (!ticketResults || ticketResults.length === 0) {
          const dateRangeStr = effectiveStartDate === effectiveEndDate
            ? effectiveStartDate
            : `${effectiveStartDate} ถึง ${effectiveEndDate}`;
          const dateTypeStr = dateType === 'appointed' ? 'วันนัดหมาย' : dateType === 'create' ? 'วันสร้าง' : 'วันอัพเดท';
          const emptyFormatted = `## สรุปตั๋วงาน\n\n**ช่วงวันที่:** ${dateRangeStr} (${dateTypeStr})\n**รวมทั้งหมด:** 0 งาน\n\n| ประเภทงาน | จำนวน |\n|-----------|-------|\n| - | 0 |`;
          return {
            success: true,
            data: {
              formatted_summary: emptyFormatted,
              total: 0,
              by_work_type: {},
              date_range: { start: effectiveStartDate, end: effectiveEndDate, type: dateType },
            },
          };
        }

        // Get ticket details to count by work_type
        const ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);

        const { data: tickets, error: ticketError } = await supabase
          .from('main_tickets')
          .select('id, work_type_id')
          .in('id', ticketIds);

        if (ticketError) throw ticketError;

        // Count by work_type
        const workTypeCounts: Record<string, number> = {};
        const workTypeIdToCode: Record<string, string> = {};

        // Reverse map from WORK_TYPE_MAP
        for (const [code, id] of Object.entries(WORK_TYPE_MAP)) {
          workTypeIdToCode[id] = code;
        }

        for (const ticket of tickets || []) {
          const workTypeCode = workTypeIdToCode[ticket.work_type_id] || 'unknown';
          workTypeCounts[workTypeCode] = (workTypeCounts[workTypeCode] || 0) + 1;
        }

        // Work type names in Thai
        const workTypeNames: Record<string, string> = {
          pm: 'PM (บำรุงรักษา)',
          rma: 'RMA (เคลม/ซ่อม)',
          sales: 'Sales (ขาย/ติดตั้ง)',
          survey: 'Survey (สำรวจ)',
          start_up: 'Start UP (เริ่มระบบ)',
          pickup: 'Pickup (รับ-ส่งเครื่อง)',
          account: 'Account (บัญชี/วางบิล)',
          ags_battery: 'AGS Battery',
        };

        // Format summary
        const byWorkType: Record<string, { count: number; name: string }> = {};
        for (const [code, count] of Object.entries(workTypeCounts)) {
          byWorkType[code] = {
            count,
            name: workTypeNames[code] || code,
          };
        }

        // Build formatted markdown table
        const dateRangeStr = effectiveStartDate === effectiveEndDate
          ? effectiveStartDate
          : `${effectiveStartDate} ถึง ${effectiveEndDate}`;
        const dateTypeStr = dateType === 'appointed' ? 'วันนัดหมาย' : dateType === 'create' ? 'วันสร้าง' : 'วันอัพเดท';

        const formatLines: string[] = [];
        formatLines.push(`## สรุปตั๋วงาน`);
        formatLines.push('');
        formatLines.push(`**ช่วงวันที่:** ${dateRangeStr} (${dateTypeStr})`);
        formatLines.push(`**รวมทั้งหมด:** ${totalCount} งาน`);
        formatLines.push('');
        formatLines.push('| ประเภทงาน | จำนวน |');
        formatLines.push('|-----------|-------|');

        // Sort by count descending
        const sortedWorkTypes = Object.entries(byWorkType).sort((a, b) => b[1].count - a[1].count);
        for (const [, data] of sortedWorkTypes) {
          formatLines.push(`| ${data.name} | ${data.count} |`);
        }

        return {
          success: true,
          data: {
            formatted_summary: formatLines.join('\n'),
            total: totalCount,
            by_work_type: byWorkType,
            date_range: {
              start: effectiveStartDate,
              end: effectiveEndDate,
              type: dateType,
            },
          },
        };
      }

      case 'search_tickets': {
        const query = toolInput.query as string | undefined;
        const workTypeCode = toolInput.work_type_code as string | undefined;
        const statusCode = toolInput.status_code as string | undefined;
        const startDate = toolInput.start_date as string | undefined;
        const endDate = toolInput.end_date as string | undefined;
        const date = toolInput.date as string | undefined; // Single date filter
        const dateType = (toolInput.date_type as string | undefined) || 'appointed'; // created, updated, appointed
        const employeeId = toolInput.employee_id as string | undefined;
        const siteId = toolInput.site_id as string | undefined;
        const provinceCode = toolInput.province_code as number | undefined; // Location filter
        const limit = Math.min((toolInput.limit as number) || DEFAULT_LIMIT, MAX_RESULT_ITEMS);

        // Map date_type to RPC parameter format (matches ticketSearchService.ts)
        const rpcDateType = dateType === 'create' ? 'created' : dateType === 'update' ? 'updated' : 'appointed';

        // Get work_type_id if code is provided
        const workTypeId = workTypeCode ? WORK_TYPE_MAP[workTypeCode] : null;

        // Get status_id if code is provided
        const statusId = statusCode ? STATUS_MAP[statusCode] : null;

        // Calculate date range for single date filter
        let effectiveStartDate = startDate || null;
        let effectiveEndDate = endDate || null;
        if (date) {
          effectiveStartDate = date;
          effectiveEndDate = date;
        }

        // Use RPC search_tickets for server-side filtering (matches ticketSearchService.ts pattern)
        const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
          p_page: 1,
          p_limit: limit,
          p_sort: 'created_at',
          p_order: 'desc',
          p_start_date: effectiveStartDate,
          p_end_date: effectiveEndDate,
          p_date_type: rpcDateType,
          p_site_id: siteId || null,
          p_status_id: statusId,
          p_work_type_id: workTypeId,
          p_assigner_id: null,
          p_contact_id: null,
          p_details: query || null, // Text search on server side
          p_exclude_backlog: false,
          p_only_backlog: false,
          p_employee_id: employeeId || null,
          p_department_id: null,
          p_appointment_is_approved: null,
        });

        if (rpcError) {
          console.error('[ai-tool] RPC search_tickets error:', rpcError.message);
          throw rpcError;
        }

        // Handle empty results
        if (!ticketResults || ticketResults.length === 0) {
          return { success: true, data: [] };
        }

        // Extract ticket IDs
        const ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);

        // Fetch full ticket data for the IDs (including site location)
        const { data: rawTickets, error: ticketError } = await supabase
          .from('main_tickets')
          .select(`
            id,
            details,
            created_at,
            updated_at,
            work_type:ref_ticket_work_types(code, name),
            status:ref_ticket_statuses(code, name),
            site:main_sites(id, name, province_code, district_code, subdistrict_code, company:main_companies(name_th, name_en)),
            appointment:main_appointments(appointment_date, appointment_time_start, appointment_time_end, appointment_type),
            assigner:main_employees!main_tickets_assigner_id_fkey(id, name, code),
            employees:jct_ticket_employees(
              employee:main_employees(id, name, code)
            )
          `)
          .in('id', ticketIds);

        if (ticketError) throw ticketError;

        // Filter by province if specified
        let filteredTickets = rawTickets || [];
        if (provinceCode) {
          filteredTickets = filteredTickets.filter((t: Record<string, unknown>) => {
            const site = t.site as { province_code?: number } | null;
            return site?.province_code === provinceCode;
          });
        }

        // Collect unique location codes for batch lookup
        const provinceCodes = new Set<number>();
        const districtCodes = new Set<number>();
        const subdistrictCodes = new Set<number>();
        for (const ticket of filteredTickets) {
          const site = ticket.site as { province_code?: number; district_code?: number; subdistrict_code?: number } | null;
          if (site?.province_code) provinceCodes.add(site.province_code);
          if (site?.district_code) districtCodes.add(site.district_code);
          if (site?.subdistrict_code) subdistrictCodes.add(site.subdistrict_code);
        }

        // Fetch location names
        const provinceMap = new Map<number, string>();
        const districtMap = new Map<number, string>();
        const subdistrictMap = new Map<number, string>();

        if (provinceCodes.size > 0) {
          const { data: provinces } = await supabase
            .from('ref_provinces')
            .select('id, name_th')
            .in('id', Array.from(provinceCodes));
          for (const p of provinces || []) {
            provinceMap.set(p.id, p.name_th);
          }
        }

        if (districtCodes.size > 0) {
          const { data: districts } = await supabase
            .from('ref_districts')
            .select('id, name_th')
            .in('id', Array.from(districtCodes));
          for (const d of districts || []) {
            districtMap.set(d.id, d.name_th);
          }
        }

        if (subdistrictCodes.size > 0) {
          const { data: subdistricts } = await supabase
            .from('ref_sub_districts')
            .select('id, name_th')
            .in('id', Array.from(subdistrictCodes));
          for (const s of subdistricts || []) {
            subdistrictMap.set(s.id, s.name_th);
          }
        }

        // Sort results to match RPC order, but use filtered tickets if province filter applied
        const ticketMap = new Map((filteredTickets || []).map((t: Record<string, unknown>) => [t.id, t]));
        const orderedTickets = provinceCode
          ? filteredTickets // Already filtered, maintain order
          : ticketIds.map((id: string) => ticketMap.get(id)).filter(Boolean);

        // Transform to display-ready format with location data
        const transformedData = orderedTickets.map((ticket: Record<string, unknown>) => {
          const workType = ticket.work_type as { code?: string; name?: string } | null;
          const status = ticket.status as { code?: string; name?: string } | null;
          const site = ticket.site as {
            id?: string;
            name?: string;
            province_code?: number;
            district_code?: number;
            subdistrict_code?: number;
            company?: { name_th?: string; name_en?: string }
          } | null;
          const appointment = ticket.appointment as {
            appointment_date?: string;
            appointment_time_start?: string;
            appointment_time_end?: string;
            appointment_type?: string;
          } | null;
          const assigner = ticket.assigner as { id?: string; name?: string; code?: string } | null;
          const employeesRaw = ticket.employees as Array<{ employee: { id?: string; name?: string; code?: string } }> | null;

          // Extract employees
          const employees = (employeesRaw || [])
            .filter(e => e.employee)
            .map(e => ({
              id: e.employee.id,
              name: e.employee.name,
              code: e.employee.code,
            }));

          // Get location names
          const province = site?.province_code ? provinceMap.get(site.province_code) || null : null;
          const district = site?.district_code ? districtMap.get(site.district_code) || null : null;
          const subdistrict = site?.subdistrict_code ? subdistrictMap.get(site.subdistrict_code) || null : null;

          return {
            id: ticket.id,
            details: ticket.details || null,
            site_name: site?.name || null,
            company_name: site?.company?.name_th || site?.company?.name_en || null,
            // Location data
            province: province,
            district: district,
            subdistrict: subdistrict,
            province_code: site?.province_code || null,
            // Work type and status
            work_type_code: workType?.code || null,
            work_type_name: workType?.name || null,
            status_code: status?.code || null,
            status_name: status?.name || null,
            appointment_date: appointment?.appointment_date || null,
            appointment_time_start: appointment?.appointment_time_start?.substring(0, 5) || null,
            appointment_time_end: appointment?.appointment_time_end?.substring(0, 5) || null,
            appointment_type: appointment?.appointment_type || null,
            assigner_name: assigner?.name || null,
            employees: employees,
            employee_count: employees.length,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at,
          };
        });

        // Build formatted markdown table
        const formatLines: string[] = [];
        formatLines.push(`## ผลการค้นหาตั๋วงาน`);
        formatLines.push('');
        formatLines.push(`**พบ ${transformedData.length} รายการ**`);
        formatLines.push('');
        formatLines.push('| # | สถานที่ | บริษัท | ประเภท | วันนัด | อำเภอ | จังหวัด | ช่างที่ขอ |');
        formatLines.push('|---|----------|--------|--------|--------|-------|---------|--------|');

        transformedData.forEach((t, idx) => {
          const empNames = t.employees.map((e: { name?: string }) => e.name).filter(Boolean).join(', ') || '-';
          formatLines.push(`| ${idx + 1} | ${t.site_name || '-'} | ${t.company_name || '-'} | ${t.work_type_name || '-'} | ${t.appointment_date || '-'} | ${t.district || '-'} | ${t.province || '-'} | ${empNames} |`);
        });

        return { success: true, data: { formatted_summary: formatLines.join('\n'), tickets: transformedData } };
      }

      case 'get_available_employees': {
        const date = toolInput.date as string;
        const roleCode = toolInput.role_code as string | undefined;
        const departmentId = toolInput.department_id as string | undefined;

        if (!date) {
          return { success: false, error: 'ต้องระบุวันที่ (date)' };
        }

        // Step 1: Get all active technicians (or filtered by role/department)
        let employeeQuery = supabase
          .from('v_employees')
          .select('id, code, name, nickname, email, role_code, role_name_th, department_id, department_name_th')
          .eq('is_active', true);

        // Default to technicians if no role specified
        if (roleCode) {
          employeeQuery = employeeQuery.ilike('role_code', `${roleCode}%`);
        } else {
          // Include all technician levels by default
          employeeQuery = employeeQuery.ilike('role_code', 'technician%');
        }

        if (departmentId) {
          employeeQuery = employeeQuery.eq('department_id', departmentId);
        }

        const { data: allEmployees, error: empError } = await employeeQuery.order('name');

        if (empError) {
          console.error('[ai-tool] get_available_employees - employee query error:', empError.message);
          throw empError;
        }

        if (!allEmployees || allEmployees.length === 0) {
          return {
            success: true,
            data: {
              date,
              total_technicians: 0,
              available_count: 0,
              busy_count: 0,
              available_employees: [],
              busy_employees: [],
            },
          };
        }

        // Step 2: Get all employee IDs that have CONFIRMED assignments on the given date
        // Find tickets with appointments on the specified date where appointment_is_approved = true
        // Use search_tickets RPC to find tickets for the date
        const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
          p_page: 1,
          p_limit: 1000, // Get all tickets for the date
          p_sort: 'created_at',
          p_order: 'desc',
          p_start_date: date,
          p_end_date: date,
          p_date_type: 'appointed',
          p_site_id: null,
          p_status_id: null,
          p_work_type_id: null,
          p_assigner_id: null,
          p_contact_id: null,
          p_details: null,
          p_exclude_backlog: false,
          p_only_backlog: false,
          p_employee_id: null,
          p_department_id: null,
          p_appointment_is_approved: true, // Only confirmed appointments
        });

        if (rpcError) {
          console.error('[ai-tool] get_available_employees - RPC error:', rpcError.message);
          throw rpcError;
        }

        // Step 3: Get employee IDs assigned to those tickets
        const busyEmployeeIds = new Set<string>();
        const busyEmployeeTickets = new Map<string, string[]>(); // employee_id -> ticket details

        if (ticketResults && ticketResults.length > 0) {
          const ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);

          // Get CONFIRMED assigned employees for these tickets
          // Use jct_ticket_employees_cf which contains only confirmed assignments
          const { data: assignments, error: assignError } = await supabase
            .from('jct_ticket_employees_cf')
            .select(`
              employee_id,
              ticket:main_tickets(
                id,
                details,
                site:main_sites(name),
                work_type:ref_ticket_work_types(name)
              )
            `)
            .in('ticket_id', ticketIds);

          if (assignError) {
            console.error('[ai-tool] get_available_employees - assignment query error:', assignError.message);
          } else if (assignments) {
            for (const assignment of assignments) {
              busyEmployeeIds.add(assignment.employee_id);

              // Track what tickets each employee has
              const ticket = assignment.ticket as {
                id?: string;
                details?: string;
                site?: { name?: string };
                work_type?: { name?: string }
              } | null;

              if (ticket) {
                const ticketInfo = `${ticket.work_type?.name || 'งาน'} - ${ticket.site?.name || 'ไม่ระบุสถานที่'}`;
                if (!busyEmployeeTickets.has(assignment.employee_id)) {
                  busyEmployeeTickets.set(assignment.employee_id, []);
                }
                busyEmployeeTickets.get(assignment.employee_id)!.push(ticketInfo);
              }
            }
          }
        }

        // Step 4: Categorize employees into available vs busy
        const availableEmployees: Array<{
          id: string;
          code: string;
          name: string;
          nickname: string | null;
          role: string | null;
          department: string | null;
        }> = [];

        const busyEmployees: Array<{
          id: string;
          code: string;
          name: string;
          nickname: string | null;
          role: string | null;
          department: string | null;
          ticket_count: number;
          tickets: string[];
        }> = [];

        for (const emp of allEmployees) {
          const empData = {
            id: emp.id,
            code: emp.code,
            name: emp.name,
            nickname: emp.nickname || null,
            role: emp.role_name_th || emp.role_code || null,
            department: emp.department_name_th || null,
          };

          if (busyEmployeeIds.has(emp.id)) {
            busyEmployees.push({
              ...empData,
              ticket_count: busyEmployeeTickets.get(emp.id)?.length || 0,
              tickets: busyEmployeeTickets.get(emp.id) || [],
            });
          } else {
            availableEmployees.push(empData);
          }
        }

        // Build formatted markdown table
        const formatLines: string[] = [];
        formatLines.push(`## สถานะช่างวันที่ ${date}`);
        formatLines.push('');
        formatLines.push(`**รวมช่างทั้งหมด:** ${allEmployees.length} คน | **ว่าง:** ${availableEmployees.length} คน | **ไม่ว่าง:** ${busyEmployees.length} คน`);
        formatLines.push('');

        if (availableEmployees.length > 0) {
          formatLines.push('### ช่างว่าง');
          formatLines.push('');
          formatLines.push('| # | รหัส | ชื่อ | ชื่อเล่น | ตำแหน่ง | แผนก |');
          formatLines.push('|---|------|------|----------|---------|------|');
          availableEmployees.forEach((emp, idx) => {
            formatLines.push(`| ${idx + 1} | ${emp.code} | ${emp.name} | ${emp.nickname || '-'} | ${emp.role || '-'} | ${emp.department || '-'} |`);
          });
          formatLines.push('');
        }

        if (busyEmployees.length > 0) {
          formatLines.push('### ช่างไม่ว่าง (มีงานยืนยันแล้ว)');
          formatLines.push('');
          formatLines.push('| # | รหัส | ชื่อ | ชื่อเล่น | จำนวนงาน | งานที่รับ |');
          formatLines.push('|---|------|------|----------|----------|----------|');
          busyEmployees.forEach((emp, idx) => {
            const ticketStr = emp.tickets.join('; ') || '-';
            formatLines.push(`| ${idx + 1} | ${emp.code} | ${emp.name} | ${emp.nickname || '-'} | ${emp.ticket_count} | ${ticketStr} |`);
          });
          formatLines.push('');
        }

        return {
          success: true,
          data: {
            formatted_summary: formatLines.join('\n'),
            date,
            total_technicians: allEmployees.length,
            available_count: availableEmployees.length,
            busy_count: busyEmployees.length,
            available_employees: availableEmployees,
            busy_employees: busyEmployees,
          },
        };
      }

      case 'search_locations': {
        const query = toolInput.query as string | undefined;
        const type = (toolInput.type as string | undefined) || 'province';
        const provinceCode = toolInput.province_code as number | undefined;
        const districtCode = toolInput.district_code as number | undefined;
        const limit = Math.min((toolInput.limit as number) || 20, 77); // 77 provinces max

        if (type === 'province') {
          // Search provinces
          let queryBuilder = supabase
            .from('ref_provinces')
            .select('id, name_th, name_en, geography_id')
            .order('name_th');

          if (query && query.length >= 1) {
            queryBuilder = queryBuilder.or(`name_th.ilike.%${query}%,name_en.ilike.%${query}%`);
          }

          const { data, error } = await queryBuilder.limit(limit);
          if (error) throw error;

          const transformedData = (data || []).map(p => ({
            code: p.id,
            name_th: p.name_th,
            name_en: p.name_en,
            type: 'province',
          }));

          return { success: true, data: transformedData };
        }

        if (type === 'district') {
          // Search districts
          let queryBuilder = supabase
            .from('ref_districts')
            .select('id, name_th, name_en, province_id')
            .order('name_th');

          if (query && query.length >= 1) {
            queryBuilder = queryBuilder.or(`name_th.ilike.%${query}%,name_en.ilike.%${query}%`);
          }

          if (provinceCode) {
            queryBuilder = queryBuilder.eq('province_id', provinceCode);
          }

          const { data, error } = await queryBuilder.limit(limit);
          if (error) throw error;

          // Get province names for context
          const provinceIds = [...new Set((data || []).map(d => d.province_id))];
          const provinceMap = new Map<number, string>();
          if (provinceIds.length > 0) {
            const { data: provinces } = await supabase
              .from('ref_provinces')
              .select('id, name_th')
              .in('id', provinceIds);
            for (const p of provinces || []) {
              provinceMap.set(p.id, p.name_th);
            }
          }

          const transformedData = (data || []).map(d => ({
            code: d.id,
            name_th: d.name_th,
            name_en: d.name_en,
            type: 'district',
            province_code: d.province_id,
            province_name: provinceMap.get(d.province_id) || null,
          }));

          return { success: true, data: transformedData };
        }

        if (type === 'subdistrict') {
          // Search subdistricts
          let queryBuilder = supabase
            .from('ref_sub_districts')
            .select('id, name_th, name_en, district_id, zip_code')
            .order('name_th');

          if (query && query.length >= 1) {
            queryBuilder = queryBuilder.or(`name_th.ilike.%${query}%,name_en.ilike.%${query}%`);
          }

          if (districtCode) {
            queryBuilder = queryBuilder.eq('district_id', districtCode);
          }

          const { data, error } = await queryBuilder.limit(limit);
          if (error) throw error;

          // Get district and province names
          const districtIds = [...new Set((data || []).map(s => s.district_id))];
          const districtMap = new Map<number, { name: string; province_id: number }>();
          if (districtIds.length > 0) {
            const { data: districts } = await supabase
              .from('ref_districts')
              .select('id, name_th, province_id')
              .in('id', districtIds);
            for (const d of districts || []) {
              districtMap.set(d.id, { name: d.name_th, province_id: d.province_id });
            }
          }

          const provinceIds = [...new Set(Array.from(districtMap.values()).map(d => d.province_id))];
          const provinceMap = new Map<number, string>();
          if (provinceIds.length > 0) {
            const { data: provinces } = await supabase
              .from('ref_provinces')
              .select('id, name_th')
              .in('id', provinceIds);
            for (const p of provinces || []) {
              provinceMap.set(p.id, p.name_th);
            }
          }

          const transformedData = (data || []).map(s => {
            const district = districtMap.get(s.district_id);
            return {
              code: s.id,
              name_th: s.name_th,
              name_en: s.name_en,
              type: 'subdistrict',
              district_code: s.district_id,
              district_name: district?.name || null,
              province_code: district?.province_id || null,
              province_name: district ? provinceMap.get(district.province_id) || null : null,
              zip_code: s.zip_code || null,
            };
          });

          return { success: true, data: transformedData };
        }

        return { success: false, error: 'ประเภทสถานที่ไม่ถูกต้อง (province, district, subdistrict)' };
      }

      case 'get_ticket_summary_by_location': {
        const date = toolInput.date as string | undefined;
        const startDate = toolInput.start_date as string | undefined;
        const endDate = toolInput.end_date as string | undefined;
        const dateType = (toolInput.date_type as string | undefined) || 'appointed';
        const workTypeCode = toolInput.work_type_code as string | undefined;

        // Map date_type to RPC parameter format
        const rpcDateType = dateType === 'create' ? 'created' : dateType === 'update' ? 'updated' : 'appointed';

        // Get work_type_id if code is provided
        const workTypeId = workTypeCode ? WORK_TYPE_MAP[workTypeCode] : null;

        // Calculate date range
        let effectiveStartDate = startDate || null;
        let effectiveEndDate = endDate || null;
        if (date) {
          effectiveStartDate = date;
          effectiveEndDate = date;
        }

        // Use RPC to get ticket IDs
        const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
          p_page: 1,
          p_limit: 1000,
          p_sort: 'created_at',
          p_order: 'desc',
          p_start_date: effectiveStartDate,
          p_end_date: effectiveEndDate,
          p_date_type: rpcDateType,
          p_site_id: null,
          p_status_id: null,
          p_work_type_id: workTypeId,
          p_assigner_id: null,
          p_contact_id: null,
          p_details: null,
          p_exclude_backlog: false,
          p_only_backlog: false,
          p_employee_id: null,
          p_department_id: null,
          p_appointment_is_approved: null,
        });

        if (rpcError) {
          console.error('[ai-tool] RPC get_ticket_summary_by_location error:', rpcError.message);
          throw rpcError;
        }

        const totalCount = ticketResults?.[0]?.total_count || 0;

        if (!ticketResults || ticketResults.length === 0) {
          return {
            success: true,
            data: {
              total: 0,
              by_province: [],
              date_range: { start: effectiveStartDate, end: effectiveEndDate, type: dateType },
            },
          };
        }

        // Get ticket IDs
        const ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);

        // Fetch tickets with site province info
        const { data: tickets, error: ticketError } = await supabase
          .from('main_tickets')
          .select('id, site:main_sites(province_code)')
          .in('id', ticketIds);

        if (ticketError) throw ticketError;

        // Count by province
        const provinceCounts = new Map<number, number>();
        let noProvince = 0;

        for (const ticket of tickets || []) {
          const site = ticket.site as { province_code?: number } | null;
          if (site?.province_code) {
            provinceCounts.set(site.province_code, (provinceCounts.get(site.province_code) || 0) + 1);
          } else {
            noProvince++;
          }
        }

        // Get province names
        const provinceCodes = Array.from(provinceCounts.keys());
        const provinceMap = new Map<number, string>();
        if (provinceCodes.length > 0) {
          const { data: provinces } = await supabase
            .from('ref_provinces')
            .select('id, name_th')
            .in('id', provinceCodes);
          for (const p of provinces || []) {
            provinceMap.set(p.id, p.name_th);
          }
        }

        // Format by_province array sorted by count descending
        const byProvince = Array.from(provinceCounts.entries())
          .map(([code, count]) => ({
            province_code: code,
            province_name: provinceMap.get(code) || `จังหวัดรหัส ${code}`,
            count,
          }))
          .sort((a, b) => b.count - a.count);

        // Add "no province" if any
        if (noProvince > 0) {
          byProvince.push({
            province_code: 0,
            province_name: 'ไม่ระบุจังหวัด',
            count: noProvince,
          });
        }

        // Build formatted markdown table
        const dateRangeStr = effectiveStartDate === effectiveEndDate
          ? effectiveStartDate
          : `${effectiveStartDate} ถึง ${effectiveEndDate}`;
        const dateTypeStr = dateType === 'appointed' ? 'วันนัดหมาย' : dateType === 'create' ? 'วันสร้าง' : 'วันอัพเดท';

        const formatLines: string[] = [];
        formatLines.push(`## สรุปตั๋วงานตามจังหวัด`);
        formatLines.push('');
        formatLines.push(`**ช่วงวันที่:** ${dateRangeStr} (${dateTypeStr})`);
        formatLines.push(`**รวมทั้งหมด:** ${totalCount} งาน`);
        formatLines.push('');
        formatLines.push('| # | จังหวัด | จำนวน |');
        formatLines.push('|---|---------|-------|');

        byProvince.forEach((p, idx) => {
          formatLines.push(`| ${idx + 1} | ${p.province_name} | ${p.count} |`);
        });

        return {
          success: true,
          data: {
            formatted_summary: formatLines.join('\n'),
            total: totalCount,
            by_province: byProvince,
            date_range: {
              start: effectiveStartDate,
              end: effectiveEndDate,
              type: dateType,
            },
          },
        };
      }

      case 'suggest_routes': {
        const date = toolInput.date as string;
        const maxTicketsPerRoute = toolInput.max_tickets_per_route as number | undefined;
        const includeAssigned = toolInput.include_assigned !== false; // default true

        if (!date) {
          return { success: false, error: 'ต้องระบุวันที่ (date)' };
        }

        // Office coordinates (Pace Design, Samut Prakan)
        const OFFICE_LAT = 13.7309715;
        const OFFICE_LNG = 100.7318956;
        const BANGKOK_PROVINCE_CODE = 10;

        // Helper: Calculate distance between two points (Haversine formula)
        const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
          const R = 6371; // Earth's radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        // Get tickets for the date
        const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
          p_page: 1,
          p_limit: 100,
          p_sort: 'created_at',
          p_order: 'desc',
          p_start_date: date,
          p_end_date: date,
          p_date_type: 'appointed',
          p_site_id: null,
          p_status_id: null,
          p_work_type_id: null,
          p_assigner_id: null,
          p_contact_id: null,
          p_details: null,
          p_exclude_backlog: false,
          p_only_backlog: false,
          p_employee_id: null,
          p_department_id: null,
          p_appointment_is_approved: includeAssigned ? null : false,
        });

        if (rpcError) {
          console.error('[ai-tool] suggest_routes RPC error:', rpcError.message);
          throw rpcError;
        }

        if (!ticketResults || ticketResults.length === 0) {
          return {
            success: true,
            data: {
              date,
              message: 'ไม่มีตั๋วงานในวันที่กำหนด',
              routes: [],
              summary: { total_tickets: 0, total_routes: 0, unassignable: 0 },
            },
          };
        }

        const ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);

        // Get ticket details: ticket -> site (location) -> company (display name) -> appointment
        // Fetch both requested (jct_ticket_employees) and confirmed (jct_ticket_employees_cf) technicians
        // Note: jct_ticket_employees_cf has two FKs to main_employees (employee_id, confirmed_by)
        // We need to use foreign key hint !inner or specify the column
        const { data: tickets, error: ticketError } = await supabase
          .from('main_tickets')
          .select(`
            id,
            details,
            work_type:ref_ticket_work_types(code, name),
            assigner:main_employees!main_tickets_created_by_fkey(name),
            appointment:main_appointments(appointment_type, appointment_time_start, appointment_time_end),
            site:main_sites(
              id, name, district_code, province_code,
              company:main_companies(name_th)
            ),
            requested_employees:jct_ticket_employees(employee:main_employees(id, name)),
            confirmed_employees:jct_ticket_employees_cf(employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name))
          `)
          .in('id', ticketIds);

        if (ticketError) throw ticketError;

        // Get district coordinates
        const districtCodes = [...new Set((tickets || []).map((t: Record<string, unknown>) => {
          const site = t.site as { district_code?: number } | null;
          return site?.district_code;
        }).filter(Boolean))] as number[];

        const districtMap = new Map<number, { lat: number; lng: number; name: string }>();
        if (districtCodes.length > 0) {
          const { data: districts } = await supabase
            .from('ref_districts')
            .select('id, name_th, latitude, longitude')
            .in('id', districtCodes);

          for (const d of districts || []) {
            if (d.latitude && d.longitude) {
              districtMap.set(d.id, { lat: d.latitude, lng: d.longitude, name: d.name_th });
            }
          }
        }

        // Get province names
        const provinceCodes = [...new Set((tickets || []).map((t: Record<string, unknown>) => {
          const site = t.site as { province_code?: number } | null;
          return site?.province_code;
        }).filter(Boolean))] as number[];

        const provinceMap = new Map<number, string>();
        if (provinceCodes.length > 0) {
          const { data: provinces } = await supabase
            .from('ref_provinces')
            .select('id, name_th')
            .in('id', provinceCodes);
          for (const p of provinces || []) {
            provinceMap.set(p.id, p.name_th);
          }
        }

        // Helper to format appointment type to Thai display
        const formatAppointmentType = (
          type: string | null,
          timeStart: string | null,
          timeEnd: string | null
        ): string => {
          if (!type) return '-';
          switch (type) {
            case 'time_range':
              if (timeStart && timeEnd) return `${timeStart.slice(0, 5)}-${timeEnd.slice(0, 5)}`;
              if (timeStart) return timeStart.slice(0, 5);
              return 'ระบุเวลา';
            case 'full_day':
              return 'ทั้งวัน';
            case 'half_morning':
              return 'ครึ่งเช้า';
            case 'half_afternoon':
              return 'ครึ่งบ่าย';
            case 'call_to_schedule':
              return 'โทรนัด';
            default:
              return type;
          }
        };

        // Build ticket list: location from site, company name for display
        interface TicketWithLocation {
          id: string;
          site_name: string;
          company_name: string | null;
          details: string | null;
          assigner: string | null;
          appointment_display: string;
          work_type: string;
          work_type_name: string;
          district: string;
          province: string;
          province_code: number;
          lat: number | null;
          lng: number | null;
          requested_employees: string[];
          confirmed_employees: string[];
          distance_from_office: number;
        }

        const ticketsWithLocation: TicketWithLocation[] = [];
        const ticketsNoLocation: Array<{ id: string; site_name: string; reason: string }> = [];

        for (const ticket of tickets || []) {
          // ticket -> site (location: district_code, province_code) -> company (name)
          const site = ticket.site as {
            id?: string;
            name?: string;
            district_code?: number;
            province_code?: number;
            company?: { name_th?: string };
          } | null;
          const workType = ticket.work_type as { code?: string; name?: string } | null;
          const assigner = ticket.assigner as { name?: string } | null;
          const appointment = ticket.appointment as {
            appointment_type?: string;
            appointment_time_start?: string;
            appointment_time_end?: string;
          } | null;
          const requestedEmps = ticket.requested_employees as Array<{ employee: { id?: string; name?: string } }> | null;
          const confirmedEmps = ticket.confirmed_employees as Array<{ employee: { id?: string; name?: string } }> | null;

          // Format appointment display
          const appointmentDisplay = formatAppointmentType(
            appointment?.appointment_type || null,
            appointment?.appointment_time_start || null,
            appointment?.appointment_time_end || null
          );

          // Location strictly from SITE's district_code and province_code
          const districtCode = site?.district_code;
          const provinceCode = site?.province_code || 0;
          const districtInfo = districtCode ? districtMap.get(districtCode) : null;

          if (districtInfo?.lat && districtInfo?.lng) {
            const distFromOffice = haversineDistance(OFFICE_LAT, OFFICE_LNG, districtInfo.lat, districtInfo.lng);
            ticketsWithLocation.push({
              id: ticket.id as string,
              site_name: site?.name || 'ไม่ระบุ',
              company_name: site?.company?.name_th || null,
              details: (ticket.details as string) || null,
              assigner: assigner?.name || null,
              appointment_display: appointmentDisplay,
              work_type: workType?.code || 'unknown',
              work_type_name: workType?.name || 'ไม่ระบุ',
              district: districtInfo.name,
              province: provinceMap.get(provinceCode) || 'ไม่ระบุ',
              province_code: provinceCode,
              lat: districtInfo.lat,
              lng: districtInfo.lng,
              requested_employees: (requestedEmps || []).map(e => e.employee?.name || '').filter(Boolean),
              confirmed_employees: (confirmedEmps || []).map(e => e.employee?.name || '').filter(Boolean),
              distance_from_office: distFromOffice,
            });
          } else {
            ticketsNoLocation.push({
              id: ticket.id as string,
              site_name: site?.name || 'ไม่ระบุ',
              reason: 'ไม่มีพิกัดอำเภอ (site district_code ไม่มีในระบบ)',
            });
          }
        }

        // Clustering: Group by confirmed technicians first, then geographic proximity
        // Step 1: Group tickets by their confirmed technician team
        const teamClusters = new Map<string, TicketWithLocation[]>();
        const unassignedTickets: TicketWithLocation[] = [];

        for (const ticket of ticketsWithLocation) {
          if (ticket.confirmed_employees.length > 0) {
            // Create team key from sorted employee names (same team = same key)
            const teamKey = [...ticket.confirmed_employees].sort().join('|');
            if (!teamClusters.has(teamKey)) {
              teamClusters.set(teamKey, []);
            }
            teamClusters.get(teamKey)!.push(ticket);
          } else {
            // No confirmed technicians - will be grouped geographically
            unassignedTickets.push(ticket);
          }
        }

        // Step 2: Convert team clusters to array
        const clusters: TicketWithLocation[][] = [];
        for (const [_teamKey, tickets] of teamClusters) {
          clusters.push(tickets);
        }

        // Step 3: Group remaining unassigned tickets by geographic proximity
        while (unassignedTickets.length > 0) {
          // Find furthest unassigned ticket from office (start route from furthest point)
          unassignedTickets.sort((a, b) => b.distance_from_office - a.distance_from_office);
          const seed = unassignedTickets.shift()!;
          const cluster: TicketWithLocation[] = [seed];

          // Determine max size based on Bangkok vs outside
          const isBangkokCluster = seed.province_code === BANGKOK_PROVINCE_CODE;
          const maxSize = maxTicketsPerRoute || (isBangkokCluster ? 6 : 4);

          // Add nearby tickets to cluster
          while (cluster.length < maxSize && unassignedTickets.length > 0) {
            // Find closest unassigned ticket to any ticket in cluster
            let bestIdx = -1;
            let bestDist = Infinity;

            for (let i = 0; i < unassignedTickets.length; i++) {
              for (const clusterTicket of cluster) {
                if (unassignedTickets[i].lat && unassignedTickets[i].lng && clusterTicket.lat && clusterTicket.lng) {
                  const dist = haversineDistance(
                    clusterTicket.lat, clusterTicket.lng,
                    unassignedTickets[i].lat, unassignedTickets[i].lng
                  );
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                  }
                }
              }
            }

            // Only add if within reasonable distance (30km for outside BKK, 15km for BKK)
            const maxDist = isBangkokCluster ? 15 : 30;
            if (bestIdx >= 0 && bestDist <= maxDist) {
              cluster.push(unassignedTickets.splice(bestIdx, 1)[0]);
            } else {
              break; // No more nearby tickets
            }
          }

          clusters.push(cluster);
        }

        // Order each cluster using nearest-neighbor starting from office
        const orderCluster = (cluster: TicketWithLocation[]): TicketWithLocation[] => {
          if (cluster.length <= 1) return cluster;

          const ordered: TicketWithLocation[] = [];
          const remaining = [...cluster];

          // Start from office
          let currentLat = OFFICE_LAT;
          let currentLng = OFFICE_LNG;

          while (remaining.length > 0) {
            let bestIdx = 0;
            let bestDist = Infinity;

            for (let i = 0; i < remaining.length; i++) {
              if (remaining[i].lat && remaining[i].lng) {
                const dist = haversineDistance(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestIdx = i;
                }
              }
            }

            const next = remaining.splice(bestIdx, 1)[0];
            ordered.push(next);
            currentLat = next.lat || currentLat;
            currentLng = next.lng || currentLng;
          }

          return ordered;
        };

        // Build route suggestions
        const routes = clusters.map((cluster, idx) => {
          const orderedCluster = orderCluster(cluster);
          const isBangkok = orderedCluster[0]?.province_code === BANGKOK_PROVINCE_CODE;

          // Calculate total distance for route
          let totalDistance = 0;
          let prevLat = OFFICE_LAT;
          let prevLng = OFFICE_LNG;
          for (const t of orderedCluster) {
            if (t.lat && t.lng) {
              totalDistance += haversineDistance(prevLat, prevLng, t.lat, t.lng);
              prevLat = t.lat;
              prevLng = t.lng;
            }
          }
          // Add return to office
          totalDistance += haversineDistance(prevLat, prevLng, OFFICE_LAT, OFFICE_LNG);

          // Determine area name
          const provinces = [...new Set(orderedCluster.map(t => t.province))];
          const districts = [...new Set(orderedCluster.map(t => t.district))];
          const areaName = provinces.length === 1
            ? `${provinces[0]} (${districts.slice(0, 3).join(', ')}${districts.length > 3 ? '...' : ''})`
            : provinces.join(' - ');

          // Get team name from confirmed employees (if all have same team)
          const teamMembers = [...new Set(orderedCluster.flatMap(t => t.confirmed_employees))];
          const teamName = teamMembers.length > 0 ? teamMembers.join(', ') : null;

          // Suggest technician count based on actual team or estimate
          const suggestedTechnicians = teamMembers.length > 0
            ? teamMembers.length
            : (totalDistance > 100 || orderedCluster.length >= 5 ? 2 : 1);

          return {
            route_number: idx + 1,
            area: areaName,
            team: teamName,
            is_bangkok: isBangkok,
            ticket_count: orderedCluster.length,
            estimated_distance_km: Math.round(totalDistance),
            suggested_technicians: suggestedTechnicians,
            tickets: orderedCluster.map((t, order) => ({
              order: order + 1,
              ticket_id: t.id,
              site_name: t.site_name,
              company_name: t.company_name,
              details: t.details,
              assigner: t.assigner,
              appointment_display: t.appointment_display,
              work_type: t.work_type_name,
              district: t.district,
              province: t.province,
              requested_technicians: t.requested_employees.length > 0 ? t.requested_employees : null,
              confirmed_technicians: t.confirmed_employees.length > 0 ? t.confirmed_employees : null,
            })),
          };
        });

        // Build formatted markdown summary for AI to display
        const formatLines: string[] = [];
        formatLines.push(`## การจัดสายงานวันที่ ${date}`);
        formatLines.push('');

        // Count assigned vs unassigned routes
        const assignedRoutes = routes.filter(r => r.team);
        const unassignedRoutes = routes.filter(r => !r.team);
        const assignedTicketCount = assignedRoutes.reduce((sum, r) => sum + r.ticket_count, 0);
        const unassignedTicketCount = unassignedRoutes.reduce((sum, r) => sum + r.ticket_count, 0);

        formatLines.push(`**รวม ${ticketsWithLocation.length} งาน จัดเป็น ${routes.length} สาย**`);
        if (assignedRoutes.length > 0) {
          formatLines.push(`- มอบหมายแล้ว: ${assignedTicketCount} งาน (${assignedRoutes.length} สาย)`);
        }
        if (unassignedRoutes.length > 0) {
          formatLines.push(`- ยังไม่มอบหมาย: ${unassignedTicketCount} งาน (${unassignedRoutes.length} สาย) *แนะนำจัดกลุ่มตามพื้นที่*`);
        }
        formatLines.push('');

        for (const route of routes) {
          const teamDisplay = route.team ? ` [${route.team}]` : ' [แนะนำ - ยังไม่มอบหมาย]';
          formatLines.push(`### สาย ${route.route_number}: ${route.area}${teamDisplay}`);
          formatLines.push(`> ${route.ticket_count} งาน | ~${route.estimated_distance_km} กม. | ช่าง ${route.suggested_technicians} คน`);
          formatLines.push('');
          formatLines.push('| # | สถานที่ | บริษัท | รายละเอียด | ประเภท | เวลานัด | ผู้มอบหมาย | ช่างที่ขอ | ช่างที่ยืนยัน |');
          formatLines.push('|---|----------|--------|------------|--------|---------|-----------|----------|-------------|');

          for (const ticket of route.tickets) {
            const requestedStr = ticket.requested_technicians ? ticket.requested_technicians.join(', ') : '-';
            const confirmedStr = ticket.confirmed_technicians ? ticket.confirmed_technicians.join(', ') : '-';
            const siteName = ticket.site_name;
            const companyName = ticket.company_name || '-';
            const details = ticket.details || '-';
            const appointmentStr = ticket.appointment_display || '-';
            const assignerStr = ticket.assigner || '-';
            formatLines.push(`| ${ticket.order} | ${siteName} | ${companyName} | ${details} | ${ticket.work_type} | ${appointmentStr} | ${assignerStr} | ${requestedStr} | ${confirmedStr} |`);
          }
          formatLines.push('');
        }

        if (ticketsNoLocation.length > 0) {
          formatLines.push('### ไม่สามารถจัดสายได้');
          formatLines.push('');
          formatLines.push('| สถานที่ | เหตุผล |');
          formatLines.push('|----------|--------|');
          for (const t of ticketsNoLocation) {
            formatLines.push(`| ${t.site_name} | ${t.reason} |`);
          }
          formatLines.push('');
        }

        formatLines.push('---');
        formatLines.push(`**ระยะทางรวมประมาณ ${routes.reduce((sum, r) => sum + r.estimated_distance_km, 0)} กม.**`);
        formatLines.push('');
        formatLines.push('> **หมายเหตุ:** การจัดสายนี้เป็นเพียงข้อเสนอแนะเบื้องต้นจากระบบ AI โปรดพิจารณาปรับเปลี่ยนตามความเหมาะสมของสถานการณ์จริง');

        return {
          success: true,
          data: {
            date,
            formatted_summary: formatLines.join('\n'),
            routes,
            unassignable: ticketsNoLocation,
            summary: {
              total_tickets: ticketsWithLocation.length + ticketsNoLocation.length,
              routed_tickets: ticketsWithLocation.length,
              total_routes: routes.length,
              unassignable_count: ticketsNoLocation.length,
              total_estimated_distance_km: routes.reduce((sum, r) => sum + r.estimated_distance_km, 0),
            },
          },
        };
      }

      case 'get_ticket_details': {
        const inputTicketId = toolInput.ticket_id as string;
        const includeAttachments = toolInput.include_attachments !== false; // default true
        const includeComments = toolInput.include_comments !== false; // default true
        const includeAuditLog = toolInput.include_audit_log !== false; // default true
        const commentsLimit = Math.min((toolInput.comments_limit as number) || 20, 50);
        const auditLimit = Math.min((toolInput.audit_limit as number) || 20, 50);

        if (!inputTicketId) {
          return { success: false, error: 'ต้องระบุ ticket_id' };
        }

        // Helper to extract UUID prefix from potentially formatted string
        const extractUUIDPrefix = (value: string): string | null => {
          const cleaned = value.replace(/[\[\]"'.\s]/g, '').replace(/\.{2,}/g, '');
          const uuidMatch = cleaned.match(/^[0-9a-fA-F-]+/);
          if (!uuidMatch) return null;
          const uuidPart = uuidMatch[0].replace(/-+$/, '');
          const hexOnly = uuidPart.replace(/-/g, '');
          return hexOnly.length >= 4 ? uuidPart : null;
        };

        // Resolve ticket ID (may be partial UUID)
        let ticketId = inputTicketId;
        if (inputTicketId.length < 36) {
          const prefix = extractUUIDPrefix(inputTicketId);
          if (prefix) {
            // Use filter with text cast for UUID column
            const { data: matchingTickets } = await supabase
              .from('main_tickets')
              .select('id')
              .filter('id::text', 'ilike', `${prefix}%`)
              .limit(1);

            if (matchingTickets && matchingTickets.length > 0) {
              ticketId = matchingTickets[0].id;
              console.log(`[ai-tool] get_ticket_details resolved "${inputTicketId}" -> ${ticketId}`);
            } else {
              return { success: false, error: `ไม่พบตั๋วงานที่มี ID: ${inputTicketId}` };
            }
          } else {
            return { success: false, error: `รูปแบบ ID ตั๋วงานไม่ถูกต้อง: ${inputTicketId}` };
          }
        }

        // Get basic ticket info
        const { data: ticket, error: ticketError } = await supabase
          .from('main_tickets')
          .select(`
            id,
            details,
            created_at,
            updated_at,
            work_type:ref_ticket_work_types(code, name),
            status:ref_ticket_statuses(code, name),
            site:main_sites(id, name, company:main_companies(name_th, name_en)),
            appointment:main_appointments(appointment_date, appointment_time_start, appointment_time_end, appointment_type, is_approved),
            assigner:main_employees!main_tickets_assigner_id_fkey(id, name),
            creator:main_employees!main_tickets_created_by_fkey(id, name),
            employees:jct_ticket_employees(employee:main_employees(id, name)),
            confirmed_employees:jct_ticket_employees_cf(employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name))
          `)
          .eq('id', ticketId)
          .single();

        if (ticketError || !ticket) {
          return { success: false, error: `ไม่พบตั๋วงาน: ${ticketId}` };
        }

        // Build result object
        const result: Record<string, unknown> = {
          ticket: {
            id: ticket.id,
            details: ticket.details,
            work_type: (ticket.work_type as { name?: string })?.name || null,
            status: (ticket.status as { name?: string })?.name || null,
            site_name: (ticket.site as { name?: string })?.name || null,
            company_name: (ticket.site as { company?: { name_th?: string } })?.company?.name_th || null,
            appointment_date: (ticket.appointment as { appointment_date?: string })?.appointment_date || null,
            is_approved: (ticket.appointment as { is_approved?: boolean })?.is_approved || false,
            assigner: (ticket.assigner as { name?: string })?.name || null,
            creator: (ticket.creator as { name?: string })?.name || null,
            requested_employees: ((ticket.employees as Array<{ employee: { name?: string } }>) || [])
              .map(e => e.employee?.name).filter(Boolean),
            confirmed_employees: ((ticket.confirmed_employees as Array<{ employee: { name?: string } }>) || [])
              .map(e => e.employee?.name).filter(Boolean),
            created_at: ticket.created_at,
            updated_at: ticket.updated_at,
          },
        };

        // Get attachments (photos + files)
        if (includeAttachments) {
          const { data: photos } = await supabase
            .from('child_ticket_photos')
            .select('id, image_url, caption, display_order, uploaded_by, created_at, uploader:main_employees!child_ticket_photos_uploaded_by_fkey(name)')
            .eq('ticket_id', ticketId)
            .order('display_order');

          const { data: files } = await supabase
            .from('child_ticket_files')
            .select('id, file_url, file_name, file_size, mime_type, uploaded_by, created_at, uploader:main_employees!child_ticket_files_uploaded_by_fkey(name)')
            .eq('ticket_id', ticketId)
            .order('created_at');

          result.attachments = {
            photos: (photos || []).map(p => ({
              id: p.id,
              url: p.image_url,
              caption: p.caption || null,
              uploaded_by: (p.uploader as { name?: string })?.name || null,
              created_at: p.created_at,
            })),
            files: (files || []).map(f => ({
              id: f.id,
              url: f.file_url,
              name: f.file_name,
              size_kb: f.file_size ? Math.round(f.file_size / 1024) : null,
              type: f.mime_type || null,
              uploaded_by: (f.uploader as { name?: string })?.name || null,
              created_at: f.created_at,
            })),
            total_photos: (photos || []).length,
            total_files: (files || []).length,
          };
        }

        // Get comments with their attachments
        if (includeComments) {
          const { data: comments } = await supabase
            .from('child_ticket_comments')
            .select(`
              id,
              content,
              is_edited,
              created_at,
              updated_at,
              author:main_employees!child_ticket_comments_author_id_fkey(id, name),
              photos:child_comment_photos(id, image_url, display_order),
              files:child_comment_files(id, file_url, file_name, file_size)
            `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false })
            .limit(commentsLimit);

          result.comments = (comments || []).map(c => ({
            id: c.id,
            content: c.content,
            author: (c.author as { name?: string })?.name || null,
            is_edited: c.is_edited || false,
            created_at: c.created_at,
            photos: ((c.photos as Array<{ image_url?: string }>) || []).map(p => p.image_url),
            files: ((c.files as Array<{ file_name?: string; file_url?: string }>) || []).map(f => ({
              name: f.file_name,
              url: f.file_url,
            })),
          }));
          result.total_comments = (comments || []).length;
        }

        // Get audit log
        if (includeAuditLog) {
          // Action labels in Thai
          const actionLabels: Record<string, string> = {
            created: 'สร้างตั๋วงาน',
            updated: 'แก้ไขตั๋วงาน',
            deleted: 'ลบตั๋วงาน',
            approved: 'อนุมัติ',
            unapproved: 'ยกเลิกอนุมัติ',
            technician_confirmed: 'ยืนยันช่าง',
            technician_changed: 'เปลี่ยนช่าง',
            employee_assigned: 'มอบหมายช่าง',
            employee_removed: 'ถอดช่างออก',
            work_giver_set: 'กำหนดผู้ว่าจ้าง',
            work_giver_changed: 'เปลี่ยนผู้ว่าจ้าง',
            comment_added: 'เพิ่มคอมเมนต์',
          };

          const { data: auditLogs } = await supabase
            .from('child_ticket_audit')
            .select(`
              id,
              action,
              changed_fields,
              old_values,
              new_values,
              metadata,
              created_at,
              actor:main_employees!child_ticket_audit_changed_by_fkey(id, name)
            `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false })
            .limit(auditLimit);

          result.audit_log = (auditLogs || []).map(log => ({
            id: log.id,
            action: log.action,
            action_label: actionLabels[log.action as string] || log.action,
            actor: (log.actor as { name?: string })?.name || null,
            changed_fields: log.changed_fields || null,
            changes: log.changed_fields ? {
              old: log.old_values,
              new: log.new_values,
            } : null,
            metadata: log.metadata || null,
            created_at: log.created_at,
          }));
          result.total_audit_entries = (auditLogs || []).length;
        }

        // Build formatted markdown summary
        const formatLines: string[] = [];
        const t = result.ticket as Record<string, unknown>;
        formatLines.push(`## รายละเอียดตั๋วงาน`);
        formatLines.push('');
        formatLines.push(`**ID:** ${(t.id as string).slice(0, 8)}...`);
        formatLines.push(`**สถานที่:** ${t.site_name || '-'} (${t.company_name || '-'})`);
        formatLines.push(`**ประเภทงาน:** ${t.work_type || '-'}`);
        formatLines.push(`**สถานะ:** ${t.status || '-'} | **อนุมัติ:** ${t.is_approved ? '✅ ใช่' : '❌ ไม่'}`);
        formatLines.push(`**วันนัด:** ${t.appointment_date || 'ยังไม่กำหนด'}`);
        formatLines.push(`**รายละเอียด:** ${t.details || '-'}`);
        formatLines.push(`**ผู้มอบหมาย:** ${t.assigner || '-'} | **ผู้สร้าง:** ${t.creator || '-'}`);
        formatLines.push(`**ช่างที่ขอ:** ${(t.requested_employees as string[])?.join(', ') || '-'}`);
        formatLines.push(`**ช่างที่ยืนยัน:** ${(t.confirmed_employees as string[])?.join(', ') || '-'}`);
        formatLines.push('');

        if (includeAttachments) {
          const att = result.attachments as { total_photos: number; total_files: number; photos: Array<{ caption?: string; url?: string }>; files: Array<{ name?: string }> };
          formatLines.push(`### ไฟล์แนบ (${att.total_photos} รูป, ${att.total_files} ไฟล์)`);
          if (att.total_photos > 0) {
            formatLines.push('**รูปภาพ:**');
            att.photos.forEach((p, i) => {
              formatLines.push(`${i + 1}. ${p.caption || 'รูปภาพ'}`);
            });
          }
          if (att.total_files > 0) {
            formatLines.push('**ไฟล์:**');
            att.files.forEach((f, i) => {
              formatLines.push(`${i + 1}. ${f.name}`);
            });
          }
          if (att.total_photos === 0 && att.total_files === 0) {
            formatLines.push('ไม่มีไฟล์แนบ');
          }
          formatLines.push('');
        }

        if (includeComments) {
          const totalComments = result.total_comments as number;
          formatLines.push(`### ความคิดเห็น (${totalComments} รายการ)`);
          if (totalComments > 0) {
            const comments = result.comments as Array<{ author?: string; content?: string; created_at?: string; is_edited?: boolean }>;
            comments.forEach((c, i) => {
              const editedMark = c.is_edited ? ' (แก้ไขแล้ว)' : '';
              formatLines.push(`**${i + 1}. ${c.author || 'ไม่ระบุ'}** - ${c.created_at?.slice(0, 10)}${editedMark}`);
              formatLines.push(`> ${c.content}`);
              formatLines.push('');
            });
          } else {
            formatLines.push('ไม่มีความคิดเห็น');
          }
          formatLines.push('');
        }

        if (includeAuditLog) {
          const totalAudit = result.total_audit_entries as number;
          formatLines.push(`### ประวัติการเปลี่ยนแปลง (${totalAudit} รายการ)`);
          if (totalAudit > 0) {
            formatLines.push('| # | วันที่ | ผู้ดำเนินการ | การกระทำ |');
            formatLines.push('|---|--------|--------------|----------|');
            const logs = result.audit_log as Array<{ created_at?: string; actor?: string; action_label?: string }>;
            logs.forEach((log, i) => {
              const date = log.created_at?.slice(0, 16).replace('T', ' ') || '-';
              formatLines.push(`| ${i + 1} | ${date} | ${log.actor || '-'} | ${log.action_label || '-'} |`);
            });
          } else {
            formatLines.push('ไม่มีประวัติ');
          }
        }

        result.formatted_summary = formatLines.join('\n');

        return { success: true, data: result };
      }

      case 'review_ticket_safety': {
        const inputTicketId = toolInput.ticket_id as string;

        if (!inputTicketId) {
          return { success: false, error: 'ต้องระบุ ticket_id' };
        }

        // Helper to extract UUID prefix from potentially formatted string
        const extractUUIDPrefix = (value: string): string | null => {
          const cleaned = value.replace(/[\[\]"'.\s]/g, '').replace(/\.{2,}/g, '');
          const uuidMatch = cleaned.match(/^[0-9a-fA-F-]+/);
          if (!uuidMatch) return null;
          const uuidPart = uuidMatch[0].replace(/-+$/, '');
          const hexOnly = uuidPart.replace(/-/g, '');
          return hexOnly.length >= 4 ? uuidPart : null;
        };

        // Resolve ticket ID (may be partial UUID)
        let ticketId = inputTicketId;
        if (inputTicketId.length < 36) {
          const prefix = extractUUIDPrefix(inputTicketId);
          if (prefix) {
            // Use filter with text cast for UUID column
            const { data: matchingTickets } = await supabase
              .from('main_tickets')
              .select('id')
              .filter('id::text', 'ilike', `${prefix}%`)
              .limit(1);

            if (matchingTickets && matchingTickets.length > 0) {
              ticketId = matchingTickets[0].id;
              console.log(`[ai-tool] review_ticket_safety resolved "${inputTicketId}" -> ${ticketId}`);
            } else {
              return { success: false, error: `ไม่พบตั๋วงานที่มี ID: ${inputTicketId}` };
            }
          } else {
            return { success: false, error: `รูปแบบ ID ตั๋วงานไม่ถูกต้อง: ${inputTicketId}` };
          }
        }

        // Get ticket with comprehensive site info for readiness review
        const { data: ticket, error: ticketError } = await supabase
          .from('main_tickets')
          .select(`
            id,
            details,
            work_type:ref_ticket_work_types(code, name),
            site:main_sites(
              id,
              name,
              address_detail,
              map_url,
              safety_standard,
              company:main_companies(name_th),
              province:ref_provinces(name_th),
              district:ref_districts(name_th),
              subdistrict:ref_subdistricts(name_th)
            ),
            appointment:main_appointments(appointment_date, is_approved),
            employees:jct_ticket_employees(
              employee:main_employees(id, name, code)
            ),
            confirmed_employees:jct_ticket_employees_cf(
              employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name, code)
            ),
            merchandise:jct_ticket_merchandise(
              merch:main_merchandise(
                id,
                serial_no,
                pm_count,
                model:main_models(model, name)
              )
            )
          `)
          .eq('id', ticketId)
          .single();

        if (ticketError || !ticket) {
          return { success: false, error: `ไม่พบตั๋วงาน: ${ticketId}` };
        }

        const site = ticket.site as {
          id?: string;
          name?: string;
          address_detail?: string;
          map_url?: string;
          safety_standard?: string[];
          company?: { name_th?: string };
          province?: { name_th?: string };
          district?: { name_th?: string };
          subdistrict?: { name_th?: string };
        } | null;

        // Get site contacts if site exists
        let siteContacts: Array<{
          person_name?: string;
          nickname?: string;
          phone?: string[];
          email?: string[];
          line_id?: string;
          note?: string;
        }> = [];

        if (site?.id) {
          const { data: contacts } = await supabase
            .from('child_site_contacts')
            .select('person_name, nickname, phone, email, line_id, note')
            .eq('site_id', site.id);
          siteContacts = contacts || [];
        }

        const appointment = ticket.appointment as {
          appointment_date?: string;
          is_approved?: boolean;
        } | null;

        const workType = ticket.work_type as { code?: string; name?: string } | null;

        // Safety standard labels in Thai
        const safetyLabels: Record<string, string> = {
          safety_shoes: '👟 รองเท้าเซฟตี้',
          safety_vest: '🦺 เสื้อสะท้อนแสง',
          safety_helmet: '⛑️ หมวกนิรภัย',
          training: '📚 ต้องผ่านการอบรมสถานที่',
        };

        // Get safety requirements
        const safetyRequirements = site?.safety_standard || [];
        const requiresTraining = safetyRequirements.includes('training');

        // Get all assigned technicians (requested + confirmed)
        const requestedEmps = ((ticket.employees as Array<{ employee: { id?: string; name?: string; code?: string } }>) || [])
          .map(e => e.employee)
          .filter(Boolean);
        const confirmedEmps = ((ticket.confirmed_employees as Array<{ employee: { id?: string; name?: string; code?: string } }>) || [])
          .map(e => e.employee)
          .filter(Boolean);

        // Combine and dedupe technicians
        const allTechnicianIds = new Set<string>();
        const allTechnicians: Array<{ id: string; name: string; code: string; is_confirmed: boolean }> = [];

        for (const emp of confirmedEmps) {
          if (emp.id && !allTechnicianIds.has(emp.id)) {
            allTechnicianIds.add(emp.id);
            allTechnicians.push({ id: emp.id, name: emp.name || '', code: emp.code || '', is_confirmed: true });
          }
        }
        for (const emp of requestedEmps) {
          if (emp.id && !allTechnicianIds.has(emp.id)) {
            allTechnicianIds.add(emp.id);
            allTechnicians.push({ id: emp.id, name: emp.name || '', code: emp.code || '', is_confirmed: false });
          }
        }

        // Check training status if training is required
        interface TrainingStatus {
          employee_id: string;
          employee_name: string;
          employee_code: string;
          is_confirmed: boolean;
          has_training: boolean;
          trained_at: string | null;
        }

        const trainingStatuses: TrainingStatus[] = [];

        if (requiresTraining && site?.id && allTechnicians.length > 0) {
          // Get training records for this site
          const { data: trainingRecords } = await supabase
            .from('jct_site_employee_trainings')
            .select('employee_id, trained_at')
            .eq('site_id', site.id)
            .in('employee_id', Array.from(allTechnicianIds));

          const trainingMap = new Map<string, string>();
          for (const rec of trainingRecords || []) {
            trainingMap.set(rec.employee_id, rec.trained_at);
          }

          for (const tech of allTechnicians) {
            const trainedAt = trainingMap.get(tech.id);
            trainingStatuses.push({
              employee_id: tech.id,
              employee_name: tech.name,
              employee_code: tech.code,
              is_confirmed: tech.is_confirmed,
              has_training: !!trainedAt,
              trained_at: trainedAt || null,
            });
          }
        } else {
          // No training required, just list technicians
          for (const tech of allTechnicians) {
            trainingStatuses.push({
              employee_id: tech.id,
              employee_name: tech.name,
              employee_code: tech.code,
              is_confirmed: tech.is_confirmed,
              has_training: true, // N/A - not required
              trained_at: null,
            });
          }
        }

        // Determine safety status
        const hasAnySafetyRequirements = safetyRequirements.length > 0;
        const techsWithoutTraining = trainingStatuses.filter(t => requiresTraining && !t.has_training);
        const hasSafetyIssues = techsWithoutTraining.length > 0;

        // ===== SITE INFORMATION COMPLETENESS =====
        // Check address details (look for floor/building info)
        const addressDetail = site?.address_detail || '';
        const hasFloorInfo = /ชั้น|floor|ตึก|อาคาร|building/i.test(addressDetail);
        const hasMapUrl = !!(site?.map_url);
        const fullAddress = [
          addressDetail,
          site?.subdistrict?.name_th ? `ตำบล/แขวง ${site.subdistrict.name_th}` : '',
          site?.district?.name_th ? `อำเภอ/เขต ${site.district.name_th}` : '',
          site?.province?.name_th,
        ].filter(Boolean).join(' ');

        // Check contact information
        const hasContacts = siteContacts.length > 0;
        const hasPhone = siteContacts.some(c => c.phone && c.phone.length > 0);
        const hasEmail = siteContacts.some(c => c.email && c.email.length > 0);

        // ===== MERCHANDISE/EQUIPMENT INFO =====
        const merchandise = ((ticket.merchandise as Array<{
          merch: {
            id?: string;
            serial_no?: string;
            pm_count?: number;
            model?: { model?: string; name?: string };
          };
        }>) || []).map(m => m.merch).filter(Boolean);

        const hasMerchandise = merchandise.length > 0;
        const isPMType = workType?.code === 'pm';
        const totalPMCount = merchandise.reduce((sum, m) => sum + (m.pm_count || 0), 0);

        // ===== READINESS SCORING =====
        const issues: string[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Safety issues
        if (hasSafetyIssues) {
          for (const t of techsWithoutTraining) {
            issues.push(`${t.employee_name}: ยังไม่ผ่านการอบรมสถานที่นี้`);
          }
        }

        // Technician warnings
        if (allTechnicians.length === 0) {
          issues.push('ยังไม่มีช่างที่มอบหมายให้งานนี้');
        } else if (confirmedEmps.length === 0) {
          warnings.push('ยังไม่มีช่างยืนยันรับงาน');
        }

        // Approval warning
        if (!appointment?.is_approved) {
          warnings.push('งานยังไม่ได้รับการอนุมัติ');
        }

        // Site info warnings
        if (!hasFloorInfo) {
          warnings.push('ไม่มีข้อมูลชั้น/อาคาร - อาจหาสถานที่ลำบาก');
          suggestions.push('เพิ่มข้อมูลชั้น/อาคารในรายละเอียดที่อยู่');
        }
        if (!hasMapUrl) {
          warnings.push('ไม่มี Map URL สำหรับนำทาง');
          suggestions.push('เพิ่ม Google Maps URL สำหรับการนำทาง');
        }
        if (!hasContacts) {
          issues.push('ไม่มีข้อมูลผู้ติดต่อที่สถานที่');
        } else if (!hasPhone) {
          warnings.push('ไม่มีเบอร์โทรผู้ติดต่อ');
        }

        // Safety warnings
        if (!hasAnySafetyRequirements) {
          suggestions.push('พิจารณาระบุข้อกำหนดความปลอดภัยสำหรับสถานที่นี้');
        }

        // Maintenance-specific checks
        if (isPMType && !hasMerchandise) {
          warnings.push('งาน PM แต่ไม่มีเครื่องที่ต้องบำรุงรักษาระบุไว้');
        }

        // Calculate readiness score
        let readinessScore = 100;
        readinessScore -= issues.length * 20;
        readinessScore -= warnings.length * 10;
        readinessScore = Math.max(0, readinessScore);

        const isReady = issues.length === 0;

        // Build result
        const result = {
          ticket: {
            id: ticketId,
            details: ticket.details,
            work_type: workType?.name || null,
            work_type_code: workType?.code || null,
            appointment_date: appointment?.appointment_date || null,
            is_approved: appointment?.is_approved || false,
          },
          site: {
            id: site?.id || null,
            name: site?.name || null,
            company_name: site?.company?.name_th || null,
            full_address: fullAddress || null,
            has_floor_info: hasFloorInfo,
            has_map: hasMapUrl,
            map_url: site?.map_url || null,
          },
          contacts: {
            total: siteContacts.length,
            has_phone: hasPhone,
            has_email: hasEmail,
            list: siteContacts.map(c => ({
              name: c.person_name || c.nickname || '-',
              phone: c.phone || [],
              email: c.email || [],
              line_id: c.line_id || null,
              note: c.note || null,
            })),
          },
          safety_requirements: {
            has_requirements: hasAnySafetyRequirements,
            items: safetyRequirements.map(req => ({
              code: req,
              label: safetyLabels[req] || req,
            })),
            requires_training: requiresTraining,
          },
          technicians: {
            total: allTechnicians.length,
            confirmed_count: confirmedEmps.length,
            requested_count: requestedEmps.length,
            list: trainingStatuses,
          },
          equipment: {
            has_merchandise: hasMerchandise,
            total: merchandise.length,
            total_pm_count: totalPMCount,
            list: merchandise.map(m => ({
              serial_no: m.serial_no || '-',
              model: m.model?.model || '-',
              name: m.model?.name || '-',
              pm_count: m.pm_count || 0,
            })),
          },
          readiness: {
            score: readinessScore,
            is_ready: isReady,
            issues,
            warnings,
            suggestions,
          },
        };

        // Build formatted markdown summary
        const formatLines: string[] = [];
        formatLines.push(`## 📋 รายงานความพร้อมออกงาน`);
        formatLines.push('');
        formatLines.push(`**ตั๋วงาน:** ${ticketId.slice(0, 8)}... | **ประเภท:** ${workType?.name || '-'}`);
        formatLines.push(`**สถานที่:** ${site?.name || '-'} (${site?.company?.name_th || '-'})`);
        formatLines.push(`**วันนัด:** ${appointment?.appointment_date || 'ยังไม่กำหนด'} | **อนุมัติ:** ${appointment?.is_approved ? '✅' : '❌'}`);
        formatLines.push('');

        // Readiness Score
        const scoreEmoji = readinessScore >= 80 ? '🟢' : readinessScore >= 50 ? '🟡' : '🔴';
        formatLines.push(`### ${scoreEmoji} คะแนนความพร้อม: ${readinessScore}/100`);
        formatLines.push(isReady ? '✅ **พร้อมออกงาน**' : '⚠️ **ยังไม่พร้อม - มีปัญหาต้องแก้ไข**');
        formatLines.push('');

        // Site Information
        formatLines.push(`### 📍 ข้อมูลสถานที่`);
        formatLines.push(`**ที่อยู่:** ${fullAddress || '-'}`);
        formatLines.push(`- ชั้น/อาคาร: ${hasFloorInfo ? '✅ มี' : '❌ ไม่ระบุ'}`);
        formatLines.push(`- Map นำทาง: ${hasMapUrl ? '✅ มี' : '❌ ไม่มี'}`);
        formatLines.push('');

        // Contacts section
        formatLines.push(`### 👤 ผู้ติดต่อ (${siteContacts.length} คน)`);
        if (hasContacts) {
          for (const c of siteContacts) {
            const phones = c.phone?.join(', ') || '-';
            formatLines.push(`- **${c.person_name || c.nickname || '-'}**: 📞 ${phones}`);
          }
        } else {
          formatLines.push('❌ ไม่มีข้อมูลผู้ติดต่อ');
        }
        formatLines.push('');

        // Safety requirements section
        formatLines.push(`### 🛡️ ข้อกำหนดความปลอดภัย`);
        if (hasAnySafetyRequirements) {
          for (const req of safetyRequirements) {
            formatLines.push(`- ${safetyLabels[req] || req}`);
          }
        } else {
          formatLines.push('ไม่มีข้อกำหนดความปลอดภัยระบุไว้');
        }
        formatLines.push('');

        // Technicians section
        formatLines.push(`### 👷 ช่างที่มอบหมาย (${allTechnicians.length} คน)`);
        if (allTechnicians.length > 0) {
          if (requiresTraining) {
            formatLines.push('| # | ชื่อ | รหัส | สถานะ | ผ่านอบรม |');
            formatLines.push('|---|------|------|--------|---------|');
            trainingStatuses.forEach((t, i) => {
              const statusIcon = t.is_confirmed ? '✅ ยืนยัน' : '⏳ รอยืนยัน';
              const trainingIcon = t.has_training ? '✅ ผ่าน' : '❌ ยังไม่ผ่าน';
              formatLines.push(`| ${i + 1} | ${t.employee_name} | ${t.employee_code} | ${statusIcon} | ${trainingIcon} |`);
            });
          } else {
            formatLines.push('| # | ชื่อ | รหัส | สถานะ |');
            formatLines.push('|---|------|------|--------|');
            trainingStatuses.forEach((t, i) => {
              const statusIcon = t.is_confirmed ? '✅ ยืนยัน' : '⏳ รอยืนยัน';
              formatLines.push(`| ${i + 1} | ${t.employee_name} | ${t.employee_code} | ${statusIcon} |`);
            });
          }
        } else {
          formatLines.push('❌ ยังไม่มีช่างที่มอบหมาย');
        }
        formatLines.push('');

        // Equipment section (if PM or has merchandise)
        if (hasMerchandise || isPMType) {
          formatLines.push(`### 🔧 เครื่องที่ต้องดูแล (${merchandise.length} เครื่อง)`);
          if (hasMerchandise) {
            formatLines.push('| # | S/N | รุ่น | PM ครั้งที่ |');
            formatLines.push('|---|-----|------|------------|');
            merchandise.forEach((m, i) => {
              formatLines.push(`| ${i + 1} | ${m.serial_no || '-'} | ${m.model?.model || '-'} | ${m.pm_count || 0} |`);
            });
          } else {
            formatLines.push('❌ ไม่มีเครื่องที่ระบุไว้');
          }
          formatLines.push('');
        }

        // Issues and Warnings
        if (issues.length > 0 || warnings.length > 0) {
          formatLines.push(`### ⚠️ สิ่งที่ต้องแก้ไข/ตรวจสอบ`);
          if (issues.length > 0) {
            formatLines.push('**❌ ปัญหา (ต้องแก้ไข):**');
            for (const issue of issues) {
              formatLines.push(`- ${issue}`);
            }
          }
          if (warnings.length > 0) {
            formatLines.push('**⚠️ คำเตือน:**');
            for (const warning of warnings) {
              formatLines.push(`- ${warning}`);
            }
          }
          formatLines.push('');
        }

        // Suggestions
        if (suggestions.length > 0) {
          formatLines.push(`### 💡 ข้อเสนอแนะ`);
          for (const suggestion of suggestions) {
            formatLines.push(`- ${suggestion}`);
          }
        }

        return {
          success: true,
          data: {
            formatted_summary: formatLines.join('\n'),
            ...result,
          },
        };
      }

      case 'web_search': {
        const query = toolInput.query as string;

        if (!query || query.trim().length < 2) {
          return { success: false, error: 'กรุณาระบุคำค้นหา' };
        }

        // Use Serper API for Google Search
        const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');

        if (!SERPER_API_KEY) {
          return {
            success: false,
            error: 'ไม่สามารถค้นหาเว็บได้ในขณะนี้ (ไม่พบ API key)'
          };
        }

        try {
          const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: query,
              gl: 'th', // Thailand
              hl: 'th', // Thai language
              num: 5,   // Number of results
            }),
          });

          if (!response.ok) {
            console.error('[ai-tool] web_search error:', response.status, response.statusText);
            return { success: false, error: 'ไม่สามารถค้นหาเว็บได้ในขณะนี้' };
          }

          const data = await response.json();

          // Format results
          const results: Array<{
            title: string;
            link: string;
            snippet: string;
          }> = [];

          // Organic results
          if (data.organic && Array.isArray(data.organic)) {
            for (const item of data.organic.slice(0, 5)) {
              results.push({
                title: item.title || '',
                link: item.link || '',
                snippet: item.snippet || '',
              });
            }
          }

          // Build formatted markdown
          const formatLines: string[] = [];
          formatLines.push(`## ผลการค้นหา: "${query}"`);
          formatLines.push('');

          if (results.length === 0) {
            formatLines.push('ไม่พบผลลัพธ์');
          } else {
            for (let i = 0; i < results.length; i++) {
              const r = results[i];
              formatLines.push(`### ${i + 1}. ${r.title}`);
              formatLines.push(`${r.snippet}`);
              formatLines.push(`🔗 ${r.link}`);
              formatLines.push('');
            }
          }

          // Include knowledge graph if available
          if (data.knowledgeGraph) {
            const kg = data.knowledgeGraph;
            formatLines.push('---');
            formatLines.push(`**${kg.title || 'ข้อมูลเพิ่มเติม'}**`);
            if (kg.description) formatLines.push(kg.description);
            if (kg.attributes) {
              for (const [key, value] of Object.entries(kg.attributes)) {
                formatLines.push(`- ${key}: ${value}`);
              }
            }
          }

          return {
            success: true,
            data: {
              formatted_summary: formatLines.join('\n'),
              query,
              results,
              total_results: results.length,
            },
          };
        } catch (searchError) {
          console.error('[ai-tool] web_search fetch error:', searchError);
          return { success: false, error: 'เกิดข้อผิดพลาดในการค้นหาเว็บ' };
        }
      }

      case 'recommend_apc_ups': {
        // Parse input parameters
        let powerLoadVA = toolInput.power_load_va as number | undefined;
        const powerLoadWatts = toolInput.power_load_watts as number | undefined;
        const runtimeMinutes = toolInput.runtime_minutes as number | undefined;
        const useCase = toolInput.use_case as string | undefined;
        const formFactor = toolInput.form_factor as string | undefined;
        const topology = toolInput.topology as string | undefined;
        const phase = toolInput.phase as string | undefined;
        const budgetTHB = toolInput.budget_thb as number | undefined;
        const features = toolInput.features as string[] | undefined;
        const equipmentDetails = toolInput.equipment_details as string | undefined;

        // Convert watts to VA if provided (typical power factor 0.7, so VA = Watts / 0.7 ≈ Watts * 1.4)
        if (!powerLoadVA && powerLoadWatts) {
          powerLoadVA = Math.ceil(powerLoadWatts * 1.4);
        }

        // APC UPS Database - comprehensive product knowledge
        const apcUPSDatabase = [
          // Back-UPS Series (Standby/Line-Interactive, Home/Office)
          {
            series: 'Back-UPS',
            model: 'BX625CI-MS',
            va: 625,
            watts: 325,
            topology: 'standby',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['home', 'desktop'],
            runtime_at_half_load: 8,
            features: ['auto_voltage_regulation', 'surge_protection', 'usb'],
            price_range_thb: { min: 1500, max: 2500 },
            outlets: 4,
            description: 'UPS พื้นฐานสำหรับคอมพิวเตอร์บ้าน',
          },
          {
            series: 'Back-UPS',
            model: 'BX800LI-MS',
            va: 800,
            watts: 415,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['home', 'office', 'desktop'],
            runtime_at_half_load: 10,
            features: ['auto_voltage_regulation', 'surge_protection', 'usb'],
            price_range_thb: { min: 2000, max: 3500 },
            outlets: 4,
            description: 'UPS Line-Interactive สำหรับ PC และ NAS ขนาดเล็ก',
          },
          {
            series: 'Back-UPS',
            model: 'BX1100LI-MS',
            va: 1100,
            watts: 550,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['home', 'office', 'desktop'],
            runtime_at_half_load: 12,
            features: ['auto_voltage_regulation', 'surge_protection', 'usb', 'lcd'],
            price_range_thb: { min: 3000, max: 5000 },
            outlets: 6,
            description: 'UPS Line-Interactive สำหรับ PC หลายเครื่อง',
          },
          {
            series: 'Back-UPS Pro',
            model: 'BR1500GI',
            va: 1500,
            watts: 865,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['office', 'network', 'server'],
            runtime_at_half_load: 15,
            features: ['auto_voltage_regulation', 'surge_protection', 'usb', 'lcd', 'network_card_slot'],
            price_range_thb: { min: 8000, max: 12000 },
            outlets: 10,
            description: 'UPS Pro สำหรับเซิร์ฟเวอร์ขนาดเล็ก NAS และอุปกรณ์ Network',
          },
          // Smart-UPS Series (Line-Interactive, SMB/Enterprise)
          {
            series: 'Smart-UPS',
            model: 'SMT1000I',
            va: 1000,
            watts: 700,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['server', 'network', 'office'],
            runtime_at_half_load: 18,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery'],
            price_range_thb: { min: 15000, max: 22000 },
            outlets: 8,
            description: 'Smart-UPS Pure Sinewave สำหรับ Server และ Network',
          },
          {
            series: 'Smart-UPS',
            model: 'SMT1500I',
            va: 1500,
            watts: 1000,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['server', 'network', 'office'],
            runtime_at_half_load: 22,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery'],
            price_range_thb: { min: 20000, max: 30000 },
            outlets: 8,
            description: 'Smart-UPS 1500VA Pure Sinewave สำหรับ Server',
          },
          {
            series: 'Smart-UPS',
            model: 'SMT2200I',
            va: 2200,
            watts: 1980,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['server', 'network', 'data_center'],
            runtime_at_half_load: 25,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime'],
            price_range_thb: { min: 35000, max: 50000 },
            outlets: 8,
            description: 'Smart-UPS 2200VA สำหรับ Server Room ขนาดเล็ก',
          },
          {
            series: 'Smart-UPS',
            model: 'SMT3000I',
            va: 3000,
            watts: 2700,
            topology: 'line-interactive',
            form_factor: 'tower',
            phase: 'single',
            use_cases: ['server', 'data_center', 'industrial'],
            runtime_at_half_load: 28,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime'],
            price_range_thb: { min: 45000, max: 65000 },
            outlets: 8,
            description: 'Smart-UPS 3000VA สำหรับ Server Room และ Data Center ขนาดเล็ก',
          },
          // Smart-UPS Rack Mount
          {
            series: 'Smart-UPS',
            model: 'SMT1500RMI2U',
            va: 1500,
            watts: 1000,
            topology: 'line-interactive',
            form_factor: 'rackmount',
            rack_unit: 2,
            phase: 'single',
            use_cases: ['server', 'network', 'data_center'],
            runtime_at_half_load: 20,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery'],
            price_range_thb: { min: 28000, max: 40000 },
            outlets: 6,
            description: 'Smart-UPS Rack 2U สำหรับติดตั้งในตู้ Rack',
          },
          {
            series: 'Smart-UPS',
            model: 'SMT2200RMI2U',
            va: 2200,
            watts: 1980,
            topology: 'line-interactive',
            form_factor: 'rackmount',
            rack_unit: 2,
            phase: 'single',
            use_cases: ['server', 'network', 'data_center'],
            runtime_at_half_load: 22,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime'],
            price_range_thb: { min: 40000, max: 55000 },
            outlets: 8,
            description: 'Smart-UPS Rack 2U 2200VA สำหรับ Server Rack',
          },
          {
            series: 'Smart-UPS',
            model: 'SMT3000RMI2U',
            va: 3000,
            watts: 2700,
            topology: 'line-interactive',
            form_factor: 'rackmount',
            rack_unit: 2,
            phase: 'single',
            use_cases: ['server', 'data_center', 'industrial'],
            runtime_at_half_load: 25,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime'],
            price_range_thb: { min: 55000, max: 75000 },
            outlets: 8,
            description: 'Smart-UPS Rack 2U 3000VA สำหรับ Data Center',
          },
          // Smart-UPS Online (Double Conversion)
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT1000XLI',
            va: 1000,
            watts: 900,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['server', 'network', 'data_center', 'industrial'],
            runtime_at_half_load: 15,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 35000, max: 50000 },
            outlets: 8,
            description: 'Smart-UPS Online Double Conversion สำหรับอุปกรณ์ critical',
          },
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT1500XLI',
            va: 1500,
            watts: 1350,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['server', 'network', 'data_center', 'industrial'],
            runtime_at_half_load: 18,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 45000, max: 65000 },
            outlets: 8,
            description: 'Smart-UPS Online 1500VA Double Conversion',
          },
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT2200XLI',
            va: 2200,
            watts: 1980,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['server', 'data_center', 'industrial'],
            runtime_at_half_load: 20,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 60000, max: 85000 },
            outlets: 10,
            description: 'Smart-UPS Online 2200VA สำหรับ Mission Critical',
          },
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT3000XLI',
            va: 3000,
            watts: 2700,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['server', 'data_center', 'industrial'],
            runtime_at_half_load: 22,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 75000, max: 100000 },
            outlets: 10,
            description: 'Smart-UPS Online 3000VA สำหรับ Data Center',
          },
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT5KXLI',
            va: 5000,
            watts: 4500,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['data_center', 'industrial'],
            runtime_at_half_load: 25,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 100000, max: 150000 },
            outlets: 12,
            description: 'Smart-UPS Online 5kVA สำหรับ Large Server Room',
          },
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT6KXLI',
            va: 6000,
            watts: 6000,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['data_center', 'industrial'],
            runtime_at_half_load: 28,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 130000, max: 180000 },
            outlets: 12,
            description: 'Smart-UPS Online 6kVA สำหรับ Enterprise Data Center',
          },
          {
            series: 'Smart-UPS On-Line',
            model: 'SRT10KXLI',
            va: 10000,
            watts: 10000,
            topology: 'online-double-conversion',
            form_factor: 'convertible',
            phase: 'single',
            use_cases: ['data_center', 'industrial'],
            runtime_at_half_load: 30,
            features: ['pure_sinewave', 'lcd', 'usb', 'serial', 'network_card_slot', 'hot_swap_battery', 'extended_runtime', 'parallel_capability'],
            price_range_thb: { min: 200000, max: 280000 },
            outlets: 14,
            description: 'Smart-UPS Online 10kVA สำหรับ Large Data Center',
          },
          // Galaxy Series (3 Phase, Enterprise)
          {
            series: 'Galaxy VS',
            model: 'GVS10K10KHS',
            va: 10000,
            watts: 10000,
            topology: 'online-double-conversion',
            form_factor: 'tower',
            phase: 'three',
            use_cases: ['data_center', 'industrial'],
            runtime_at_half_load: 30,
            features: ['pure_sinewave', 'lcd', 'network_card', 'hot_swap_battery', 'extended_runtime', 'parallel_capability', 'modular'],
            price_range_thb: { min: 350000, max: 500000 },
            outlets: 0,
            hardwired: true,
            description: 'Galaxy VS 10kVA 3 Phase สำหรับ Enterprise Data Center',
          },
          {
            series: 'Galaxy VS',
            model: 'GVS20K20KHS',
            va: 20000,
            watts: 20000,
            topology: 'online-double-conversion',
            form_factor: 'tower',
            phase: 'three',
            use_cases: ['data_center', 'industrial'],
            runtime_at_half_load: 35,
            features: ['pure_sinewave', 'lcd', 'network_card', 'hot_swap_battery', 'extended_runtime', 'parallel_capability', 'modular'],
            price_range_thb: { min: 550000, max: 750000 },
            outlets: 0,
            hardwired: true,
            description: 'Galaxy VS 20kVA 3 Phase สำหรับ Large Enterprise',
          },
        ];

        // Score and filter UPS models based on requirements
        interface ScoredUPS {
          model: string;
          series: string;
          va: number;
          watts: number;
          score: number;
          reasons: string[];
          warnings: string[];
          price_estimate: string;
          description: string;
          topology: string;
          form_factor: string;
          phase: string;
          features: string[];
        }

        const scoredModels: ScoredUPS[] = [];

        for (const ups of apcUPSDatabase) {
          let score = 50; // Base score
          const reasons: string[] = [];
          const warnings: string[] = [];

          // Phase matching (critical filter)
          if (phase && ups.phase !== phase) {
            continue; // Skip if phase doesn't match
          }

          // Power capacity scoring
          if (powerLoadVA) {
            const loadRatio = powerLoadVA / ups.va;
            if (loadRatio > 0.8) {
              warnings.push('โหลดใกล้เต็มกำลัง (>80%) - พิจารณารุ่นที่ใหญ่กว่า');
              score -= 20;
            } else if (loadRatio > 1) {
              continue; // Skip if under capacity
            } else if (loadRatio >= 0.4 && loadRatio <= 0.6) {
              reasons.push('โหลดอยู่ในช่วงที่เหมาะสม (40-60%)');
              score += 20;
            } else if (loadRatio < 0.3) {
              warnings.push('กำลังไฟเกินความต้องการมาก');
              score -= 10;
            }
          }

          // Use case matching
          if (useCase && ups.use_cases.includes(useCase)) {
            reasons.push(`เหมาะสำหรับการใช้งาน ${useCase}`);
            score += 15;
          }

          // Form factor matching
          if (formFactor && ups.form_factor === formFactor) {
            reasons.push(`รูปแบบ ${formFactor} ตรงตามต้องการ`);
            score += 10;
          } else if (formFactor && ups.form_factor !== formFactor) {
            score -= 15;
          }

          // Topology matching
          if (topology && ups.topology === topology) {
            reasons.push(`เทคโนโลยี ${topology} ตรงตามต้องการ`);
            score += 15;
          } else if (topology === 'online-double-conversion' && ups.topology !== 'online-double-conversion') {
            score -= 20; // Penalize if user wants online but model isn't
          }

          // Budget matching
          if (budgetTHB) {
            const avgPrice = (ups.price_range_thb.min + ups.price_range_thb.max) / 2;
            if (avgPrice <= budgetTHB) {
              reasons.push('อยู่ในงบประมาณ');
              score += 10;
            } else if (avgPrice <= budgetTHB * 1.2) {
              warnings.push('เกินงบประมาณเล็กน้อย');
              score -= 5;
            } else {
              score -= 20;
            }
          }

          // Feature matching
          if (features && features.length > 0) {
            let matchedFeatures = 0;
            for (const f of features) {
              if (ups.features.includes(f)) {
                matchedFeatures++;
              }
            }
            if (matchedFeatures > 0) {
              reasons.push(`มีคุณสมบัติที่ต้องการ ${matchedFeatures}/${features.length} รายการ`);
              score += matchedFeatures * 5;
            }
          }

          // Runtime consideration
          if (runtimeMinutes && ups.runtime_at_half_load) {
            if (ups.runtime_at_half_load >= runtimeMinutes) {
              reasons.push(`Runtime ที่ half load: ${ups.runtime_at_half_load} นาที (เพียงพอ)`);
              score += 10;
            } else if (ups.features.includes('extended_runtime')) {
              warnings.push(`Runtime พื้นฐาน ${ups.runtime_at_half_load} นาที แต่สามารถเพิ่ม Battery Pack ได้`);
              score += 5;
            } else {
              warnings.push(`Runtime ${ups.runtime_at_half_load} นาที อาจไม่เพียงพอ`);
              score -= 15;
            }
          }

          // Series bonus for appropriate use
          if (useCase === 'data_center' && (ups.series === 'Smart-UPS On-Line' || ups.series === 'Galaxy VS')) {
            reasons.push('รุ่น Enterprise-grade เหมาะสำหรับ Data Center');
            score += 10;
          }
          if (useCase === 'home' && (ups.series === 'Back-UPS' || ups.series === 'Back-UPS Pro')) {
            reasons.push('รุ่นประหยัดเหมาะสำหรับใช้งานบ้าน');
            score += 10;
          }

          // Add to scored list
          scoredModels.push({
            model: ups.model,
            series: ups.series,
            va: ups.va,
            watts: ups.watts,
            score,
            reasons,
            warnings,
            price_estimate: `${ups.price_range_thb.min.toLocaleString()} - ${ups.price_range_thb.max.toLocaleString()} บาท`,
            description: ups.description,
            topology: ups.topology,
            form_factor: ups.form_factor,
            phase: ups.phase,
            features: ups.features,
          });
        }

        // Sort by score and take top 5
        scoredModels.sort((a, b) => b.score - a.score);
        const recommendations = scoredModels.slice(0, 5);

        // Build search query for web search
        const searchQueries: string[] = [];
        if (powerLoadVA) {
          searchQueries.push(`APC UPS ${powerLoadVA}VA`);
        }
        if (useCase) {
          const useCaseMap: Record<string, string> = {
            server: 'server',
            desktop: 'desktop PC',
            network: 'network switch router',
            data_center: 'data center',
            home: 'home office',
            office: 'office',
            industrial: 'industrial',
          };
          searchQueries.push(`APC UPS ${useCaseMap[useCase] || useCase}`);
        }
        if (topology === 'online-double-conversion') {
          searchQueries.push('APC Smart-UPS Online');
        }

        // Perform web search for latest info
        const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
        let webSearchResults: Array<{ title: string; link: string; snippet: string }> = [];

        if (SERPER_API_KEY && searchQueries.length > 0) {
          try {
            const searchQuery = searchQueries.join(' ') + ' Thailand price 2024';
            const response = await fetch('https://google.serper.dev/search', {
              method: 'POST',
              headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                q: searchQuery,
                gl: 'th',
                hl: 'th',
                num: 5,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.organic && Array.isArray(data.organic)) {
                webSearchResults = data.organic.slice(0, 3).map((item: { title?: string; link?: string; snippet?: string }) => ({
                  title: item.title || '',
                  link: item.link || '',
                  snippet: item.snippet || '',
                }));
              }
            }
          } catch (err) {
            console.error('[ai-tool] recommend_apc_ups web search error:', err);
          }
        }

        // Build formatted markdown summary
        const formatLines: string[] = [];
        formatLines.push('## 🔋 คำแนะนำ UPS APC by Schneider Electric');
        formatLines.push('');

        // Show requirements summary
        formatLines.push('### 📋 ความต้องการของลูกค้า');
        if (powerLoadVA) formatLines.push(`- **กำลังไฟ:** ${powerLoadVA} VA${powerLoadWatts ? ` (${powerLoadWatts}W)` : ''}`);
        if (runtimeMinutes) formatLines.push(`- **Runtime ต้องการ:** ${runtimeMinutes} นาที`);
        if (useCase) formatLines.push(`- **การใช้งาน:** ${useCase}`);
        if (formFactor) formatLines.push(`- **รูปแบบ:** ${formFactor}`);
        if (topology) formatLines.push(`- **เทคโนโลยี:** ${topology}`);
        if (phase) formatLines.push(`- **ระบบไฟ:** ${phase === 'three' ? '3 เฟส' : '1 เฟส'}`);
        if (budgetTHB) formatLines.push(`- **งบประมาณ:** ${budgetTHB.toLocaleString()} บาท`);
        if (equipmentDetails) formatLines.push(`- **อุปกรณ์:** ${equipmentDetails}`);
        formatLines.push('');

        // Top 5 recommendations
        formatLines.push('### ⭐ Top 5 รุ่นแนะนำ');
        formatLines.push('');
        formatLines.push('| # | รุ่น | VA/W | เทคโนโลยี | ราคาโดยประมาณ | คะแนน |');
        formatLines.push('|---|------|------|-----------|----------------|-------|');

        recommendations.forEach((rec, idx) => {
          const topologyTH = rec.topology === 'online-double-conversion' ? 'Online' : rec.topology === 'line-interactive' ? 'Line-Int.' : 'Standby';
          formatLines.push(`| ${idx + 1} | **${rec.series} ${rec.model}** | ${rec.va}/${rec.watts} | ${topologyTH} | ${rec.price_estimate} | ${rec.score}/100 |`);
        });
        formatLines.push('');

        // Detailed recommendations
        formatLines.push('### 📝 รายละเอียดแต่ละรุ่น');
        formatLines.push('');

        recommendations.forEach((rec, idx) => {
          formatLines.push(`#### ${idx + 1}. ${rec.series} ${rec.model}`);
          formatLines.push(`**${rec.description}**`);
          formatLines.push('');
          formatLines.push(`- **กำลัง:** ${rec.va} VA / ${rec.watts} W`);
          formatLines.push(`- **รูปแบบ:** ${rec.form_factor}${rec.phase === 'three' ? ' (3 เฟส)' : ''}`);
          formatLines.push(`- **ราคาประมาณ:** ${rec.price_estimate}`);

          if (rec.reasons.length > 0) {
            formatLines.push('- **จุดเด่น:** ' + rec.reasons.join(', '));
          }
          if (rec.warnings.length > 0) {
            formatLines.push('- **⚠️ ข้อควรพิจารณา:** ' + rec.warnings.join(', '));
          }
          if (rec.features.length > 0) {
            const featureLabels: Record<string, string> = {
              'pure_sinewave': 'Pure Sinewave',
              'lcd': 'หน้าจอ LCD',
              'usb': 'USB',
              'serial': 'Serial',
              'network_card_slot': 'Network Card Slot',
              'hot_swap_battery': 'Hot-Swap Battery',
              'extended_runtime': 'External Battery',
              'parallel_capability': 'Parallel',
              'auto_voltage_regulation': 'AVR',
              'surge_protection': 'Surge Protection',
            };
            const featureStr = rec.features.slice(0, 6).map(f => featureLabels[f] || f).join(', ');
            formatLines.push(`- **คุณสมบัติ:** ${featureStr}`);
          }
          formatLines.push('');
        });

        // Web search results
        if (webSearchResults.length > 0) {
          formatLines.push('### 🌐 ข้อมูลเพิ่มเติมจากอินเทอร์เน็ต');
          for (const result of webSearchResults) {
            formatLines.push(`- [${result.title}](${result.link})`);
          }
          formatLines.push('');
        }

        // Additional notes
        formatLines.push('### 💡 คำแนะนำเพิ่มเติม');
        formatLines.push('- ควรเลือก UPS ที่มีกำลังไฟ 40-60% ของความสามารถสูงสุด');
        formatLines.push('- สำหรับอุปกรณ์ที่มี Active PFC (เซิร์ฟเวอร์, PC ใหม่) ควรใช้ Pure Sinewave');
        formatLines.push('- Online Double Conversion เหมาะสำหรับอุปกรณ์สำคัญที่ต้องการป้องกันสูงสุด');
        formatLines.push('- ติดต่อ PNJR Group เพื่อขอใบเสนอราคาและคำปรึกษาเพิ่มเติม');
        formatLines.push('');
        formatLines.push('📞 **ติดต่อ Pace Design / UPSS / PNJR:** Authorized APC Service Partner');

        return {
          success: true,
          data: {
            formatted_summary: formatLines.join('\n'),
            requirements: {
              power_load_va: powerLoadVA,
              power_load_watts: powerLoadWatts,
              runtime_minutes: runtimeMinutes,
              use_case: useCase,
              form_factor: formFactor,
              topology,
              phase,
              budget_thb: budgetTHB,
              features,
              equipment_details: equipmentDetails,
            },
            recommendations: recommendations.map(rec => ({
              rank: scoredModels.indexOf(rec) + 1,
              model: `${rec.series} ${rec.model}`,
              va: rec.va,
              watts: rec.watts,
              topology: rec.topology,
              form_factor: rec.form_factor,
              price_estimate: rec.price_estimate,
              score: rec.score,
              reasons: rec.reasons,
              warnings: rec.warnings,
              features: rec.features,
              description: rec.description,
            })),
            web_search_results: webSearchResults,
          },
        };
      }

      default:
        return { success: false, error: `ไม่รู้จัก tool: ${toolName}` };
    }
  } catch (err) {
    // Handle both Error instances and PostgrestError objects
    let errorMessage = 'เกิดข้อผิดพลาดในการดำเนินการ';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (err && typeof err === 'object' && 'message' in err) {
      // PostgrestError has a message property
      errorMessage = (err as { message: string }).message;
    }
    console.error(`[ai-tool] Error executing ${toolName}:`, errorMessage, err);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
