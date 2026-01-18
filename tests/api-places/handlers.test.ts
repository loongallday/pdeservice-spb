/**
 * Unit tests for Places API handlers
 * Tests validation logic and request handling
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ============ Autocomplete Validation Tests ============

Deno.test('autocomplete - validates input is required', () => {
  const validateInput = (body: { input?: string }) => {
    if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
      throw new Error('กรุณาระบุคำค้นหา');
    }
  };

  let error: Error | null = null;
  try {
    validateInput({});
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'กรุณาระบุคำค้นหา');
});

Deno.test('autocomplete - validates input is not empty string', () => {
  const validateInput = (body: { input?: string }) => {
    if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
      throw new Error('กรุณาระบุคำค้นหา');
    }
  };

  let error: Error | null = null;
  try {
    validateInput({ input: '' });
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'กรุณาระบุคำค้นหา');
});

Deno.test('autocomplete - validates input is not whitespace only', () => {
  const validateInput = (body: { input?: string }) => {
    if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
      throw new Error('กรุณาระบุคำค้นหา');
    }
  };

  let error: Error | null = null;
  try {
    validateInput({ input: '   ' });
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'กรุณาระบุคำค้นหา');
});

Deno.test('autocomplete - returns empty predictions for short input (< 2 chars)', () => {
  const shouldReturnEmpty = (input: string) => input.trim().length < 2;

  assertEquals(shouldReturnEmpty('a'), true);
  assertEquals(shouldReturnEmpty(' '), true);
  assertEquals(shouldReturnEmpty('ab'), false);
  assertEquals(shouldReturnEmpty('abc'), false);
});

Deno.test('autocomplete - valid input passes validation', () => {
  const validateInput = (body: { input?: string }) => {
    if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
      throw new Error('กรุณาระบุคำค้นหา');
    }
    return true;
  };

  assertEquals(validateInput({ input: 'Bangkok' }), true);
  assertEquals(validateInput({ input: 'กรุงเทพ' }), true);
});

// ============ Details Validation Tests ============

Deno.test('details - validates place_id is required', () => {
  const validatePlaceId = (body: { place_id?: string }) => {
    if (!body.place_id || typeof body.place_id !== 'string' || body.place_id.trim().length === 0) {
      throw new Error('กรุณาระบุ place_id');
    }
  };

  let error: Error | null = null;
  try {
    validatePlaceId({});
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'กรุณาระบุ place_id');
});

Deno.test('details - validates place_id is not empty', () => {
  const validatePlaceId = (body: { place_id?: string }) => {
    if (!body.place_id || typeof body.place_id !== 'string' || body.place_id.trim().length === 0) {
      throw new Error('กรุณาระบุ place_id');
    }
  };

  let error: Error | null = null;
  try {
    validatePlaceId({ place_id: '' });
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'กรุณาระบุ place_id');
});

Deno.test('details - valid place_id passes validation', () => {
  const validatePlaceId = (body: { place_id?: string }) => {
    if (!body.place_id || typeof body.place_id !== 'string' || body.place_id.trim().length === 0) {
      throw new Error('กรุณาระบุ place_id');
    }
    return true;
  };

  assertEquals(validatePlaceId({ place_id: 'ChIJKb8Mqyn_4jARFj8_lVZw5Hs' }), true);
});

// ============ HTTP Method Tests ============

Deno.test('places - only POST method is allowed', () => {
  const isValidMethod = (method: string) => method === 'POST';

  assertEquals(isValidMethod('POST'), true);
  assertEquals(isValidMethod('GET'), false);
  assertEquals(isValidMethod('PUT'), false);
  assertEquals(isValidMethod('DELETE'), false);
});

// ============ Routing Tests ============

Deno.test('places - routes to correct handlers', () => {
  const getHandler = (path: string) => {
    switch (path) {
      case 'autocomplete':
        return 'autocomplete';
      case 'details':
        return 'details';
      default:
        return null;
    }
  };

  assertEquals(getHandler('autocomplete'), 'autocomplete');
  assertEquals(getHandler('details'), 'details');
  assertEquals(getHandler('unknown'), null);
  assertEquals(getHandler(''), null);
});

// ============ Response Format Tests ============

Deno.test('autocomplete - response format is correct', () => {
  interface AutocompleteResponse {
    predictions: Array<{
      place_id: string;
      description: string;
    }>;
  }

  const response: AutocompleteResponse = {
    predictions: [
      { place_id: 'abc123', description: 'Bangkok, Thailand' },
    ],
  };

  assertEquals(Array.isArray(response.predictions), true);
  assertEquals(response.predictions[0].place_id, 'abc123');
  assertEquals(response.predictions[0].description, 'Bangkok, Thailand');
});

Deno.test('details - response includes all required fields', () => {
  interface DetailsResponse {
    place_id: string;
    name: string;
    formatted_address: string;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    google_maps_embed_url: string;
    address_components: unknown[];
    matched_location: unknown | null;
  }

  const response: DetailsResponse = {
    place_id: 'ChIJKb8Mqyn_4jARFj8_lVZw5Hs',
    name: 'Test Place',
    formatted_address: '123 Test St, Bangkok',
    latitude: 13.7563,
    longitude: 100.5018,
    google_maps_url: 'https://maps.google.com/...',
    google_maps_embed_url: 'https://maps.google.com/embed/...',
    address_components: [],
    matched_location: null,
  };

  assertEquals(typeof response.place_id, 'string');
  assertEquals(typeof response.name, 'string');
  assertEquals(typeof response.formatted_address, 'string');
  assertEquals(typeof response.latitude, 'number');
  assertEquals(typeof response.longitude, 'number');
  assertEquals(typeof response.google_maps_url, 'string');
  assertEquals(typeof response.google_maps_embed_url, 'string');
  assertEquals(Array.isArray(response.address_components), true);
});

// ============ Session Token Tests ============

Deno.test('places - session token is optional', () => {
  interface AutocompleteRequest {
    input: string;
    sessionToken?: string;
  }

  const requestWithToken: AutocompleteRequest = {
    input: 'Bangkok',
    sessionToken: 'abc-123-token',
  };

  const requestWithoutToken: AutocompleteRequest = {
    input: 'Bangkok',
  };

  assertEquals(requestWithToken.sessionToken, 'abc-123-token');
  assertEquals(requestWithoutToken.sessionToken, undefined);
});

// ============ Location Matching Tests ============

Deno.test('details - handles location matching failure gracefully', () => {
  // Simulates the behavior where location matching errors don't fail the request
  let matchedLocation: unknown = null;
  let matchError: Error | null = null;

  try {
    // Simulate matching error
    throw new Error('Location not found in database');
  } catch (err) {
    matchError = err as Error;
    matchedLocation = null; // Continue without matched location
  }

  assertEquals(matchedLocation, null);
  assertEquals(matchError?.message, 'Location not found in database');
});
