/**
 * Shared TypeScript types for Edge Functions
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface QueryParams extends PaginationParams {
  [key: string]: string | number | boolean | undefined;
}

export interface DatabaseResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export type UUID = string;

export interface Timestamp {
  created_at: string;
  updated_at: string;
}
