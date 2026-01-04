/**
 * Employee service - Business logic for employee operations
 * OPTIMIZED: Combined count+data queries, cached static lookups
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

// Static cache for frequently looked up values that rarely change
const staticCache = {
  roleIdByCode: new Map<string, string>(),
  departmentIdByCode: new Map<string, string>(),
  lastCacheTime: 0,
  cacheTTL: 5 * 60 * 1000, // 5 minutes TTL
};

/**
 * Get role ID by code with caching
 */
async function getRoleIdByCode(code: string): Promise<string | null> {
  // Check cache first
  const now = Date.now();
  if (now - staticCache.lastCacheTime < staticCache.cacheTTL) {
    const cached = staticCache.roleIdByCode.get(code);
    if (cached) return cached;
  }

  // Look up from database
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('main_org_roles')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (error) throw new DatabaseError(`Failed to lookup role: ${error.message}`);
  if (!data) return null;

  // Update cache
  staticCache.roleIdByCode.set(code, data.id);
  staticCache.lastCacheTime = now;
  
  return data.id;
}

/**
 * Get department ID by code with caching
 */
async function getDepartmentIdByCode(code: string): Promise<string | null> {
  // Check cache first
  const now = Date.now();
  if (now - staticCache.lastCacheTime < staticCache.cacheTTL) {
    const cached = staticCache.departmentIdByCode.get(code);
    if (cached) return cached;
  }

  // Look up from database
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('main_org_departments')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (error) throw new DatabaseError(`Failed to lookup department: ${error.message}`);
  if (!data) return null;

  // Update cache
  staticCache.departmentIdByCode.set(code, data.id);
  staticCache.lastCacheTime = now;
  
  return data.id;
}

export class EmployeeService {

  /**
   * Get single employee by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_employees')
      .select(`
        *,
        role_data:main_org_roles!role_id(
          *,
          department:main_org_departments!main_org_roles_department_id_fkey(id, code, name_th, name_en)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบข้อมูลพนักงาน');
      }
      throw new DatabaseError(error.message);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูลพนักงาน');
    }

    return data;
  }


  /**
   * Create new employee
   */
  static async create(employeeData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Transform role code to role_id if role is provided (backward compatibility)
    // Prefer role_id if both are provided
    const insertData = { ...employeeData };
    if (insertData.role_id === undefined && insertData.role !== undefined && typeof insertData.role === 'string') {
      // Look up role_id from role code
      const { data: roleData, error: roleError } = await supabase
        .from('main_org_roles')
        .select('id')
        .eq('code', insertData.role)
        .maybeSingle();

      if (roleError) throw new DatabaseError(`Failed to lookup role: ${roleError.message}`);
      if (!roleData) {
        throw new DatabaseError(`ไม่พบบทบาทที่ระบุ: ${insertData.role}`);
      }

      // Replace role code with role_id
      insertData.role_id = roleData.id;
      delete insertData.role; // Remove role code from insert data
    } else if (insertData.role !== undefined) {
      // If role_id is provided, remove role code to avoid confusion
      delete insertData.role;
    }

    const { data, error} = await supabase
      .from('main_employees')
      .insert([insertData])
      .select(`
        *,
        role_data:main_org_roles!role_id(
          *,
          department:main_org_departments!main_org_roles_department_id_fkey(id, code, name_th, name_en)
        )
      `)
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('Failed to create employee');

    // Create initial leave balances for the new employee
    await this.createInitialLeaveBalances(data.id as string);

    return data;
  }

  /**
   * Create initial leave balances for a new employee
   * Note: Uses hardcoded values, not days_per_year from leave_types table
   */
  private static async createInitialLeaveBalances(employeeId: string): Promise<void> {
    const supabase = createServiceClient();
    const currentYear = new Date().getFullYear();

    // Define leave types and their initial balances (hardcoded, not from leave_types.days_per_year)
    const leaveBalances = [
      { code: 'sick_leave', totalDays: 30 },
      { code: 'vacation_leave', totalDays: 6 },
      { code: 'personal_leave', totalDays: 3 },
    ];

    // Look up leave type IDs by code
    const leaveTypeIds: Record<string, string> = {};
    for (const leaveBalance of leaveBalances) {
      const { data: leaveType, error: leaveTypeError } = await supabase
        .from('ref_leave_types')
        .select('id')
        .eq('code', leaveBalance.code)
        .maybeSingle();

      if (leaveTypeError) {
        throw new DatabaseError(`Failed to lookup leave type ${leaveBalance.code}: ${leaveTypeError.message}`);
      }

      if (!leaveType) {
        // Skip if leave type doesn't exist (might not be seeded yet)
        continue;
      }

      leaveTypeIds[leaveBalance.code] = leaveType.id;
    }

    // Create leave balance records
    const balanceRecords = leaveBalances
      .filter(lb => leaveTypeIds[lb.code])
      .map(lb => ({
        employee_id: employeeId,
        leave_type_id: leaveTypeIds[lb.code],
        year: currentYear,
        total_days: lb.totalDays,
        used_days: 0,
      }));

    if (balanceRecords.length > 0) {
      const { error: balanceError } = await supabase
        .from('child_employee_leave_balances')
        .insert(balanceRecords);

      if (balanceError) {
        throw new DatabaseError(`Failed to create leave balances: ${balanceError.message}`);
      }
    }
  }

  /**
   * Update existing employee
   */
  static async update(id: string, employeeData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // If only updating profile_image_url, use direct PostgREST API call to bypass schema cache
    if (Object.keys(employeeData).length === 1 && employeeData.profile_image_url !== undefined) {
      // @ts-ignore - Deno is available in Edge Functions
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      // @ts-ignore - Deno is available in Edge Functions
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new DatabaseError('Missing Supabase environment variables');
      }

      // Use PostgREST REST API directly to bypass schema cache
      const url = `${supabaseUrl}/rest/v1/employees?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          profile_image_url: employeeData.profile_image_url,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new DatabaseError(`Failed to update employee: ${errorText}`);
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        throw new NotFoundError('ไม่พบข้อมูลพนักงาน');
      }

      // Fetch full employee record with relations
      const { data: fullData, error: fetchError } = await supabase
        .from('main_employees')
        .select(`
          *,
          role_data:main_org_roles!role_id(
            *,
            department:main_org_departments!main_org_roles_department_id_fkey(id, code, name_th, name_en)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        // If fetch fails, return the basic data from the update
        return data[0];
      }

      return fullData;
    }

    // Transform role code to role_id if role is provided (backward compatibility)
    // Prefer role_id if both are provided
    const updateData = { ...employeeData };
    if (updateData.role_id === undefined && updateData.role !== undefined && typeof updateData.role === 'string') {
      // Look up role_id from role code
      const { data: roleData, error: roleError } = await supabase
        .from('main_org_roles')
        .select('id')
        .eq('code', updateData.role)
        .maybeSingle();

      if (roleError) throw new DatabaseError(`Failed to lookup role: ${roleError.message}`);
      if (!roleData) {
        throw new DatabaseError(`ไม่พบบทบาทที่ระบุ: ${updateData.role}`);
      }

      // Replace role code with role_id
      updateData.role_id = roleData.id;
      delete updateData.role; // Remove role code from update data
    } else if (updateData.role !== undefined) {
      // If role_id is provided, remove role code to avoid confusion
      delete updateData.role;
    }

    // For other updates, use standard update
    const { data, error } = await supabase
      .from('main_employees')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        role_data:main_org_roles!role_id(
          *,
          department:main_org_departments!main_org_roles_department_id_fkey(id, code, name_th, name_en)
        )
      `)
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลพนักงาน');

    return data;
  }

  /**
   * Delete employee (soft delete - set is_active to false)
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('main_employees')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Link auth account to employee
   */
  static async linkAuth(employeeId: string, email: string, password: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // First create the Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw new DatabaseError(authError.message);
    if (!authData.user) throw new DatabaseError('Failed to create auth user');

    // Then link the auth user to the employee
    const { data, error } = await supabase
      .from('main_employees')
      .update({ 
        auth_user_id: authData.user.id,
        email: authData.user.email || email
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);

    return data;
  }

  /**
   * Link existing auth account to employee
   */
  static async linkExistingAuth(employeeId: string, authUserId: string, email: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Check if auth user exists
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId);
    if (authError) throw new DatabaseError(authError.message);
    if (!authUser.user) throw new DatabaseError('ไม่พบบัญชี Auth ที่ระบุ');

    // Check if auth user is already linked to another employee
    const { data: existingEmployee, error: checkError } = await supabase
      .from('main_employees')
      .select('id, name, code')
      .eq('auth_user_id', authUserId)
      .neq('id', employeeId)
      .maybeSingle();

    if (checkError) throw new DatabaseError(checkError.message);
    if (existingEmployee) {
      throw new DatabaseError(`บัญชีนี้ถูกเชื่อมต่อกับพนักงาน ${existingEmployee.name} (${existingEmployee.code}) อยู่แล้ว`);
    }

    // Link the auth user to the employee
    const { data, error } = await supabase
      .from('main_employees')
      .update({ 
        auth_user_id: authUserId,
        email: email || authUser.user.email || ''
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);

    return data;
  }

  /**
   * Unlink auth account from employee
   */
  static async unlinkAuth(employeeId: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Unlink the auth user from the employee (set auth_user_id to null, keep email)
    const { data, error } = await supabase
      .from('main_employees')
      .update({ 
        auth_user_id: null
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);

    return data;
  }

  /**
   * Get employee counts grouped by department
   * Returns consolidated data about employee counts for each department
   * SIMPLIFIED: Now uses denormalized department_id column on employees
   */
  static async getEmployeeCountsByDepartment(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // Get all active departments
    const { data: departments, error: deptError } = await supabase
      .from('main_org_departments')
      .select('id, code, name_th, name_en')
      .eq('is_active', true)
      .order('name_th');

    if (deptError) throw new DatabaseError(deptError.message);

    // Get all employees with department_id from v_employees view
    const { data: employees, error: empError } = await supabase
      .from('v_employees')
      .select('id, is_active, department_id');

    if (empError) {
      throw new DatabaseError(empError.message);
    }

    // Group employees by department and count
    const departmentCounts = new Map<string, {
      department_id: string;
      department_code: string;
      department_name_th: string;
      department_name_en: string | null;
      total_employees: number;
      active_employees: number;
      inactive_employees: number;
    }>();

    // Initialize all departments with zero counts
    departments?.forEach(dept => {
      departmentCounts.set(dept.id, {
        department_id: dept.id,
        department_code: dept.code,
        department_name_th: dept.name_th,
        department_name_en: dept.name_en || null,
        total_employees: 0,
        active_employees: 0,
        inactive_employees: 0,
      });
    });

    // Count employees by department using department_id from view
    employees?.forEach(emp => {
      const deptId = emp.department_id as string | null | undefined;
      
      if (deptId) {
        const count = departmentCounts.get(deptId);
        
        if (count) {
          count.total_employees++;
          if (emp.is_active) {
            count.active_employees++;
          } else {
            count.inactive_employees++;
          }
        }
      }
    });

    // Convert map to array and sort by department name
    return Array.from(departmentCounts.values())
      .sort((a, b) => a.department_name_th.localeCompare(b.department_name_th));
  }

  /**
   * Master search employees with text search and filters
   * OPTIMIZED: Combined count+data query, cached role lookup
   */
  static async search(params: {
    q?: string;
    page: number;
    limit: number;
    role?: string;
    department_id?: string;
    code?: string;
    is_active?: boolean;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { q, page, limit, role, department_id, code, is_active } = params;

    // If role filter is provided (role code), look up the role_id using cache
    let roleId: string | undefined = undefined;
    if (role) {
      const cachedRoleId = await getRoleIdByCode(role);
      if (!cachedRoleId) {
        // Role code not found, return empty result
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
      roleId = cachedRoleId;
    }

    // Build single query with count + data (combined for performance)
    const offset = (page - 1) * limit;
    // Use v_employees view which has department_id via role relationship
    let query = supabase
      .from('v_employees')
      .select('*', { count: 'exact' });

    // Apply text search if provided
    if (q && q.length >= 1) {
      query = query.or(
        `name.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%,nickname.ilike.%${q}%`
      );
    }

    // Apply filters
    if (roleId) {
      query = query.eq('role_id', roleId);
    }
    if (department_id) {
      query = query.eq('department_id', department_id);
    }
    if (code) {
      query = query.eq('code', code);
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }

    // Execute single query with count and pagination
    const { data, count, error } = await query
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    const total = count || 0;

    // Transform data - v_employees has flat fields from role and department
    const transformedData = (data || []).map(employee => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      nickname: employee.nickname,
      is_active: employee.is_active,
      role_id: employee.role_id,
      role_code: employee.role_code || null,
      role_name: employee.role_name_th || employee.role_name_en || null,
      department_id: employee.department_id || null,
      department_code: employee.department_code || null,
      department_name: employee.department_name_th || employee.department_name_en || null,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    }));

    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Network search employees - Optimized for network user search API
   * Focuses on name/email search and network-relevant filters (department, role, active status)
   * OPTIMIZED: Combined count+data query, cached role lookup
   */
  static async networkSearch(params: {
    q?: string;
    page: number;
    limit: number;
    department_id?: string | string[];
    role?: string;
    role_id?: string;
    is_active?: boolean;
  }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { q, page, limit, department_id, role, role_id, is_active } = params;

    // Determine which role filter to use (role_id takes precedence over role code)
    let roleId: string | undefined = role_id;
    
    // If role_id is not provided but role (code) is, look up the role_id using cache
    if (!roleId && role) {
      const cachedRoleId = await getRoleIdByCode(role);
      if (!cachedRoleId) {
        // Role code not found, return empty result
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
      roleId = cachedRoleId;
    }

    // Normalize department_id to array for consistent handling
    const departmentIds = department_id
      ? (Array.isArray(department_id) ? department_id : [department_id])
      : undefined;

    // Build single query with count + data (using v_employees view)
    const offset = (page - 1) * limit;
    let query = supabase
      .from('v_employees')
      .select('*', { count: 'exact' });

    // Apply text search if provided (name and email only for network search)
    if (q && q.length >= 1) {
      query = query.or(
        `name.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    // Apply filters
    if (roleId) {
      query = query.eq('role_id', roleId);
    }
    if (departmentIds) {
      query = query.in('department_id', departmentIds);
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }

    // Execute single query with count and pagination
    const { data, count, error } = await query
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    const total = count || 0;

    // Transform data - v_employees has flat fields
    const transformedData = (data || []).map(employee => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      nickname: employee.nickname,
      is_active: employee.is_active,
      role_id: employee.role_id,
      role_code: employee.role_code || null,
      role_name: employee.role_name_th || employee.role_name_en || null,
      department_id: employee.department_id || null,
      department_code: employee.department_code || null,
      department_name: employee.department_name_th || employee.department_name_en || null,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
      auth_user_id: employee.auth_user_id || null,
    }));

    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get employee summary
   * Returns lightweight employee list with minimal fields (only active employees)
   */
  static async getEmployeeSummary(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // Get all active employees with role information
    const { data: employees, error: empError } = await supabase
      .from('main_employees')
      .select(`
        id,
        name,
        email,
        auth_user_id,
        profile_image_url,
        role:main_org_roles!role_id(
          name_th
        )
      `)
      .eq('is_active', true)
      .order('name');

    if (empError) throw new DatabaseError(empError.message);

    // Transform to summary format
    return (employees || []).map(emp => ({
      id: emp.id,
      name: emp.name,
      email: emp.email || null,
      role_name: (emp.role as Record<string, unknown> | null)?.name_th || null,
      is_link_auth: emp.auth_user_id !== null && emp.auth_user_id !== undefined,
      profile_image_url: emp.profile_image_url || null,
    }));
  }

  /**
   * Get technicians with workload status for a given date
   * Returns all active employees from 'technical' department with workload level
   * Workload is based on appointment count: 0=no_work, 1-2=light, 3-4=medium, 5+=heavy
   * If no date is provided, returns all technicians with "no_work" status
   * OPTIMIZED: Uses cached department lookup
   */
  static async getTechniciansWithWorkload(
    date?: string
  ): Promise<Array<{ id: string; name: string; workload: 'no_work' | 'light' | 'medium' | 'heavy' }>> {
    const supabase = createServiceClient();

    // Step 1: Get department ID for 'technical' department using cache
    const departmentId = await getDepartmentIdByCode('technical');

    if (!departmentId) {
      throw new DatabaseError('ไม่พบข้อมูลฝ่ายช่างเทคนิค');
    }

    // Step 2: Get all active technicians from technical department
    // Use v_employees view which has department_id via role relationship
    const { data: technicians, error: techError } = await supabase
      .from('v_employees')
      .select('id, name')
      .eq('is_active', true)
      .eq('department_id', departmentId);

    if (techError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลพนักงานได้: ${techError.message}`);
    }

    if (!technicians || technicians.length === 0) {
      return [];
    }

    const technicalEmployees = technicians;

    // If no date provided, return all technicians with "no_work" status
    if (!date) {
      return technicalEmployees.map(tech => ({
        id: tech.id as string,
        name: tech.name as string,
        workload: 'no_work' as const,
      }));
    }

    const technicianIds = technicalEmployees.map(t => t.id as string);

    // Step 3: Query for appointments on the given date
    const { data: ticketEmployees, error: queryError } = await supabase
      .from('jct_ticket_employees')
      .select(`
        employee_id,
        ticket:main_tickets!jct_ticket_employees_ticket_id_fkey(
          appointment:main_appointments!main_tickets_appointment_id_fkey(
            appointment_date
          )
        )
      `)
      .in('employee_id', technicianIds);

    if (queryError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลนัดหมายได้: ${queryError.message}`);
    }

    // Step 4: Count appointments per technician on the given date
    const appointmentCounts = new Map<string, number>();

    if (ticketEmployees) {
      ticketEmployees.forEach(te => {
        const ticket = te.ticket as Record<string, unknown> | null;
        const appointment = ticket?.appointment as Record<string, unknown> | null;

        if (!appointment) return;

        const appointmentDate = appointment.appointment_date as string | null;
        if (appointmentDate !== date) return;

        const empId = te.employee_id as string;
        if (!empId) return;

        // Count ALL appointments including call_to_schedule
        const currentCount = appointmentCounts.get(empId) || 0;
        appointmentCounts.set(empId, currentCount + 1);
      });
    }

    // Step 5: Map technicians with workload status
    return technicalEmployees.map(tech => {
      const techId = tech.id as string;
      const appointmentCount = appointmentCounts.get(techId) || 0;

      // Determine workload level based on appointment count
      let workload: 'no_work' | 'light' | 'medium' | 'heavy';
      if (appointmentCount === 0) {
        workload = 'no_work';
      } else if (appointmentCount <= 2) {
        workload = 'light';
      } else if (appointmentCount <= 4) {
        workload = 'medium';
      } else {
        workload = 'heavy';
      }

      return {
        id: techId,
        name: tech.name as string,
        workload,
      };
    });
  }

}

