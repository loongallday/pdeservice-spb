/**
 * Initialize Service - Aggregates initial app data
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { DatabaseError } from '../_shared/error.ts';
import { getEmployeeLevel } from '../_shared/auth.ts';
import type { Employee } from '../_shared/auth.ts';

export interface InitializeData {
  employee: Employee;
  roles: Record<string, unknown>[];
  departments: Record<string, unknown>[];
  features: Record<string, unknown>[];
}

export class InitializeService {
  /**
   * Get all initialization data for the app
   */
  static async getInitializeData(employee: Employee): Promise<InitializeData> {
    const supabase = createServiceClient();
    
    // Get employee level and role for feature filtering
    const employeeLevel = getEmployeeLevel(employee);
    const employeeRole = employee.role_data?.code || null;

    // Fetch all data in parallel for better performance
    const [rolesResult, departmentsResult, featuresResult, employeeResult] = await Promise.all([
      // Get all roles
      supabase
        .from('roles')
        .select(`
          *,
          department:departments(*)
        `)
        .order('level'),

      // Get all departments
      supabase
        .from('departments')
        .select('*')
        .order('code'),

      // Get enabled features for this employee (only active features)
      supabase
        .from('feature')
        .select('*')
        .eq('is_active', true)
        .lte('min_level', employeeLevel)
        .order('id'),

      // Get full employee details with role data
      supabase
        .from('employees')
        .select(`
          *,
          role_data:roles!role_id(
            id,
            code,
            name_th,
            name_en,
            description,
            level,
            department_id,
            is_active,
            requires_auth,
            department:departments!roles_department_id_fkey(
              id,
              code,
              name_th,
              name_en,
              description,
              is_active
            )
          )
        `)
        .eq('id', employee.id)
        .single(),
    ]);

    // Handle errors
    if (rolesResult.error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลบทบาทได้');
    }

    if (departmentsResult.error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลแผนกได้');
    }

    if (featuresResult.error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลฟีเจอร์ได้');
    }

    if (employeeResult.error || !employeeResult.data) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลพนักงานได้');
    }

    // Filter features by allowed_roles (if specified)
    const filteredFeatures = (featuresResult.data || []).filter((item) => {
      const allowedRoles = item.allowed_roles as string[] | null;
      
      // If no role restriction specified, only min_level check applies
      if (!allowedRoles || allowedRoles.length === 0) {
        return true;
      }
      
      // If role restriction exists, employee must have one of the allowed roles
      if (!employeeRole) {
        return false;
      }
      
      // Normalize and check if employee role is in allowed roles
      const normalizedAllowedRoles = allowedRoles.map((r: string) => r.trim().toLowerCase());
      const normalizedEmployeeRole = employeeRole.trim().toLowerCase();
      
      return normalizedAllowedRoles.includes(normalizedEmployeeRole);
    });
    
    // Remove min_level from response (security: users don't need to know level requirements)
    const features = filteredFeatures.map(({ min_level: _min_level, ...rest }) => rest);

    return {
      employee: employeeResult.data as Employee,
      roles: rolesResult.data || [],
      departments: departmentsResult.data || [],
      features,
    };
  }
}

