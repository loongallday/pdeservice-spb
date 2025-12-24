/**
 * In-memory cache for reference data
 * Caches static data (work_types, ticket_statuses, roles, departments) with TTL
 * Reduces database round trips for frequently accessed reference tables
 */

import { createServiceClient } from './supabase.ts';

interface CacheEntry<T> {
  data: T;
  expires: number;
}

// Global cache instance
const referenceDataCache = new Map<string, CacheEntry<unknown>>();

// Default TTL: 5 minutes
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get cached reference data for a table
 * If cache is expired or missing, fetches from database and caches
 */
export async function getCachedReferenceData<T>(
  table: string,
  options?: {
    ttl?: number;
    select?: string;
  }
): Promise<T[]> {
  const ttl = options?.ttl ?? DEFAULT_CACHE_TTL;
  const select = options?.select ?? '*';
  const cacheKey = `${table}:${select}`;

  // Check cache
  const cached = referenceDataCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T[];
  }

  // Fetch from database
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(table)
    .select(select);

  if (error) {
    // If we have stale cache, return it rather than failing
    if (cached) {
      console.warn(`[cache] Failed to refresh ${table}, using stale cache:`, error.message);
      return cached.data as T[];
    }
    throw error;
  }

  // Store in cache
  referenceDataCache.set(cacheKey, {
    data: data || [],
    expires: Date.now() + ttl,
  });

  return (data || []) as T[];
}

/**
 * Get work types with caching
 */
export async function getCachedWorkTypes(): Promise<Array<{ id: string; name: string; code: string }>> {
  return getCachedReferenceData('work_types', {
    select: 'id, name, code',
  });
}

/**
 * Get ticket statuses with caching
 */
export async function getCachedTicketStatuses(): Promise<Array<{ id: string; name: string; code: string }>> {
  return getCachedReferenceData('ticket_statuses', {
    select: 'id, name, code',
  });
}

/**
 * Get roles with caching
 */
export async function getCachedRoles(): Promise<Array<{ id: string; name_th: string; code: string; department_id: string }>> {
  return getCachedReferenceData('roles', {
    select: 'id, name_th, code, department_id',
  });
}

/**
 * Get departments with caching
 */
export async function getCachedDepartments(): Promise<Array<{ id: string; name_th: string; code: string; is_active: boolean }>> {
  return getCachedReferenceData('departments', {
    select: 'id, name_th, code, is_active',
  });
}

/**
 * Get leave types with caching
 */
export async function getCachedLeaveTypes(): Promise<Array<{ id: string; name: string; code: string }>> {
  return getCachedReferenceData('leave_types', {
    select: 'id, name, code',
  });
}

/**
 * Invalidate cache for a specific table
 */
export function invalidateCache(table: string): void {
  // Remove all entries for this table
  const keysToDelete: string[] = [];
  for (const key of referenceDataCache.keys()) {
    if (key.startsWith(`${table}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => referenceDataCache.delete(key));
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  referenceDataCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: referenceDataCache.size,
    keys: Array.from(referenceDataCache.keys()),
  };
}


