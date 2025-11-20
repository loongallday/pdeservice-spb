/**
 * Department Service - Database operations for departments
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';
import { sanitizeData } from '../../_shared/sanitize.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';

export class DepartmentService {
  /**
   * Sanitize department data based on actual schema
   */
  private static sanitizeDepartmentData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = [
      'code',
      'name_th',
      'name_en',
      'description',
      'is_active',
      'head_id',
    ];
    return sanitizeData(data, validFields);
  }

  /**
   * Search departments by code or name with pagination
   */
  static async search(
    query: string,
    params: { page: number; limit: number }
  ): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit } = params;

    // Build count query
    let countQuery = supabase
      .from('departments')
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
      .from('departments')
      .select('*');

    // Apply search filter if query is provided
    if (query && query.length >= 1) {
      dataQuery = dataQuery.or(
        `code.ilike.%${query}%,name_th.ilike.%${query}%,name_en.ilike.%${query}%`
      );
    }

    const { data, error } = await dataQuery
      .order('code')
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }
  

  /**
   * Get single department by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบแผนก');
      }
      throw new DatabaseError(error.message);
    }
    
    return data;
  }

  /**
   * Create new department
   */
  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeDepartmentData(data);
    
    const { data: department, error } = await supabase
      .from('departments')
      .insert([sanitized])
      .select()
      .single();
    
    if (error) throw new DatabaseError(error.message);
    
    return department;
  }

  /**
   * Update existing department
   */
  static async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeDepartmentData(data);
    
    const { data: department, error } = await supabase
      .from('departments')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new DatabaseError(error.message);
    
    return department;
  }

  /**
   * Delete department
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    
    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Get department summary with employee and role counts
   * Returns consolidated data about employee and role counts for each department
   */
  static async getDepartmentSummary(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // Get all departments
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, code, name_th, name_en')
      .eq('is_active', true)
      .order('name_th');

    if (deptError) throw new DatabaseError(deptError.message);

    // Get all roles grouped by department
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, department_id, is_active');

    if (rolesError) throw new DatabaseError(rolesError.message);

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

    // Fetch all departments to build a complete map (for roles that might reference inactive departments)
    const { data: allDepartments, error: allDeptError } = await supabase
      .from('departments')
      .select('id, code, name_th, name_en');

    if (allDeptError) throw new DatabaseError(allDeptError.message);

    const departmentMap = new Map<string, Record<string, unknown>>();
    allDepartments?.forEach(dept => {
      departmentMap.set(dept.id as string, dept);
    });

    // Group employees and roles by department and count
    const departmentCounts = new Map<string, {
      department_id: string;
      department_code: string;
      department_name_th: string;
      department_name_en: string | null;
      total_employees: number;
      active_employees: number;
      inactive_employees: number;
      total_roles: number;
      active_roles: number;
      inactive_roles: number;
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
        total_roles: 0,
        active_roles: 0,
        inactive_roles: 0,
      });
    });

    // Count roles by department
    roles?.forEach(role => {
      const deptId = role.department_id as string | null | undefined;
      
      if (deptId) {
        const count = departmentCounts.get(deptId);
        
        if (count) {
          // Department is in active list
          count.total_roles++;
          if (role.is_active) {
            count.active_roles++;
          } else {
            count.inactive_roles++;
          }
        } else {
          // Department exists but not in active list, add it
          const department = departmentMap.get(deptId);
          if (department) {
            departmentCounts.set(deptId, {
              department_id: deptId,
              department_code: (department.code as string) || '',
              department_name_th: (department.name_th as string) || '',
              department_name_en: (department.name_en as string) || null,
              total_employees: 0,
              active_employees: 0,
              inactive_employees: 0,
              total_roles: 1,
              active_roles: role.is_active ? 1 : 0,
              inactive_roles: role.is_active ? 0 : 1,
            });
          }
        }
      }
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
          const existing = departmentCounts.get(deptId);
          if (existing) {
            // Already added by roles, just update employee counts
            existing.total_employees++;
            if (emp.is_active) {
              existing.active_employees++;
            } else {
              existing.inactive_employees++;
            }
          } else {
            // New department, initialize with employee count
            departmentCounts.set(deptId, {
              department_id: deptId,
              department_code: (department.code as string) || '',
              department_name_th: (department.name_th as string) || '',
              department_name_en: (department.name_en as string) || null,
              total_employees: 1,
              active_employees: emp.is_active ? 1 : 0,
              inactive_employees: emp.is_active ? 0 : 1,
              total_roles: 0,
              active_roles: 0,
              inactive_roles: 0,
            });
          }
        }
        // If department doesn't exist in database, skip it (invalid reference)
      }
    });

    // Convert map to array and sort by department name
    return Array.from(departmentCounts.values())
      .sort((a, b) => a.department_name_th.localeCompare(b.department_name_th));
  }
}

