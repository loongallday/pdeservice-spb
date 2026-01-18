/**
 * Unit tests for validation utilities
 * Tests all validation functions without database
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  validateUUID,
  validateRequired,
  validateEmail,
  validateNumberRange,
  validateStringLength,
  parsePaginationParams,
  parseRequestBody,
} from '../../supabase/functions/_shared/validation.ts';
import { ValidationError } from '../../supabase/functions/_shared/error.ts';

// ============ validateUUID Tests ============

Deno.test('validateUUID - valid lowercase UUID passes', () => {
  // Should not throw
  validateUUID('123e4567-e89b-12d3-a456-426614174000');
});

Deno.test('validateUUID - valid uppercase UUID passes', () => {
  // Should not throw
  validateUUID('123E4567-E89B-12D3-A456-426614174000');
});

Deno.test('validateUUID - valid mixed case UUID passes', () => {
  // Should not throw
  validateUUID('123e4567-E89B-12d3-A456-426614174000');
});

Deno.test('validateUUID - invalid UUID throws ValidationError', () => {
  assertThrows(
    () => validateUUID('invalid-uuid'),
    ValidationError,
    'ไม่ถูกต้อง'
  );
});

Deno.test('validateUUID - empty string throws ValidationError', () => {
  assertThrows(
    () => validateUUID(''),
    ValidationError,
    'ไม่ถูกต้อง'
  );
});

Deno.test('validateUUID - UUID without dashes throws ValidationError', () => {
  assertThrows(
    () => validateUUID('123e4567e89b12d3a456426614174000'),
    ValidationError,
    'ไม่ถูกต้อง'
  );
});

Deno.test('validateUUID - custom field name in error message', () => {
  assertThrows(
    () => validateUUID('invalid', 'รหัสตั๋ว'),
    ValidationError,
    'รหัสตั๋ว'
  );
});

// ============ validateRequired Tests ============

Deno.test('validateRequired - non-empty string passes', () => {
  // Should not throw
  validateRequired('test value', 'field');
});

Deno.test('validateRequired - number passes', () => {
  // Should not throw
  validateRequired(123, 'field');
});

Deno.test('validateRequired - zero passes', () => {
  // Should not throw (0 is a valid value)
  validateRequired(0, 'field');
});

Deno.test('validateRequired - false passes', () => {
  // Should not throw (false is a valid value)
  validateRequired(false, 'field');
});

Deno.test('validateRequired - object passes', () => {
  // Should not throw
  validateRequired({ key: 'value' }, 'field');
});

Deno.test('validateRequired - array passes', () => {
  // Should not throw
  validateRequired([1, 2, 3], 'field');
});

Deno.test('validateRequired - null throws ValidationError', () => {
  assertThrows(
    () => validateRequired(null, 'ชื่อ'),
    ValidationError,
    'ชื่อ'
  );
});

Deno.test('validateRequired - undefined throws ValidationError', () => {
  assertThrows(
    () => validateRequired(undefined, 'รายละเอียด'),
    ValidationError,
    'รายละเอียด'
  );
});

Deno.test('validateRequired - empty string throws ValidationError', () => {
  assertThrows(
    () => validateRequired('', 'ข้อมูล'),
    ValidationError,
    'ข้อมูล'
  );
});

// ============ validateEmail Tests ============

Deno.test('validateEmail - valid email passes', () => {
  // Should not throw
  validateEmail('test@example.com');
});

Deno.test('validateEmail - valid email with subdomain passes', () => {
  // Should not throw
  validateEmail('user@mail.company.co.th');
});

Deno.test('validateEmail - valid email with plus sign passes', () => {
  // Should not throw
  validateEmail('user+tag@example.com');
});

Deno.test('validateEmail - invalid email without @ throws', () => {
  assertThrows(
    () => validateEmail('invalid-email'),
    ValidationError,
    'อีเมลไม่ถูกต้อง'
  );
});

Deno.test('validateEmail - invalid email without domain throws', () => {
  assertThrows(
    () => validateEmail('user@'),
    ValidationError,
    'อีเมลไม่ถูกต้อง'
  );
});

Deno.test('validateEmail - invalid email with spaces throws', () => {
  assertThrows(
    () => validateEmail('user @example.com'),
    ValidationError,
    'อีเมลไม่ถูกต้อง'
  );
});

Deno.test('validateEmail - empty string throws', () => {
  assertThrows(
    () => validateEmail(''),
    ValidationError,
    'อีเมลไม่ถูกต้อง'
  );
});

// ============ validateNumberRange Tests ============

Deno.test('validateNumberRange - value within range passes', () => {
  // Should not throw
  validateNumberRange(50, 0, 100, 'จำนวน');
});

Deno.test('validateNumberRange - value at minimum passes', () => {
  // Should not throw
  validateNumberRange(0, 0, 100, 'จำนวน');
});

Deno.test('validateNumberRange - value at maximum passes', () => {
  // Should not throw
  validateNumberRange(100, 0, 100, 'จำนวน');
});

Deno.test('validateNumberRange - negative range passes', () => {
  // Should not throw
  validateNumberRange(-5, -10, 0, 'อุณหภูมิ');
});

Deno.test('validateNumberRange - value below minimum throws', () => {
  assertThrows(
    () => validateNumberRange(-1, 0, 100, 'จำนวน'),
    ValidationError,
    'จำนวน'
  );
});

Deno.test('validateNumberRange - value above maximum throws', () => {
  assertThrows(
    () => validateNumberRange(101, 0, 100, 'คะแนน'),
    ValidationError,
    'คะแนน'
  );
});

Deno.test('validateNumberRange - error message includes range', () => {
  assertThrows(
    () => validateNumberRange(150, 1, 100, 'ค่า'),
    ValidationError,
    '1 ถึง 100'
  );
});

// ============ validateStringLength Tests ============

Deno.test('validateStringLength - string within range passes', () => {
  // Should not throw
  validateStringLength('hello', 1, 10, 'ชื่อ');
});

Deno.test('validateStringLength - string at minimum length passes', () => {
  // Should not throw
  validateStringLength('a', 1, 10, 'ชื่อ');
});

Deno.test('validateStringLength - string at maximum length passes', () => {
  // Should not throw
  validateStringLength('1234567890', 1, 10, 'ชื่อ');
});

Deno.test('validateStringLength - string too short throws', () => {
  assertThrows(
    () => validateStringLength('ab', 3, 10, 'รหัส'),
    ValidationError,
    'รหัส'
  );
});

Deno.test('validateStringLength - string too long throws', () => {
  assertThrows(
    () => validateStringLength('12345678901', 1, 10, 'รหัส'),
    ValidationError,
    'รหัส'
  );
});

Deno.test('validateStringLength - error message includes length range', () => {
  assertThrows(
    () => validateStringLength('x', 5, 20, 'ข้อความ'),
    ValidationError,
    '5 ถึง 20'
  );
});

Deno.test('validateStringLength - empty string with min 0 passes', () => {
  // Should not throw
  validateStringLength('', 0, 10, 'ชื่อ');
});

// ============ parsePaginationParams Tests ============

Deno.test('parsePaginationParams - default values', () => {
  const url = new URL('http://localhost/api');
  const result = parsePaginationParams(url);

  assertEquals(result.page, 1);
  assertEquals(result.limit, 50);
});

Deno.test('parsePaginationParams - custom page and limit', () => {
  const url = new URL('http://localhost/api?page=3&limit=25');
  const result = parsePaginationParams(url);

  assertEquals(result.page, 3);
  assertEquals(result.limit, 25);
});

Deno.test('parsePaginationParams - page minimum is 1', () => {
  const url = new URL('http://localhost/api?page=0');
  const result = parsePaginationParams(url);

  assertEquals(result.page, 1);
});

Deno.test('parsePaginationParams - negative page becomes 1', () => {
  const url = new URL('http://localhost/api?page=-5');
  const result = parsePaginationParams(url);

  assertEquals(result.page, 1);
});

Deno.test('parsePaginationParams - limit minimum is 1', () => {
  const url = new URL('http://localhost/api?limit=0');
  const result = parsePaginationParams(url);

  assertEquals(result.limit, 1);
});

Deno.test('parsePaginationParams - limit maximum is 100', () => {
  const url = new URL('http://localhost/api?limit=500');
  const result = parsePaginationParams(url);

  assertEquals(result.limit, 100);
});

Deno.test('parsePaginationParams - invalid page becomes NaN (edge case)', () => {
  const url = new URL('http://localhost/api?page=abc');
  const result = parsePaginationParams(url);

  // parseInt('abc') returns NaN, Math.max(1, NaN) returns NaN
  assertEquals(Number.isNaN(result.page), true);
});

Deno.test('parsePaginationParams - invalid limit becomes NaN (edge case)', () => {
  const url = new URL('http://localhost/api?limit=xyz');
  const result = parsePaginationParams(url);

  // parseInt('xyz') returns NaN, Math.min/max with NaN returns NaN
  assertEquals(Number.isNaN(result.limit), true);
});

// ============ parseRequestBody Tests ============

Deno.test('parseRequestBody - valid JSON body', async () => {
  const body = JSON.stringify({ name: 'test', value: 123 });
  const request = new Request('http://localhost/api', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await parseRequestBody<{ name: string; value: number }>(request);

  assertEquals(result.name, 'test');
  assertEquals(result.value, 123);
});

Deno.test('parseRequestBody - nested object', async () => {
  const body = JSON.stringify({
    user: { name: 'John', age: 30 },
    items: [1, 2, 3],
  });
  const request = new Request('http://localhost/api', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await parseRequestBody<{ user: { name: string; age: number }; items: number[] }>(request);

  assertEquals(result.user.name, 'John');
  assertEquals(result.items.length, 3);
});

Deno.test('parseRequestBody - invalid JSON throws ValidationError', async () => {
  const request = new Request('http://localhost/api', {
    method: 'POST',
    body: 'not valid json {',
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    await parseRequestBody(request);
    throw new Error('Should have thrown');
  } catch (err) {
    assertEquals(err instanceof ValidationError, true);
    assertEquals((err as ValidationError).message.includes('ไม่ถูกต้อง'), true);
  }
});

Deno.test('parseRequestBody - empty body throws ValidationError', async () => {
  const request = new Request('http://localhost/api', {
    method: 'POST',
    body: '',
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    await parseRequestBody(request);
    throw new Error('Should have thrown');
  } catch (err) {
    assertEquals(err instanceof ValidationError, true);
  }
});

