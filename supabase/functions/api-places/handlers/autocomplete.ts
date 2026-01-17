/**
 * Place Autocomplete Handler
 * Searches for places as user types
 */

import { success, error } from '../../_shared/response.ts';
import { parseRequestBody } from '../../_shared/validation.ts';
import { searchPlaces, PlacesApiError } from '../services/placesService.ts';
import type { Employee } from '../../_shared/auth.ts';

interface AutocompleteRequest {
  input: string;
  sessionToken?: string;
}

export async function autocomplete(req: Request, _employee: Employee) {
  // Parse request body
  const body = await parseRequestBody<AutocompleteRequest>(req);

  // Validate input
  if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
    return error('กรุณาระบุคำค้นหา', 400);
  }

  // Minimum 2 characters for search
  if (body.input.trim().length < 2) {
    return success({ predictions: [] });
  }

  try {
    const predictions = await searchPlaces(body.input.trim(), body.sessionToken);

    return success({ predictions });
  } catch (err) {
    if (err instanceof PlacesApiError) {
      return error(
        {
          code: err.code,
          message: err.message,
        },
        err.code === 'CONFIGURATION_ERROR' ? 500 : 400
      );
    }
    throw err;
  }
}
