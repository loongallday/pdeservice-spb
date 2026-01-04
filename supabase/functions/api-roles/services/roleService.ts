/**
 * Role Service - Database operations for roles
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export class RoleService {

  /**
   * Get single role by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('main_org_roles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบบทบาท');
      }
      throw new DatabaseError(error.message);
    }
    
    return data;
  }

  /**
   * Create new role
   */
  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data: role, error } = await supabase
      .from('main_org_roles')
      .insert([data])
      .select()
      .single();
    
    if (error) throw new DatabaseError(error.message);
    
    return role;
  }

  /**
   * Update existing role
   */
  static async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    // Check if role exists first
    const { data: _existingRole, error: checkError } = await supabase
      .from('main_org_roles')
      .select('id')
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบบทบาท');
      }
      throw new DatabaseError(checkError.message);
    }
    
    // If no fields to update, return existing role
    if (Object.keys(data).length === 0) {
      return await this.getById(id);
    }
    
    const { data: role, error } = await supabase
      .from('main_org_roles')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบบทบาท');
      }
      throw new DatabaseError(error.message);
    }
    
    if (!role) {
      throw new NotFoundError('ไม่พบบทบาท');
    }
    
    return role;
  }

  /**
   * Search roles by code or name with pagination
   */
  static async search(
    query: string,
    params: { page: number; limit: number }
  ): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit } = params;

    // Build count query
    let countQuery = supabase
      .from('main_org_roles')
      .select('*', { count: 'exact', head: true });

    // Apply search filter if query is provided
    if (query && query.length >= 1) {
      countQuery = countQuery.or(
        `code.ilike.%${query}%,name_th.ilike.%${query}%,name_en.ilike.%${query}%`
      );
    }

    // Get total count
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    const total = count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    let dataQuery = supabase
      .from('main_org_roles')
      .select('*');

    // Apply search filter if query is provided
    if (query && query.length >= 1) {
      dataQuery = dataQuery.or(
        `code.ilike.%${query}%,name_th.ilike.%${query}%,name_en.ilike.%${query}%`
      );
    }

    const { data, error } = await dataQuery
      .order('level')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Delete role
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('main_org_roles')
      .delete()
      .eq('id', id);
    
    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Get role summary with employee counts
   * Returns consolidated data about employee counts for each role
   */
  static async getRoleSummary(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // Get all active roles
    const { data: roles, error: rolesError } = await supabase
      .from('main_org_roles')
      .select('id, code, name_th, name_en, department_id, level')
      .eq('is_active', true)
      .order('level');

    if (rolesError) throw new DatabaseError(rolesError.message);

    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from('main_employees')
      .select('id, is_active, role_id');

    if (empError) {
      throw new DatabaseError(empError.message);
    }

    // Get all departments for role department references
    const { data: allDepartments, error: allDeptError } = await supabase
      .from('main_org_departments')
      .select('id, code, name_th, name_en');

    if (allDeptError) throw new DatabaseError(allDeptError.message);

    const departmentMap = new Map<string, Record<string, unknown>>();
    allDepartments?.forEach(dept => {
      departmentMap.set(dept.id as string, dept);
    });

    // Group employees by role and count
    const roleCounts = new Map<string, {
      role_id: string;
      role_code: string;
      role_name_th: string;
      role_name_en: string | null;
      role_level: number | null;
      department_id: string | null;
      department_code: string | null;
      department_name_th: string | null;
      department_name_en: string | null;
      total_employees: number;
      active_employees: number;
      inactive_employees: number;
    }>();

    // Initialize all active roles with zero counts
    roles?.forEach(role => {
      const deptId = role.department_id as string | null | undefined;
      const department = deptId ? departmentMap.get(deptId) : null;

      roleCounts.set(role.id, {
        role_id: role.id,
        role_code: role.code,
        role_name_th: role.name_th,
        role_name_en: role.name_en || null,
        role_level: role.level || null,
        department_id: deptId || null,
        department_code: department ? (department.code as string) : null,
        department_name_th: department ? (department.name_th as string) : null,
        department_name_en: department ? (department.name_en as string) || null : null,
        total_employees: 0,
        active_employees: 0,
        inactive_employees: 0,
      });
    });

    // Count employees by role
    employees?.forEach(emp => {
      const roleId = emp.role_id as string | null | undefined;
      
      if (roleId) {
        const count = roleCounts.get(roleId);
        
        if (count) {
          // Role is in active list
          count.total_employees++;
          if (emp.is_active) {
            count.active_employees++;
          } else {
            count.inactive_employees++;
          }
        }
        // If role doesn't exist in active list, skip it (inactive role)
      }
    });

    // Convert map to array and sort by level, then name
    return Array.from(roleCounts.values())
      .sort((a, b) => {
        // Sort by level first (nulls last), then by name
        if (a.role_level !== null && b.role_level !== null) {
          if (a.role_level !== b.role_level) {
            return a.role_level - b.role_level;
          }
        } else if (a.role_level !== null) {
          return -1;
        } else if (b.role_level !== null) {
          return 1;
        }
        return a.role_name_th.localeCompare(b.role_name_th);
      });
  }
}

