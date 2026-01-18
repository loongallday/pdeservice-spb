/**
 * Request validation utilities
 */

import { ValidationError } from './error.ts';

/**
 * Validate UUID format
 */
export function validateUUID(value: string, fieldName = 'ID'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`${fieldName} ไม่ถูกต้อง`);
  }
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} จำเป็นต้องระบุ`);
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new ValidationError('อีเมลไม่ถูกต้อง');
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} ต้องอยู่ระหว่าง ${min} ถึง ${max}`);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value.length < min || value.length > max) {
    throw new ValidationError(
      `${fieldName} ต้องมีความยาวระหว่าง ${min} ถึง ${max} ตัวอักษร`
    );
  }
}

/**
 * Parse pagination parameters from URL
 */
export function parsePaginationParams(url: URL): { page: number; limit: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  
  return { page, limit };
}

/**
 * Remove prototype pollution vectors from an object recursively
 */
function sanitizePrototypePollution(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizePrototypePollution);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Skip prototype pollution vectors
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    sanitized[key] = sanitizePrototypePollution(value);
  }
  return sanitized;
}

/**
 * Parse request body as JSON with prototype pollution protection
 */
export async function parseRequestBody<T>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    // Sanitize to prevent prototype pollution attacks
    const sanitized = sanitizePrototypePollution(body);
    return sanitized as T;
  } catch (_error) {
    throw new ValidationError('ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }
}

