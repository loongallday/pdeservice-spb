/**
 * Feature Service - Database operations for features
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

export class FeatureService {
  /**
   * Get enabled features for a specific employee level and role
   * Returns features where:
   * - is_active = true
   * - min_level <= employeeLevel
   * - AND (allowed_roles is null OR employeeRole is in allowed_roles)
   */
  static async getEnabledFeatures(employeeLevel: number, employeeRole: string | null): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('main_features')
      .select('*')
      .eq('is_active', true)
      .lte('min_level', employeeLevel)
      .order('id');
    
    if (error) throw new DatabaseError(error.message);
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Filter by allowed_roles (if specified)
    // Both min_level AND allowed_roles checks must pass
    const filteredData = data.filter((item) => {
      // Check allowed_roles (if specified)
      const allowedRoles = item.allowed_roles as string[] | null;
      
      // If no role restriction specified, only min_level check applies
      if (!allowedRoles || allowedRoles.length === 0) {
        return true; // Passed min_level check, no role restriction
      }
      
      // If role restriction exists, employee must have one of the allowed roles
      if (!employeeRole) {
        return false; // Role restriction exists but employee has no role
      }
      
      // Normalize and check if employee role is in allowed roles
      const normalizedAllowedRoles = allowedRoles.map((r: string) => r.trim().toLowerCase());
      const normalizedEmployeeRole = employeeRole.trim().toLowerCase();
      
      return normalizedAllowedRoles.includes(normalizedEmployeeRole);
    });
    
    // Remove min_level from response (security: users don't need to know level requirements)
    return filteredData.map(({ min_level: _min_level, ...rest }) => rest);
  }

  /**
   * Get menu items as flat array
   * Filters by:
   * - is_active = true
   * - is_menu_item = true
   * - min_level <= employeeLevel (level-based permission)
   * - allowed_roles (if specified, employee must have one of the roles)
   * 
   * All conditions must pass for an item to be included.
   */
  static async getMenuItems(employeeLevel: number, employeeRole: string | null): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    // Step 1: Query menu items filtered by is_active, is_menu_item, and min_level
    // This filters at database level for performance
    const { data, error } = await supabase
      .from('main_features')
      .select('*')
      .eq('is_active', true)
      .eq('is_menu_item', true)
      .lte('min_level', employeeLevel)
      .order('display_order', { ascending: true });
    
    if (error) throw new DatabaseError(error.message);
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Step 2: Filter by allowed_roles (if specified)
    // Both min_level AND allowed_roles checks must pass
    const filteredData = data.filter((item) => {
      // Check 1: min_level (already filtered by database query above)
      // This is already satisfied by the query, but we keep it for clarity
      const itemMinLevel = (item.min_level as number) ?? 0;
      if (itemMinLevel > employeeLevel) {
        return false;
      }
      
      // Check 2: allowed_roles (if specified)
      const allowedRoles = item.allowed_roles as string[] | null;
      
      // If no role restriction specified, only min_level check applies
      if (!allowedRoles || allowedRoles.length === 0) {
        return true; // Passed min_level check, no role restriction
      }
      
      // If role restriction exists, employee must have one of the allowed roles
      if (!employeeRole) {
        return false; // Role restriction exists but employee has no role
      }
      
      // Normalize and check if employee role is in allowed roles
      const normalizedAllowedRoles = allowedRoles.map((r: string) => r.trim().toLowerCase());
      const normalizedEmployeeRole = employeeRole.trim().toLowerCase();
      
      return normalizedAllowedRoles.includes(normalizedEmployeeRole);
    });

    // Remove min_level from response (security: users don't need to know level requirements)
    return filteredData.map(({ min_level: _min_level, ...rest }) => rest);
  }

  /**
   * Get all features (for admin purposes)
   */
  static async getAll(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('main_features')
      .select('*')
      .order('id');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }
}

