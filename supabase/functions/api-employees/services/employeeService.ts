/**
 * Employee service - Business logic for employee operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export class EmployeeService {

  /**
   * Get single employee by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        role_data:roles!role_id(
          *,
          department:departments!department_id(id, code, name_th, name_en)
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
        .from('roles')
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
      .from('employees')
      .insert([insertData])
      .select(`
        *,
        role_data:roles!role_id(
          *,
          department:departments!department_id(id, code, name_th, name_en)
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
        .from('leave_types')
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
        .from('leave_balances')
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
        .from('employees')
        .select(`
          *,
          role_data:roles!role_id(
            *,
            department:departments!department_id(id, code, name_th, name_en)
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
        .from('roles')
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
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        role_data:roles!role_id(
          *,
          department:departments!department_id(id, code, name_th, name_en)
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
      .from('employees')
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
      .from('employees')
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
      .from('employees')
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
      .from('employees')
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
      .from('employees')
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
   */
  static async getEmployeeCountsByDepartment(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // Get all departments with employee counts
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select(`
        id,
        code,
        name_th,
        name_en,
        is_active,
        head_id
      `)
      .eq('is_active', true)
      .order('name_th');

    if (deptError) throw new DatabaseError(deptError.message);

    // Get all employees with their roles
    // Query roles separately to avoid issues with invalid department_id references
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        is_active,
        role_id,
        role:roles!role_id(
          id,
          department_id
        )
      `);

    if (empError) {
      throw new DatabaseError(empError.message);
    }

    // Get all role department_ids and fetch department info separately
    const roleDepartmentIds = new Set<string>();
    employees?.forEach(emp => {
      const role = emp.role as Record<string, unknown> | null;
      const deptId = role?.department_id as string | null | undefined;
      if (deptId) {
        roleDepartmentIds.add(deptId);
      }
    });

    // Fetch department information for all referenced departments
    const departmentIds = Array.from(roleDepartmentIds);
    const departmentMap = new Map<string, Record<string, unknown>>();
    
    if (departmentIds.length > 0) {
      const { data: deptData, error: deptDataError } = await supabase
        .from('departments')
        .select('id, code, name_th, name_en')
        .in('id', departmentIds);

      if (deptDataError) {
        // If department lookup fails, continue without department info
        // This handles cases where department_id references don't exist
        // Invalid department references will be skipped in the counting logic below
      } else {
        deptData?.forEach(dept => {
          departmentMap.set(dept.id as string, dept);
        });
      }
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

    // Count employees by department
    employees?.forEach(emp => {
      const role = emp.role as Record<string, unknown> | null;
      const deptId = role?.department_id as string | null | undefined;
      
      if (deptId) {
        const department = departmentMap.get(deptId);
        const count = departmentCounts.get(deptId);
        
        if (count) {
          // Department is in active list
          count.total_employees++;
          if (emp.is_active) {
            count.active_employees++;
          } else {
            count.inactive_employees++;
          }
        } else if (department) {
          // Department exists but not in active list, add it
          departmentCounts.set(deptId, {
            department_id: deptId,
            department_code: (department.code as string) || '',
            department_name_th: (department.name_th as string) || '',
            department_name_en: (department.name_en as string) || null,
            total_employees: 1,
            active_employees: emp.is_active ? 1 : 0,
            inactive_employees: emp.is_active ? 0 : 1,
          });
        }
        // If department doesn't exist in database, skip it (invalid reference)
      }
    });

    // Convert map to array and sort by department name
    return Array.from(departmentCounts.values())
      .sort((a, b) => a.department_name_th.localeCompare(b.department_name_th));
  }

  /**
   * Master search employees with text search and filters
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

    // If role filter is provided (role code), look up the role_id
    let roleId: string | undefined = undefined;
    if (role) {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('code', role)
        .maybeSingle();

      if (roleError) throw new DatabaseError(`Failed to lookup role: ${roleError.message}`);
      if (!roleData) {
        // Role code not found, return empty result
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
      roleId = roleData.id;
    }

    // If department_id filter is provided, get all role_ids for that department
    let roleIdsForDepartment: string[] | undefined = undefined;
    if (department_id) {
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id')
        .eq('department_id', department_id);

      if (rolesError) throw new DatabaseError(`Failed to lookup roles by department: ${rolesError.message}`);
      if (!rolesData || rolesData.length === 0) {
        // No roles in this department, return empty result
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
      roleIdsForDepartment = rolesData.map(r => r.id as string);
    }

    // Build count query
    let countQuery = supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    // Apply text search if provided
    if (q && q.length >= 1) {
      countQuery = countQuery.or(
        `name.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%,nickname.ilike.%${q}%`
      );
    }

    // Apply filters
    if (roleId) {
      countQuery = countQuery.eq('role_id', roleId);
    } else if (roleIdsForDepartment) {
      countQuery = countQuery.in('role_id', roleIdsForDepartment);
    }
    if (code) {
      countQuery = countQuery.eq('code', code);
    }
    if (is_active !== undefined) {
      countQuery = countQuery.eq('is_active', is_active);
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Build data query
    const offset = (page - 1) * limit;
    let dataQuery = supabase
      .from('employees')
      .select(`
        *,
        role_data:roles!role_id(
          *,
          department:departments!department_id(id, code, name_th, name_en)
        )
      `);

    // Apply text search if provided
    if (q && q.length >= 1) {
      dataQuery = dataQuery.or(
        `name.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%,nickname.ilike.%${q}%`
      );
    }

    // Apply filters
    if (roleId) {
      dataQuery = dataQuery.eq('role_id', roleId);
    } else if (roleIdsForDepartment) {
      dataQuery = dataQuery.in('role_id', roleIdsForDepartment);
    }
    if (code) {
      dataQuery = dataQuery.eq('code', code);
    }
    if (is_active !== undefined) {
      dataQuery = dataQuery.eq('is_active', is_active);
    }

    const { data, error } = await dataQuery
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    // Transform data to flatten nested objects into display fields
    const transformedData = (data || []).map(employee => {
      const roleData = employee.role_data as {
        id?: string;
        code?: string;
        name_th?: string;
        name_en?: string;
        department?: {
          id?: string;
          code?: string;
          name_th?: string;
          name_en?: string;
        } | null;
      } | null;

      return {
        id: employee.id,
        code: employee.code,
        name: employee.name,
        email: employee.email,
        nickname: employee.nickname,
        is_active: employee.is_active,
        role_id: employee.role_id,
        role_code: roleData?.code || null,
        role_name: roleData?.name_th || roleData?.name_en || null,
        department_id: roleData?.department?.id || null,
        department_code: roleData?.department?.code || null,
        department_name: roleData?.department?.name_th || roleData?.department?.name_en || null,
        created_at: employee.created_at,
        updated_at: employee.updated_at,
      };
    });

    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Network search employees - Optimized for network user search API
   * Focuses on name/email search and network-relevant filters (department, role, active status)
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
    
    // If role_id is not provided but role (code) is, look up the role_id
    if (!roleId && role) {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('code', role)
        .maybeSingle();

      if (roleError) throw new DatabaseError(`Failed to lookup role: ${roleError.message}`);
      if (!roleData) {
        // Role code not found, return empty result
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
      roleId = roleData.id;
    }

    // If department_id filter is provided, get all role_ids for those department(s)
    let roleIdsForDepartment: string[] | undefined = undefined;
    if (department_id) {
      // Normalize to array for consistent handling
      const departmentIds = Array.isArray(department_id) 
        ? department_id 
        : [department_id];

      // Get role IDs that belong to these departments
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id')
        .in('department_id', departmentIds);

      if (rolesError) throw new DatabaseError(`Failed to lookup roles by department: ${rolesError.message}`);
      if (!rolesData || rolesData.length === 0) {
        // No roles in these departments, return empty result
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
      roleIdsForDepartment = rolesData.map(r => r.id as string);
    }

    // Build count query
    let countQuery = supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    // Apply text search if provided (name and email only for network search)
    if (q && q.length >= 1) {
      countQuery = countQuery.or(
        `name.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    // Apply filters
    if (roleId) {
      countQuery = countQuery.eq('role_id', roleId);
    } else if (roleIdsForDepartment) {
      countQuery = countQuery.in('role_id', roleIdsForDepartment);
    }
    if (is_active !== undefined) {
      countQuery = countQuery.eq('is_active', is_active);
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Build data query
    const offset = (page - 1) * limit;
    let dataQuery = supabase
      .from('employees')
      .select(`
        *,
        role_data:roles!role_id(
          *,
          department:departments!department_id(id, code, name_th, name_en)
        )
      `);

    // Apply text search if provided (name and email only for network search)
    if (q && q.length >= 1) {
      dataQuery = dataQuery.or(
        `name.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    // Apply filters
    if (roleId) {
      dataQuery = dataQuery.eq('role_id', roleId);
    } else if (roleIdsForDepartment) {
      dataQuery = dataQuery.in('role_id', roleIdsForDepartment);
    }
    if (is_active !== undefined) {
      dataQuery = dataQuery.eq('is_active', is_active);
    }

    const { data, error } = await dataQuery
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    // Transform data to flatten nested objects into display fields
    const transformedData = (data || []).map(employee => {
      const roleData = employee.role_data as {
        id?: string;
        code?: string;
        name_th?: string;
        name_en?: string;
        department?: {
          id?: string;
          code?: string;
          name_th?: string;
          name_en?: string;
        } | null;
      } | null;

      return {
        id: employee.id,
        code: employee.code,
        name: employee.name,
        email: employee.email,
        nickname: employee.nickname,
        is_active: employee.is_active,
        role_id: employee.role_id,
        role_code: roleData?.code || null,
        role_name: roleData?.name_th || roleData?.name_en || null,
        department_id: roleData?.department?.id || null,
        department_code: roleData?.department?.code || null,
        department_name: roleData?.department?.name_th || roleData?.department?.name_en || null,
        created_at: employee.created_at,
        updated_at: employee.updated_at,
        auth_user_id: employee.auth_user_id || null,
      };
    });

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
      .from('employees')
      .select(`
        id,
        name,
        email,
        auth_user_id,
        profile_image_url,
        role:roles!role_id(
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
   */
  static async getTechniciansWithWorkload(
    date?: string
  ): Promise<Array<{ id: string; name: string; workload: 'no_work' | 'light' | 'medium' | 'heavy' }>> {
    const supabase = createServiceClient();

    // Step 1: Get department ID for 'technical' department
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('id')
      .eq('code', 'technical')
      .single();

    if (deptError || !department) {
      throw new DatabaseError('ไม่พบข้อมูลฝ่ายช่างเทคนิค');
    }

    const departmentId = department.id as string;

    // Step 2: Get all active technicians from technical department
    const { data: technicians, error: techError } = await supabase
      .from('employees')
      .select(`
        id,
        name,
        role:roles!role_id(
          department_id
        )
      `)
      .eq('is_active', true);

    if (techError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลพนักงานได้: ${techError.message}`);
    }

    if (!technicians || technicians.length === 0) {
      return [];
    }

    // Filter technicians by department
    const technicalEmployees = technicians.filter(tech => {
      const role = tech.role as Record<string, unknown> | null;
      return role && (role.department_id as string) === departmentId;
    });

    if (technicalEmployees.length === 0) {
      return [];
    }

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
      .from('ticket_employees')
      .select(`
        employee_id,
        ticket:tickets!ticket_employees_ticket_id_fkey(
          appointment:appointments!tickets_appointment_id_fkey(
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

