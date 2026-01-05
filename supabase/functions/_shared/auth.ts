/**
 * Authentication and authorization middleware for Edge Functions
 * Respects the current RLS system using role levels
 */

import { createServiceClient } from './supabase.ts';
import { AuthenticationError, AuthorizationError } from './error.ts';

export interface Employee {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  role_id: string | null;
  auth_user_id: string | null;
  is_active: boolean;
  role_data?: {
    id: string;
    code: string;
    name_th: string;
    level: number | null;
  } | null;
}

export interface AuthContext {
  employee: Employee;
  authToken: string;
}

/**
 * Extract and validate JWT token from request
 * Get employee info from the database
 */
export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('ไม่พบข้อมูลการยืนยันตัวตน');
  }
  
  const authToken = authHeader.replace('Bearer ', '');
  
  // Create service client to query employee
  const supabase = createServiceClient();
  
  // Verify the JWT and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
  
  if (authError || !user) {
    throw new AuthenticationError('Session หมดอายุกรุณาเข้าใช้งานใหม่');
  }
  
  // Get employee info with role data (using v_employees view)
  const { data: employee, error: employeeError } = await supabase
    .from('v_employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();
  
  // Map view fields to role_data structure for compatibility
  if (employee) {
    employee.role_data = {
      id: employee.role_id,
      code: employee.role_code,
      name_th: employee.role_name_th,
      level: employee.role_level,
    };
  }
  
  if (employeeError || !employee) {
    throw new AuthenticationError('ไม่พบข้อมูลพนักงาน');
  }
  
  return {
    employee: employee as Employee,
    authToken,
  };
}

/**
 * Check if employee has minimum role level
 * Follows the current RLS system logic: user_has_min_level(min_level)
 * 
 * Role Levels:
 * - Level 0: technician_l1
 * - Level 1: assigner, pm_l1/l2, rma_l1/l2, sale_l1/l2, technician, technician_l2
 * - Level 2: admin
 * - Level 3: superadmin
 */
export async function requireMinLevel(employee: Employee, minLevel: number): Promise<void> {
  const level = employee.role_data?.level ?? 0;
  
  if (level < minLevel) {
    throw new AuthorizationError(`ต้องมีสิทธิ์ระดับ ${minLevel} ขึ้นไป`);
  }
}

/**
 * Check if employee's role level is greater than 0
 * Follows the current RLS system logic: current_user_is_role_level_gt0()
 */
export async function requireLevelGreaterThanZero(employee: Employee): Promise<void> {
  const level = employee.role_data?.level ?? 0;
  
  if (level <= 0) {
    throw new AuthorizationError('ไม่มีสิทธิ์เข้าถึง');
  }
}

/**
 * Get employee role level
 */
export function getEmployeeLevel(employee: Employee): number {
  return employee.role_data?.level ?? 0;
}

/**
 * Check if employee is admin or higher (level >= 2)
 */
export function isAdmin(employee: Employee): boolean {
  const level = employee.role_data?.level ?? 0;
  return level >= 2;
}

/**
 * Check if employee is superadmin (level >= 3)
 */
export function isSuperAdmin(employee: Employee): boolean {
  const level = employee.role_data?.level ?? 0;
  return level >= 3;
}

/**
 * Check if employee can approve appointments
 * Requires level >= 1 (assigner, pm, sale, technician_l2, etc.)
 */
export async function requireCanApproveAppointments(employee: Employee): Promise<void> {
  const level = employee.role_data?.level ?? 0;
  
  if (level < 1) {
    throw new AuthorizationError('ไม่มีสิทธิ์อนุมัตินัดหมาย');
  }
}

/**
 * Check if employee can approve appointments (returns boolean)
 * Returns true if level >= 1
 */
export async function canApproveAppointments(employee: Employee): Promise<boolean> {
  const level = employee.role_data?.level ?? 0;
  return level >= 1;
}

