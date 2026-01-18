/**
 * Unit tests for CORS utilities
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { corsHeaders, handleCORS } from '../../supabase/functions/_shared/cors.ts';

// ============ corsHeaders Tests ============

Deno.test('corsHeaders - has Access-Control-Allow-Origin', () => {
  assertEquals(corsHeaders['Access-Control-Allow-Origin'], '*');
});

Deno.test('corsHeaders - has Access-Control-Allow-Headers', () => {
  assertEquals(typeof corsHeaders['Access-Control-Allow-Headers'], 'string');
  assertEquals(corsHeaders['Access-Control-Allow-Headers'].includes('authorization'), true);
  assertEquals(corsHeaders['Access-Control-Allow-Headers'].includes('content-type'), true);
});

Deno.test('corsHeaders - has Access-Control-Allow-Methods', () => {
  assertEquals(typeof corsHeaders['Access-Control-Allow-Methods'], 'string');
  assertEquals(corsHeaders['Access-Control-Allow-Methods'].includes('GET'), true);
  assertEquals(corsHeaders['Access-Control-Allow-Methods'].includes('POST'), true);
  assertEquals(corsHeaders['Access-Control-Allow-Methods'].includes('PUT'), true);
  assertEquals(corsHeaders['Access-Control-Allow-Methods'].includes('DELETE'), true);
  assertEquals(corsHeaders['Access-Control-Allow-Methods'].includes('OPTIONS'), true);
});

Deno.test('corsHeaders - allows idempotency-key header', () => {
  assertEquals(corsHeaders['Access-Control-Allow-Headers'].includes('idempotency-key'), true);
});

// ============ handleCORS Tests ============

Deno.test('handleCORS - returns Response for OPTIONS request', () => {
  const request = new Request('http://localhost/api', { method: 'OPTIONS' });
  const response = handleCORS(request);

  assertEquals(response !== null, true);
  assertEquals(response!.status, 200);
});

Deno.test('handleCORS - OPTIONS response includes CORS headers', async () => {
  const request = new Request('http://localhost/api', { method: 'OPTIONS' });
  const response = handleCORS(request);

  assertEquals(response!.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('handleCORS - OPTIONS response body is "ok"', async () => {
  const request = new Request('http://localhost/api', { method: 'OPTIONS' });
  const response = handleCORS(request);
  const body = await response!.text();

  assertEquals(body, 'ok');
});

Deno.test('handleCORS - returns null for GET request', () => {
  const request = new Request('http://localhost/api', { method: 'GET' });
  const response = handleCORS(request);

  assertEquals(response, null);
});

Deno.test('handleCORS - returns null for POST request', () => {
  const request = new Request('http://localhost/api', { method: 'POST' });
  const response = handleCORS(request);

  assertEquals(response, null);
});

Deno.test('handleCORS - returns null for PUT request', () => {
  const request = new Request('http://localhost/api', { method: 'PUT' });
  const response = handleCORS(request);

  assertEquals(response, null);
});

Deno.test('handleCORS - returns null for DELETE request', () => {
  const request = new Request('http://localhost/api', { method: 'DELETE' });
  const response = handleCORS(request);

  assertEquals(response, null);
});

Deno.test('handleCORS - returns null for PATCH request', () => {
  const request = new Request('http://localhost/api', { method: 'PATCH' });
  const response = handleCORS(request);

  assertEquals(response, null);
});

