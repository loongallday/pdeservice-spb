/**
 * Place Details Handler
 * Gets full details of a selected place including coordinates and address components
 */

import { success, error } from '../../_shared/response.ts';
import { parseRequestBody } from '../../_shared/validation.ts';
import { getPlaceDetails, PlacesApiError } from '../services/placesService.ts';
import { matchLocationCodes } from '../services/locationMatcherService.ts';
import type { Employee } from '../../_shared/auth.ts';

interface DetailsRequest {
  place_id: string;
  sessionToken?: string;
}

export async function details(req: Request, _employee: Employee) {
  try {
    // Parse request body
    const body = await parseRequestBody<DetailsRequest>(req);

    // Validate place_id
    if (!body.place_id || typeof body.place_id !== 'string' || body.place_id.trim().length === 0) {
      return error('กรุณาระบุ place_id', 400);
    }

    // Get place details from Google
    const placeDetails = await getPlaceDetails(body.place_id.trim(), body.sessionToken);

    // Try to match location codes (wrap in try-catch to not fail the whole request)
    let matchedLocation = null;
    try {
      matchedLocation = await matchLocationCodes(placeDetails.address_components);
    } catch (matchErr) {
      console.error('Location matching error:', matchErr);
      // Continue without matched location
    }

    return success({
      place_id: placeDetails.place_id,
      name: placeDetails.name,
      formatted_address: placeDetails.formatted_address,
      latitude: placeDetails.latitude,
      longitude: placeDetails.longitude,
      google_maps_url: placeDetails.google_maps_url,
      google_maps_embed_url: placeDetails.google_maps_embed_url,
      address_components: placeDetails.address_components,
      matched_location: matchedLocation,
    });
  } catch (err) {
    console.error('Details handler error:', err);
    if (err instanceof PlacesApiError) {
      return error(
        `${err.code}: ${err.message}`,
        err.code === 'CONFIGURATION_ERROR' ? 500 : 400
      );
    }
    // Return generic error instead of throwing
    const errMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return error(errMessage, 500);
  }
}
