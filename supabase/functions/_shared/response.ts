/**
 * Standard API response utilities for Supabase Edge Functions
 */

import { corsHeaders } from './cors.ts';

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface APIResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  pagination?: PaginationInfo;
}

/**
 * Create a successful response with data
 */
export function success<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ data } as APIResponse<T>),
    {
      status,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    }
  );
}

/**
 * Create a successful response with data and pagination
 */
export function successWithPagination<T>(
  data: T,
  pagination: PaginationInfo,
  status = 200
): Response {
  return new Response(
    JSON.stringify({ data, pagination } as APIResponse<T>),
    {
      status,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    }
  );
}

/**
 * Create an error response
 */
export function error(message: string, status = 400, code?: string): Response {
  const body: APIResponse<never> = { error: message };
  if (code) {
    body.code = code;
  }
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    }
  );
}

/**
 * Calculate pagination info
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

