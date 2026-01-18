/**
 * Initialize Service - Aggregates initial app data
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';
import { getEmployeeLevel } from '../../_shared/auth.ts';
import type { Employee } from '../../_shared/auth.ts';

export interface InitializeData {
  employee: Employee;
  department: Record<string, unknown> | null;
  features: Record<string, unknown>[];
}

export interface Constants {
  work_types: Record<string, unknown>[];
  ticket_statuses: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  departments: Record<string, unknown>[];
  work_givers: Record<string, unknown>[];
}

export interface MeResponse extends Employee {
  constants: Constants;
  quotation_url: string;
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
      .from('main_features')
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
   * Now includes constants for optimized bootstrap (reduces 3 API calls to 1)
   */
  static async getCurrentUserInfo(employee: Employee): Promise<MeResponse> {
    const supabase = createServiceClient();

    // Fetch employee data and all constants in parallel for speed
    const [
      employeeResult,
      workTypesResult,
      ticketStatusesResult,
      rolesResult,
      departmentsResult,
      workGiversResult,
    ] = await Promise.all([
      // Employee with role and department
      supabase
        .from('main_employees')
        .select(`
          *,
          role_data:main_org_roles!role_id(
            id,
            code,
            name_th,
            name_en,
            description,
            level,
            department_id,
            is_active,
            requires_auth,
            department:main_org_departments!main_org_roles_department_id_fkey(
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

      // Constants - all fetched in parallel
      supabase.from('ref_ticket_work_types').select('*').order('name'),
      supabase.from('ref_ticket_statuses').select('*').order('name'),
      supabase.from('main_org_roles').select('*').eq('is_active', true).order('name_th'),
      supabase.from('main_org_departments').select('*').eq('is_active', true).order('name_th'),
      supabase.from('ref_work_givers').select('*').eq('is_active', true).order('name'),
    ]);

    if (employeeResult.error || !employeeResult.data) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลพนักงานได้');
    }

    // Check if the employee can approve appointments (user-based)
    const employeeId = employeeResult.data.id as string;
    let canApprove = false;

    if (employeeId) {
      const { data: approvalUser, error: approvalError } = await supabase
        .from('jct_appointment_approvers')
        .select('id')
        .eq('employee_id', employeeId)
        .single();

      // If found (no error and data exists), employee can approve
      canApprove = !approvalError && approvalUser !== null;
    }

    // Add can_approve to role_data
    const employeeData = employeeResult.data as Employee;
    if (employeeData.role_data && typeof employeeData.role_data === 'object') {
      (employeeData.role_data as Record<string, unknown>).can_approve = canApprove;
    }

    // Build constants object
    const constants: Constants = {
      work_types: workTypesResult.data || [],
      ticket_statuses: ticketStatusesResult.data || [],
      roles: rolesResult.data || [],
      departments: departmentsResult.data || [],
      work_givers: workGiversResult.data || [],
    };

    // Return employee data with constants and external links
    return {
      ...employeeData,
      constants,
      quotation_url: 'https://parchment-pen.lovable.app',
    };
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
        .from('main_features')
        .select('*')
        .eq('is_active', true)
        .lte('min_level', employeeLevel)
        .order('id'),

      // Get full employee details with role data
      supabase
        .from('main_employees')
        .select(`
          *,
          role_data:main_org_roles!role_id(
            id,
            code,
            name_th,
            name_en,
            description,
            level,
            department_id,
            is_active,
            requires_auth,
            department:main_org_departments!main_org_roles_department_id_fkey(
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

    // Check if the employee can approve appointments (user-based)
    const employeeId = employeeData.id as string;
    let canApprove = false;
    
    if (employeeId) {
      const { data: approvalUser, error: approvalError } = await supabase
        .from('jct_appointment_approvers')
        .select('id')
        .eq('employee_id', employeeId)
        .single();

      // If found (no error and data exists), employee can approve
      canApprove = !approvalError && approvalUser !== null;
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

