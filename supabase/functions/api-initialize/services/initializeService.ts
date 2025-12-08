/**
 * Initialize Service - Aggregates initial app data
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { DatabaseError } from '../_shared/error.ts';
import { getEmployeeLevel } from '../_shared/auth.ts';
import type { Employee } from '../_shared/auth.ts';

export interface InitializeData {
  employee: Employee;
  department: Record<string, unknown> | null;
  features: Record<string, unknown>[];
}

export class InitializeService {
  /**
   * Get enabled features for the current employee
   * Features are filtered by employee level and role
   */
  static async getFeatures(employee: Employee): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    // Get employee level and role for feature filtering
    const employeeLevel = getEmployeeLevel(employee);
    const employeeRole = employee.role_data?.code || null;

    // Get enabled features for this employee (only active features)
    const { data: featuresResult, error: featuresError } = await supabase
      .from('feature')
      .select('*')
      .eq('is_active', true)
      .lte('min_level', employeeLevel)
      .order('id');

    // Handle errors
    if (featuresError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลฟีเจอร์ได้');
    }

    // Filter features: ensure only active features, user can use (level >= min_level), and by allowed_roles (if specified)
    const filteredFeatures = (featuresResult || []).filter((item) => {
      // First, ensure feature is active
      if (!item.is_active) {
        return false;
      }
      
      // Ensure user's level meets the minimum level requirement (user level >= feature min_level)
      const featureMinLevel = item.min_level as number | null | undefined;
      if (featureMinLevel !== null && featureMinLevel !== undefined) {
        if (employeeLevel < featureMinLevel) {
          return false;
        }
      }
      
      const allowedRoles = item.allowed_roles as string[] | null;
      
      // If no role restriction specified, user can use it (already passed level check)
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

    return features;
  }

  /**
   * Get current user information (employee with role and department)
   */
  static async getCurrentUserInfo(employee: Employee): Promise<Employee> {
    const supabase = createServiceClient();

    // Get full employee details with role data
    const { data: employeeResult, error: employeeError } = await supabase
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
      .single();

    if (employeeError || !employeeResult) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลพนักงานได้');
    }

    // Check if the employee's role can approve appointments
    const roleId = employeeResult.role_id as string | null | undefined;
    let canApprove = false;
    
    if (roleId) {
      const { data: approvalRole, error: approvalError } = await supabase
        .from('appointment_approval_roles')
        .select('id')
        .eq('role_id', roleId)
        .single();

      // If found (no error and data exists), role can approve
      canApprove = !approvalError && approvalRole !== null;
    }

    // Add can_approve to role_data
    const employeeData = employeeResult as Employee;
    if (employeeData.role_data && typeof employeeData.role_data === 'object') {
      (employeeData.role_data as Record<string, unknown>).can_approve = canApprove;
    }

    return employeeData;
  }

  /**
   * Get all initialization data for the app
   */
  static async getInitializeData(employee: Employee): Promise<InitializeData> {
    const supabase = createServiceClient();
    
    // Get employee level and role for feature filtering
    const employeeLevel = getEmployeeLevel(employee);
    const employeeRole = employee.role_data?.code || null;

    // Fetch all data in parallel for better performance
    const [featuresResult, employeeResult] = await Promise.all([
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

    // Extract user's department from employee role data
    const employeeData = employeeResult.data as Employee;
    const roleData = employeeData.role_data as (Record<string, unknown> & { department?: Record<string, unknown> | null; id?: string }) | null;
    const userDepartment = roleData?.department || null;

    // Check if the employee's role can approve appointments
    const roleId = roleData?.id as string | null | undefined;
    let canApprove = false;
    
    if (roleId) {
      const { data: approvalRole, error: approvalError } = await supabase
        .from('appointment_approval_roles')
        .select('id')
        .eq('role_id', roleId)
        .single();

      // If found (no error and data exists), role can approve
      canApprove = !approvalError && approvalRole !== null;
    }

    // Add can_approve to role_data
    if (roleData) {
      roleData.can_approve = canApprove;
    }

    return {
      employee: employeeData,
      department: userDepartment,
      features,
    };
  }
}

