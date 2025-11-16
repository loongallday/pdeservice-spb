/**
 * Employee service - Business logic for employee operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface EmployeeQueryParams {
  page: number;
  limit: number;
  role?: string;
  department_id?: string;
  is_active?: boolean;
}

export class EmployeeService {
  /**
   * Get all employees with pagination and filters
   */
  static async getAll(params: EmployeeQueryParams): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, ...filters } = params;

    // If role filter is provided (role code), look up the role_id
    let roleId: string | undefined = undefined;
    if (filters.role) {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('code', filters.role)
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

    // Get total count
    let countQuery = supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    // Apply filters to count query
    if (roleId) {
      countQuery = countQuery.eq('role_id', roleId);
    }
    if (filters.department_id) {
      countQuery = countQuery.eq('department_id', filters.department_id);
    }
    if (filters.is_active !== undefined) {
      countQuery = countQuery.eq('is_active', filters.is_active);
    }

    const { count, error: countError } = await countQuery;

    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get paginated data
    let dataQuery = supabase
      .from('employees')
      .select(`
        *,
        role_data:roles!role_id(
          *,
          department:departments!department_id(id, code, name_th, name_en)
        )
      `)
      .order('name')
      .range(from, to);

    // Apply filters to data query
    if (roleId) {
      dataQuery = dataQuery.eq('role_id', roleId);
    }
    if (filters.department_id) {
      dataQuery = dataQuery.eq('department_id', filters.department_id);
    }
    if (filters.is_active !== undefined) {
      dataQuery = dataQuery.eq('is_active', filters.is_active);
    }

    const { data, error } = await dataQuery;

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

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
   * Get employee by code
   */
  static async getByCode(code: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);

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

    return data;
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
}

