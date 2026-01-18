/**
 * @fileoverview TypeScript type definitions for api-employees
 * @module api-employees/types
 *
 * Contains all DTOs, interfaces, and type definitions used by the
 * Employee API endpoints and services.
 */

// =============================================================================
// Core Entity Types
// =============================================================================

/**
 * Department entity from main_org_departments table
 */
export interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string | null;
}

/**
 * Role entity from main_org_roles table
 */
export interface Role {
  id: string;
  code: string;
  name_th: string;
  name_en: string | null;
  name: string | null;
  description: string | null;
  level: number | null;
  department_id: string | null;
  is_active: boolean;
  requires_auth: boolean;
  created_at: string;
  updated_at: string;
  /** Nested department when fetched with relationship */
  department?: Department | null;
}

/**
 * Base employee entity from main_employees table
 */
export interface Employee {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  auth_user_id: string | null;
  nickname: string | null;
  email: string | null;
  role_id: string | null;
  profile_image_url: string | null;
  cover_image_url: string | null;
  supervisor_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Employee with role and department data (joined response)
 */
export interface EmployeeWithRole extends Employee {
  role_data: Role | null;
}

// =============================================================================
// Request DTOs
// =============================================================================

/**
 * Input for creating a new employee
 * POST /api-employees
 */
export interface CreateEmployeeInput {
  /** Employee full name (required) */
  name: string;
  /** Employee code/ID (required) */
  code: string;
  /** Employee nickname */
  nickname?: string;
  /** Email address */
  email?: string;
  /** Role ID (UUID) - preferred over role code */
  role_id?: string;
  /** Role code (legacy, will be converted to role_id) */
  role?: string;
  /** Profile image URL */
  profile_image_url?: string;
  /** Cover image URL */
  cover_image_url?: string;
  /** Supervisor employee ID */
  supervisor_id?: string;
  /** Active status (defaults to true) */
  is_active?: boolean;
}

/**
 * Input for updating an existing employee
 * PUT /api-employees/:id
 */
export interface UpdateEmployeeInput {
  /** Employee full name */
  name?: string;
  /** Employee code/ID */
  code?: string;
  /** Employee nickname */
  nickname?: string;
  /** Email address */
  email?: string;
  /** Role ID (UUID) - preferred over role code */
  role_id?: string;
  /** Role code (legacy, will be converted to role_id) */
  role?: string;
  /** Profile image URL */
  profile_image_url?: string;
  /** Cover image URL */
  cover_image_url?: string;
  /** Supervisor employee ID */
  supervisor_id?: string;
  /** Active status */
  is_active?: boolean;
}

/**
 * Fields that employees can update on their own profile
 * (without admin permissions)
 */
export type SelfUpdateFields = 'name' | 'nickname' | 'email' | 'profile_image_url';

/**
 * Input for linking a new auth account to an employee
 * POST /api-employees/:id/link-auth
 */
export interface LinkAuthInput {
  /** Email for the new auth account */
  email: string;
  /** Password for the new auth account */
  password: string;
}

/**
 * Input for linking an existing auth account to an employee
 * POST /api-employees/:id/link-existing-auth
 */
export interface LinkExistingAuthInput {
  /** Existing Supabase auth user ID */
  auth_user_id: string;
  /** Email to set on the employee record */
  email?: string;
}

// =============================================================================
// Search Parameters
// =============================================================================

/**
 * Parameters for master employee search
 * GET /api-employees/search
 */
export interface EmployeeSearchParams {
  /** Text search query (searches name, code, email, nickname) */
  q?: string;
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Filter by role code */
  role?: string;
  /** Filter by role ID */
  role_id?: string;
  /** Filter by department ID */
  department_id?: string;
  /** Filter by employee code (exact match) */
  code?: string;
  /** Filter by active status */
  is_active?: boolean;
}

/**
 * Parameters for network employee search
 * GET /api-employees/network-search
 */
export interface NetworkSearchParams {
  /** Text search query (searches name, email only) */
  q?: string;
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Filter by department ID(s) - single or array */
  department_id?: string | string[];
  /** Filter by role code */
  role?: string;
  /** Filter by role ID */
  role_id?: string;
  /** Filter by active status */
  is_active?: boolean;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Employee summary item (lightweight for lists/dropdowns)
 */
export interface EmployeeSummary {
  id: string;
  name: string;
  email: string | null;
  role_name: string | null;
  is_link_auth: boolean;
  profile_image_url: string | null;
}

/**
 * Flattened employee for search results (from v_employees view)
 */
export interface EmployeeSearchResult {
  id: string;
  code: string;
  name: string;
  email: string | null;
  nickname: string | null;
  is_active: boolean;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  created_at: string;
  updated_at: string;
  /** Only included in network search */
  auth_user_id?: string | null;
}

/**
 * Technician workload status
 */
export type WorkloadLevel = 'no_work' | 'light' | 'medium' | 'heavy';

/**
 * Technician with workload information
 */
export interface TechnicianWithWorkload {
  id: string;
  name: string;
  workload: WorkloadLevel;
}

/**
 * Department employee count statistics
 */
export interface DepartmentEmployeeCount {
  department_id: string;
  department_code: string;
  department_name_th: string;
  department_name_en: string | null;
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
}

// =============================================================================
// Achievement Types (from achievementService)
// =============================================================================

/**
 * Period type for achievement goals
 */
export type PeriodType = 'daily' | 'weekly' | 'monthly';

/**
 * Status of an achievement
 */
export type AchievementStatus = 'in_progress' | 'completed';

/**
 * Status of a coupon
 */
export type CouponStatus = 'available' | 'redeemed' | 'expired';

/**
 * Supported action types for achievement tracking
 */
export type ActionType = 'ticket_create';

/**
 * Achievement goal definition
 */
export interface AchievementGoal {
  id: string;
  name: string;
  description: string | null;
  action_type: string;
  period_type: PeriodType;
  target_count: number;
  reward_type: string;
  reward_description: string | null;
  is_active: boolean;
}

/**
 * Employee achievement progress record
 */
export interface EmployeeAchievement {
  id: string;
  employee_id: string;
  goal_id: string;
  period_start: string;
  period_end: string;
  current_count: number;
  status: AchievementStatus;
  completed_at: string | null;
}

/**
 * Employee coupon record
 */
export interface EmployeeCoupon {
  id: string;
  employee_id: string;
  achievement_id: string | null;
  coupon_type: string;
  coupon_description: string | null;
  status: CouponStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
}

/**
 * Achievement progress item for API response
 */
export interface AchievementProgressItem {
  goal: {
    id: string;
    name: string;
    description: string | null;
    period_type: string;
    target_count: number;
    reward_type: string;
    reward_description: string | null;
  };
  current_count: number;
  target_count: number;
  period_start: string;
  period_end: string;
  status: string;
  percentage: number;
}

/**
 * Response from achievement tracking action
 */
export interface TrackActionResponse {
  goals_updated: number;
  coupons_earned: number;
  progress: AchievementProgressItem[];
}

/**
 * Input for tracking an achievement action
 * POST /api-employees/achievements/track
 */
export interface TrackActionInput {
  /** Type of action performed (e.g., 'ticket_create') */
  action_type: ActionType;
}
