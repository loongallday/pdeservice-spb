/**
 * Unit tests for sanitize utilities
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { sanitizeData, getValidFields } from '../../supabase/functions/_shared/sanitize.ts';

// ============ sanitizeData Tests ============

Deno.test('sanitizeData - keeps only valid fields', () => {
  const data = {
    name: 'Test',
    email: 'test@example.com',
    password: 'secret',
    admin: true,
  };
  const validFields = ['name', 'email'];

  const result = sanitizeData(data, validFields);

  assertEquals(result.name, 'Test');
  assertEquals(result.email, 'test@example.com');
  assertEquals(result.password, undefined);
  assertEquals(result.admin, undefined);
});

Deno.test('sanitizeData - returns empty object when no valid fields', () => {
  const data = { password: 'secret', admin: true };
  const validFields = ['name', 'email'];

  const result = sanitizeData(data, validFields);

  assertEquals(Object.keys(result).length, 0);
});

Deno.test('sanitizeData - handles empty data', () => {
  const data = {};
  const validFields = ['name', 'email'];

  const result = sanitizeData(data, validFields);

  assertEquals(Object.keys(result).length, 0);
});

Deno.test('sanitizeData - handles empty valid fields array', () => {
  const data = { name: 'Test', email: 'test@example.com' };
  const validFields: string[] = [];

  const result = sanitizeData(data, validFields);

  assertEquals(Object.keys(result).length, 0);
});

Deno.test('sanitizeData - preserves all valid fields', () => {
  const data = { name: 'Test', email: 'test@example.com', phone: '0812345678' };
  const validFields = ['name', 'email', 'phone'];

  const result = sanitizeData(data, validFields);

  assertEquals(Object.keys(result).length, 3);
  assertEquals(result.name, 'Test');
  assertEquals(result.email, 'test@example.com');
  assertEquals(result.phone, '0812345678');
});

Deno.test('sanitizeData - preserves null values', () => {
  const data = { name: null, email: 'test@example.com' };
  const validFields = ['name', 'email'];

  const result = sanitizeData(data, validFields);

  assertEquals(result.name, null);
  assertEquals(result.email, 'test@example.com');
});

Deno.test('sanitizeData - preserves undefined values if in data', () => {
  const data: Record<string, unknown> = { name: undefined, email: 'test@example.com' };
  const validFields = ['name', 'email'];

  const result = sanitizeData(data, validFields);

  assertEquals('name' in result, true);
  assertEquals(result.name, undefined);
});

Deno.test('sanitizeData - handles nested objects', () => {
  const data = {
    name: 'Test',
    address: { city: 'Bangkok', zip: '10110' },
  };
  const validFields = ['name', 'address'];

  const result = sanitizeData(data, validFields);

  assertEquals(result.name, 'Test');
  assertEquals((result.address as { city: string; zip: string }).city, 'Bangkok');
});

Deno.test('sanitizeData - handles arrays', () => {
  const data = {
    name: 'Test',
    tags: ['tag1', 'tag2'],
  };
  const validFields = ['name', 'tags'];

  const result = sanitizeData(data, validFields);

  assertEquals(result.name, 'Test');
  assertEquals(Array.isArray(result.tags), true);
  assertEquals((result.tags as string[]).length, 2);
});

Deno.test('sanitizeData - handles numeric values', () => {
  const data = {
    name: 'Test',
    count: 0,
    price: 100.50,
  };
  const validFields = ['name', 'count', 'price'];

  const result = sanitizeData(data, validFields);

  assertEquals(result.count, 0);
  assertEquals(result.price, 100.50);
});

Deno.test('sanitizeData - handles boolean values', () => {
  const data = {
    name: 'Test',
    isActive: true,
    isDeleted: false,
  };
  const validFields = ['name', 'isActive', 'isDeleted'];

  const result = sanitizeData(data, validFields);

  assertEquals(result.isActive, true);
  assertEquals(result.isDeleted, false);
});

// ============ getValidFields Tests ============

Deno.test('getValidFields - removes default excluded fields', () => {
  const allFields = ['id', 'name', 'email', 'created_at', 'updated_at'];

  const result = getValidFields(allFields);

  assertEquals(result.includes('name'), true);
  assertEquals(result.includes('email'), true);
  assertEquals(result.includes('id'), false);
  assertEquals(result.includes('created_at'), false);
  assertEquals(result.includes('updated_at'), false);
});

Deno.test('getValidFields - custom excluded fields', () => {
  const allFields = ['id', 'name', 'email', 'password', 'secret'];
  const excludeFields = ['id', 'password', 'secret'];

  const result = getValidFields(allFields, excludeFields);

  assertEquals(result.includes('name'), true);
  assertEquals(result.includes('email'), true);
  assertEquals(result.includes('id'), false);
  assertEquals(result.includes('password'), false);
  assertEquals(result.includes('secret'), false);
});

Deno.test('getValidFields - empty exclude fields keeps all', () => {
  const allFields = ['id', 'name', 'email', 'created_at'];

  const result = getValidFields(allFields, []);

  assertEquals(result.length, 4);
  assertEquals(result.includes('id'), true);
  assertEquals(result.includes('created_at'), true);
});

Deno.test('getValidFields - all fields excluded returns empty', () => {
  const allFields = ['id', 'created_at', 'updated_at'];

  const result = getValidFields(allFields);

  assertEquals(result.length, 0);
});

Deno.test('getValidFields - no matching exclude fields', () => {
  const allFields = ['name', 'email', 'phone'];
  const excludeFields = ['password', 'secret'];

  const result = getValidFields(allFields, excludeFields);

  assertEquals(result.length, 3);
});

Deno.test('getValidFields - preserves field order', () => {
  const allFields = ['a', 'b', 'id', 'c', 'd', 'created_at'];

  const result = getValidFields(allFields);

  assertEquals(result[0], 'a');
  assertEquals(result[1], 'b');
  assertEquals(result[2], 'c');
  assertEquals(result[3], 'd');
});

