/**
 * Google Places API Service (New)
 * Uses the new Places API (places.googleapis.com/v1)
 * https://developers.google.com/maps/documentation/places/web-service
 */

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

export interface AutocompletePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  types: string[];
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  google_maps_embed_url: string;
  address_components: AddressComponents;
}

export interface AddressComponents {
  street_address?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  country?: string;
}

// New API response types
interface NewAutocompleteSuggestion {
  placePrediction?: {
    placeId: string;
    text: {
      text: string;
      matches?: Array<{ startOffset?: number; endOffset: number }>;
    };
    structuredFormat: {
      mainText: {
        text: string;
        matches?: Array<{ startOffset?: number; endOffset: number }>;
      };
      secondaryText?: {
        text: string;
      };
    };
    types?: string[];
  };
  queryPrediction?: {
    text: {
      text: string;
    };
  };
}

interface NewAutocompleteResponse {
  suggestions?: NewAutocompleteSuggestion[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

interface NewPlaceDetailsResponse {
  id: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
    languageCode?: string;
  }>;
  googleMapsUri?: string;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export class PlacesApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PlacesApiError';
    this.code = code;
  }
}

/**
 * Validate API key is configured
 */
function validateApiKey(): void {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new PlacesApiError('CONFIGURATION_ERROR', 'Google Places API key is not configured');
  }
}

/**
 * Search places using Google Places Autocomplete (New API)
 * https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 */
export async function searchPlaces(
  input: string,
  sessionToken?: string
): Promise<AutocompletePrediction[]> {
  validateApiKey();

  const requestBody: Record<string, unknown> = {
    input,
    includedRegionCodes: ['TH'],
    languageCode: 'th',
  };

  if (sessionToken) {
    requestBody.sessionToken = sessionToken;
  }

  const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
    },
    body: JSON.stringify(requestBody),
  });

  // Check HTTP status first
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Places API error:', response.status, errorText);
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error) {
        throw new PlacesApiError(errorData.error.status || 'API_ERROR', errorData.error.message || 'Unknown error');
      }
    } catch {
      // If not JSON, throw generic error
    }
    throw new PlacesApiError('API_ERROR', `Google Places API returned ${response.status}`);
  }

  const data: NewAutocompleteResponse = await response.json();

  if (data.error) {
    throw new PlacesApiError(data.error.status, data.error.message);
  }

  if (!data.suggestions || data.suggestions.length === 0) {
    return [];
  }

  // Filter only place predictions (not query predictions)
  return data.suggestions
    .filter((s) => s.placePrediction)
    .map((s) => {
      const p = s.placePrediction!;
      return {
        place_id: p.placeId,
        description: p.text.text,
        main_text: p.structuredFormat.mainText.text,
        secondary_text: p.structuredFormat.secondaryText?.text || '',
        types: p.types || [],
      };
    });
}

/**
 * Get place details from Google Places API (New API)
 * https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string
): Promise<PlaceDetails> {
  validateApiKey();

  // Field mask for the data we need
  const fieldMask = [
    'id',
    'displayName',
    'formattedAddress',
    'location',
    'addressComponents',
    'googleMapsUri',
  ].join(',');

  const url = new URL(`${PLACES_API_BASE}/places/${placeId}`);
  if (sessionToken) {
    url.searchParams.set('sessionToken', sessionToken);
  }
  url.searchParams.set('languageCode', 'th');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': fieldMask,
    },
  });

  // Check HTTP status first
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Places API error:', response.status, errorText);
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error) {
        throw new PlacesApiError(errorData.error.status || 'API_ERROR', errorData.error.message || 'Unknown error');
      }
    } catch {
      // If not JSON, throw generic error
    }
    throw new PlacesApiError('API_ERROR', `Google Places API returned ${response.status}`);
  }

  const data: NewPlaceDetailsResponse = await response.json();

  if (data.error) {
    throw new PlacesApiError(data.error.status, data.error.message);
  }

  if (!data.id) {
    throw new PlacesApiError('NOT_FOUND', 'Place not found');
  }

  const addressComponents = parseAddressComponents(data.addressComponents || []);

  // Build embed URL using coordinates (works without API key in URL)
  const lat = data.location?.latitude || 0;
  const lng = data.location?.longitude || 0;
  const embedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d500!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s${data.id}!2s!5e0!3m2!1sth!2sth`;

  return {
    place_id: data.id,
    name: data.displayName?.text || '',
    formatted_address: data.formattedAddress || '',
    latitude: lat,
    longitude: lng,
    google_maps_url: data.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${data.id}`,
    google_maps_embed_url: embedUrl,
    address_components: addressComponents,
  };
}

/**
 * Parse Google address components into structured format
 * New API uses different field names (longText instead of long_name)
 */
function parseAddressComponents(
  components: Array<{ longText: string; shortText: string; types?: string[] }>
): AddressComponents {
  const result: AddressComponents = {};

  let streetNumber = '';
  let route = '';

  for (const component of components) {
    const types = component.types || [];

    if (types.includes('street_number')) {
      streetNumber = component.longText;
    } else if (types.includes('route')) {
      route = component.longText;
    } else if (types.includes('sublocality_level_2')) {
      // Thai: ตำบล/แขวง
      result.subdistrict = component.longText;
    } else if (types.includes('sublocality_level_1') || types.includes('locality')) {
      // Thai: อำเภอ/เขต
      if (!result.district) {
        result.district = component.longText;
      }
    } else if (types.includes('administrative_area_level_1')) {
      // Thai: จังหวัด
      result.province = component.longText;
    } else if (types.includes('postal_code')) {
      result.postal_code = component.longText;
    } else if (types.includes('country')) {
      result.country = component.longText;
    }
  }

  // Combine street number and route
  if (streetNumber || route) {
    result.street_address = [streetNumber, route].filter(Boolean).join(' ');
  }

  return result;
}
