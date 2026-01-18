/**
 * Unit tests for response utilities
 * Tests all response functions
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  success,
  successWithPagination,
  error,
  calculatePagination,
} from '../../supabase/functions/_shared/response.ts';

// ============ success Tests ============

Deno.test('success - returns Response with status 200', async () => {
  const response = success({ message: 'ok' });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
});

Deno.test('success - wraps data in data property', async () => {
  const response = success({ name: 'test', value: 123 });
  const json = await response.json();

  assertEquals(json.data.name, 'test');
  assertEquals(json.data.value, 123);
});

Deno.test('success - custom status code', async () => {
  const response = success({ id: '123' }, 201);

  assertEquals(response.status, 201);
});

Deno.test('success - includes CORS headers', () => {
  const response = success({});

  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('success - handles array data', async () => {
  const response = success([1, 2, 3]);
  const json = await response.json();

  assertEquals(Array.isArray(json.data), true);
  assertEquals(json.data.length, 3);
});

Deno.test('success - handles null data', async () => {
  const response = success(null);
  const json = await response.json();

  assertEquals(json.data, null);
});

Deno.test('success - handles string data', async () => {
  const response = success('simple string');
  const json = await response.json();

  assertEquals(json.data, 'simple string');
});

// ============ successWithPagination Tests ============

Deno.test('successWithPagination - returns Response with status 200', async () => {
  const pagination = {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5,
    hasNext: true,
    hasPrevious: false,
  };
  const response = successWithPagination([{ id: 1 }], pagination);

  assertEquals(response.status, 200);
});

Deno.test('successWithPagination - includes pagination info', async () => {
  const pagination = {
    page: 2,
    limit: 10,
    total: 50,
    totalPages: 5,
    hasNext: true,
    hasPrevious: true,
  };
  const response = successWithPagination([{ id: 1 }], pagination);
  const json = await response.json();

  assertEquals(json.pagination.page, 2);
  assertEquals(json.pagination.limit, 10);
  assertEquals(json.pagination.total, 50);
  assertEquals(json.pagination.totalPages, 5);
  assertEquals(json.pagination.hasNext, true);
  assertEquals(json.pagination.hasPrevious, true);
});

Deno.test('successWithPagination - includes data array', async () => {
  const pagination = {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
  const response = successWithPagination([{ id: 1 }, { id: 2 }], pagination);
  const json = await response.json();

  assertEquals(Array.isArray(json.data), true);
  assertEquals(json.data.length, 2);
});

Deno.test('successWithPagination - custom status code', async () => {
  const pagination = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  };
  const response = successWithPagination([], pagination, 206);

  assertEquals(response.status, 206);
});

Deno.test('successWithPagination - includes CORS headers', () => {
  const pagination = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  };
  const response = successWithPagination([], pagination);

  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

// ============ error Tests ============

Deno.test('error - returns Response with status 400', async () => {
  const response = error('Bad request');

  assertEquals(response.status, 400);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
});

Deno.test('error - includes error message', async () => {
  const response = error('ข้อมูลไม่ถูกต้อง');
  const json = await response.json();

  assertEquals(json.error, 'ข้อมูลไม่ถูกต้อง');
});

Deno.test('error - custom status code', async () => {
  const response = error('Not found', 404);

  assertEquals(response.status, 404);
});

Deno.test('error - includes error code', async () => {
  const response = error('Validation failed', 400, 'VALIDATION_ERROR');
  const json = await response.json();

  assertEquals(json.error, 'Validation failed');
  assertEquals(json.code, 'VALIDATION_ERROR');
});

Deno.test('error - no code when not provided', async () => {
  const response = error('Simple error');
  const json = await response.json();

  assertEquals(json.error, 'Simple error');
  assertEquals(json.code, undefined);
});

Deno.test('error - includes CORS headers', () => {
  const response = error('Error');

  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('error - 401 unauthorized', async () => {
  const response = error('Unauthorized', 401, 'UNAUTHORIZED');

  assertEquals(response.status, 401);
  const json = await response.json();
  assertEquals(json.code, 'UNAUTHORIZED');
});

Deno.test('error - 403 forbidden', async () => {
  const response = error('Forbidden', 403, 'FORBIDDEN');

  assertEquals(response.status, 403);
  const json = await response.json();
  assertEquals(json.code, 'FORBIDDEN');
});

Deno.test('error - 500 internal server error', async () => {
  const response = error('Internal error', 500, 'INTERNAL_ERROR');

  assertEquals(response.status, 500);
});

// ============ calculatePagination Tests ============

Deno.test('calculatePagination - first page', () => {
  const result = calculatePagination(1, 20, 100);

  assertEquals(result.page, 1);
  assertEquals(result.limit, 20);
  assertEquals(result.total, 100);
  assertEquals(result.totalPages, 5);
  assertEquals(result.hasNext, true);
  assertEquals(result.hasPrevious, false);
});

Deno.test('calculatePagination - middle page', () => {
  const result = calculatePagination(3, 20, 100);

  assertEquals(result.page, 3);
  assertEquals(result.totalPages, 5);
  assertEquals(result.hasNext, true);
  assertEquals(result.hasPrevious, true);
});

Deno.test('calculatePagination - last page', () => {
  const result = calculatePagination(5, 20, 100);

  assertEquals(result.page, 5);
  assertEquals(result.totalPages, 5);
  assertEquals(result.hasNext, false);
  assertEquals(result.hasPrevious, true);
});

Deno.test('calculatePagination - single page', () => {
  const result = calculatePagination(1, 20, 10);

  assertEquals(result.page, 1);
  assertEquals(result.totalPages, 1);
  assertEquals(result.hasNext, false);
  assertEquals(result.hasPrevious, false);
});

Deno.test('calculatePagination - empty results', () => {
  const result = calculatePagination(1, 20, 0);

  assertEquals(result.page, 1);
  assertEquals(result.total, 0);
  assertEquals(result.totalPages, 0);
  assertEquals(result.hasNext, false);
  assertEquals(result.hasPrevious, false);
});

Deno.test('calculatePagination - partial last page', () => {
  const result = calculatePagination(1, 20, 25);

  assertEquals(result.totalPages, 2);
  assertEquals(result.hasNext, true);
});

Deno.test('calculatePagination - exact fit', () => {
  const result = calculatePagination(1, 10, 30);

  assertEquals(result.totalPages, 3);
});

Deno.test('calculatePagination - large dataset', () => {
  const result = calculatePagination(50, 100, 10000);

  assertEquals(result.totalPages, 100);
  assertEquals(result.hasNext, true);
  assertEquals(result.hasPrevious, true);
});

