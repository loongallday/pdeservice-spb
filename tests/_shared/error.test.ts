/**
 * Unit tests for error utilities
 * Tests all error classes and handleError function
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  APIError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  IdempotencyError,
  handleError,
} from '../../supabase/functions/_shared/error.ts';

// ============ APIError Tests ============

Deno.test('APIError - default status code is 400', () => {
  const error = new APIError('test error');

  assertEquals(error.message, 'test error');
  assertEquals(error.statusCode, 400);
  assertEquals(error.name, 'APIError');
});

Deno.test('APIError - custom status code', () => {
  const error = new APIError('test error', 500);

  assertEquals(error.statusCode, 500);
});

Deno.test('APIError - custom code', () => {
  const error = new APIError('test error', 400, 'CUSTOM_CODE');

  assertEquals(error.code, 'CUSTOM_CODE');
});

Deno.test('APIError - is instance of Error', () => {
  const error = new APIError('test error');

  assertEquals(error instanceof Error, true);
  assertEquals(error instanceof APIError, true);
});

// ============ AuthenticationError Tests ============

Deno.test('AuthenticationError - default message in Thai', () => {
  const error = new AuthenticationError();

  assertEquals(error.message, 'ไม่ได้รับอนุญาต');
  assertEquals(error.statusCode, 401);
  assertEquals(error.code, 'UNAUTHORIZED');
});

Deno.test('AuthenticationError - custom message', () => {
  const error = new AuthenticationError('Session หมดอายุ');

  assertEquals(error.message, 'Session หมดอายุ');
  assertEquals(error.statusCode, 401);
});

Deno.test('AuthenticationError - is instance of APIError', () => {
  const error = new AuthenticationError();

  assertEquals(error instanceof APIError, true);
  assertEquals(error instanceof AuthenticationError, true);
});

// ============ AuthorizationError Tests ============

Deno.test('AuthorizationError - default message in Thai', () => {
  const error = new AuthorizationError();

  assertEquals(error.message, 'ไม่มีสิทธิ์เข้าถึง');
  assertEquals(error.statusCode, 403);
  assertEquals(error.code, 'FORBIDDEN');
});

Deno.test('AuthorizationError - custom message', () => {
  const error = new AuthorizationError('ต้องมีสิทธิ์ระดับ 2');

  assertEquals(error.message, 'ต้องมีสิทธิ์ระดับ 2');
  assertEquals(error.statusCode, 403);
});

Deno.test('AuthorizationError - is instance of APIError', () => {
  const error = new AuthorizationError();

  assertEquals(error instanceof APIError, true);
  assertEquals(error instanceof AuthorizationError, true);
});

// ============ NotFoundError Tests ============

Deno.test('NotFoundError - default message in Thai', () => {
  const error = new NotFoundError();

  assertEquals(error.message, 'ไม่พบข้อมูล');
  assertEquals(error.statusCode, 404);
  assertEquals(error.code, 'NOT_FOUND');
});

Deno.test('NotFoundError - custom message', () => {
  const error = new NotFoundError('ไม่พบตั๋วงาน');

  assertEquals(error.message, 'ไม่พบตั๋วงาน');
  assertEquals(error.statusCode, 404);
});

Deno.test('NotFoundError - is instance of APIError', () => {
  const error = new NotFoundError();

  assertEquals(error instanceof APIError, true);
  assertEquals(error instanceof NotFoundError, true);
});

// ============ ValidationError Tests ============

Deno.test('ValidationError - sets correct status and code', () => {
  const error = new ValidationError('ข้อมูลไม่ถูกต้อง');

  assertEquals(error.message, 'ข้อมูลไม่ถูกต้อง');
  assertEquals(error.statusCode, 400);
  assertEquals(error.code, 'VALIDATION_ERROR');
});

Deno.test('ValidationError - is instance of APIError', () => {
  const error = new ValidationError('test');

  assertEquals(error instanceof APIError, true);
  assertEquals(error instanceof ValidationError, true);
});

// ============ DatabaseError Tests ============

Deno.test('DatabaseError - default message in Thai', () => {
  const error = new DatabaseError();

  assertEquals(error.message, 'เกิดข้อผิดพลาดในการเข้าถึงข้อมูล');
  assertEquals(error.statusCode, 500);
  assertEquals(error.code, 'DATABASE_ERROR');
});

Deno.test('DatabaseError - custom message', () => {
  const error = new DatabaseError('Connection timeout');

  assertEquals(error.message, 'Connection timeout');
  assertEquals(error.statusCode, 500);
});

Deno.test('DatabaseError - is instance of APIError', () => {
  const error = new DatabaseError();

  assertEquals(error instanceof APIError, true);
  assertEquals(error instanceof DatabaseError, true);
});

// ============ IdempotencyError Tests ============

Deno.test('IdempotencyError - DUPLICATE_KEY_DIFFERENT_PAYLOAD', () => {
  const error = new IdempotencyError('Key conflict', 'DUPLICATE_KEY_DIFFERENT_PAYLOAD');

  assertEquals(error.message, 'Key conflict');
  assertEquals(error.statusCode, 409);
  assertEquals(error.code, 'IDEMPOTENCY_DUPLICATE_KEY_DIFFERENT_PAYLOAD');
  assertEquals(error.idempotencyCode, 'DUPLICATE_KEY_DIFFERENT_PAYLOAD');
});

Deno.test('IdempotencyError - DUPLICATE_KEY_DIFFERENT_USER', () => {
  const error = new IdempotencyError('User mismatch', 'DUPLICATE_KEY_DIFFERENT_USER');

  assertEquals(error.code, 'IDEMPOTENCY_DUPLICATE_KEY_DIFFERENT_USER');
  assertEquals(error.idempotencyCode, 'DUPLICATE_KEY_DIFFERENT_USER');
});

Deno.test('IdempotencyError - REQUEST_IN_PROGRESS', () => {
  const error = new IdempotencyError('Processing', 'REQUEST_IN_PROGRESS');

  assertEquals(error.code, 'IDEMPOTENCY_REQUEST_IN_PROGRESS');
  assertEquals(error.idempotencyCode, 'REQUEST_IN_PROGRESS');
});

Deno.test('IdempotencyError - is instance of APIError', () => {
  const error = new IdempotencyError('test', 'REQUEST_IN_PROGRESS');

  assertEquals(error instanceof APIError, true);
  assertEquals(error instanceof IdempotencyError, true);
});

// ============ handleError Tests ============

Deno.test('handleError - APIError returns correct info', () => {
  const error = new APIError('API error', 422, 'CUSTOM');
  const result = handleError(error);

  assertEquals(result.message, 'API error');
  assertEquals(result.statusCode, 422);
  assertEquals(result.code, 'CUSTOM');
});

Deno.test('handleError - AuthenticationError returns 401', () => {
  const error = new AuthenticationError('Invalid token');
  const result = handleError(error);

  assertEquals(result.message, 'Invalid token');
  assertEquals(result.statusCode, 401);
  assertEquals(result.code, 'UNAUTHORIZED');
});

Deno.test('handleError - ValidationError returns 400', () => {
  const error = new ValidationError('Invalid data');
  const result = handleError(error);

  assertEquals(result.message, 'Invalid data');
  assertEquals(result.statusCode, 400);
  assertEquals(result.code, 'VALIDATION_ERROR');
});

Deno.test('handleError - NotFoundError returns 404', () => {
  const error = new NotFoundError('Resource not found');
  const result = handleError(error);

  assertEquals(result.message, 'Resource not found');
  assertEquals(result.statusCode, 404);
  assertEquals(result.code, 'NOT_FOUND');
});

Deno.test('handleError - JWT error returns 401', () => {
  const error = new Error('JWT expired');
  const result = handleError(error);

  assertEquals(result.message, 'Session หมดอายุกรุณาเข้าใช้งานใหม่');
  assertEquals(result.statusCode, 401);
});

Deno.test('handleError - duplicate key error returns 409', () => {
  const error = new Error('duplicate key value violates unique constraint');
  const result = handleError(error);

  assertEquals(result.message, 'ข้อมูลซ้ำ');
  assertEquals(result.statusCode, 409);
});

Deno.test('handleError - foreign key error returns 409', () => {
  const error = new Error('foreign key constraint violation');
  const result = handleError(error);

  assertEquals(result.message, 'มีข้อมูลอ้างอิงที่ใช้งานอยู่ ไม่สามารถลบได้');
  assertEquals(result.statusCode, 409);
});

Deno.test('handleError - generic Error returns 500', () => {
  const error = new Error('Something went wrong');
  const result = handleError(error);

  assertEquals(result.message, 'Something went wrong');
  assertEquals(result.statusCode, 500);
});

Deno.test('handleError - unknown error returns 500', () => {
  const result = handleError('string error');

  assertEquals(result.message, 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
  assertEquals(result.statusCode, 500);
});

Deno.test('handleError - null error returns 500', () => {
  const result = handleError(null);

  assertEquals(result.message, 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
  assertEquals(result.statusCode, 500);
});

Deno.test('handleError - undefined error returns 500', () => {
  const result = handleError(undefined);

  assertEquals(result.message, 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
  assertEquals(result.statusCode, 500);
});

