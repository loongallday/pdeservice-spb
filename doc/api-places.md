# API Places

## Overview

The Places API is a Google Places API proxy that provides address autocomplete and place details lookup functionality for Thai addresses. It is used in the site creation workflow to help users search for and select business locations.

This API:
- Provides address autocomplete as users type
- Returns place details with coordinates (latitude/longitude)
- Automatically matches addresses to Thai administrative codes (province/district/subdistrict)
- Returns formatted data ready for site creation

---

## Base URL

```
/api-places
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Required Permission Level:** 0 (Technician L1 or higher)

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/autocomplete` | Search places as user types | Yes |
| POST | `/details` | Get full place details by place_id | Yes |

---

## Endpoints

### 1. Autocomplete

Search for places as the user types. Returns a list of matching place predictions.

**Request**

```
POST /api-places/autocomplete
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string | Yes | Search query (minimum 2 characters) |
| `sessionToken` | string | No | Google Places session token for billing optimization |

**Request Body Example**

```json
{
  "input": "Central World",
  "sessionToken": "uuid-session-token"
}
```

**Response**

```json
{
  "data": {
    "predictions": [
      {
        "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "description": "เซ็นทรัลเวิลด์ ถนนราชดำริ แขวงปทุมวัน เขตปทุมวัน กรุงเทพมหานคร ประเทศไทย",
        "main_text": "เซ็นทรัลเวิลด์",
        "secondary_text": "ถนนราชดำริ แขวงปทุมวัน เขตปทุมวัน กรุงเทพมหานคร ประเทศไทย",
        "types": ["shopping_mall", "point_of_interest", "establishment"]
      }
    ]
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `predictions` | array | List of place predictions |

**Prediction Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `place_id` | string | Google Places unique identifier |
| `description` | string | Full place description |
| `main_text` | string | Primary place name |
| `secondary_text` | string | Secondary location information |
| `types` | string[] | Array of place types (e.g., "restaurant", "establishment") |

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-places/autocomplete" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"input": "Central World"}'
```

**Notes**
- Minimum input length is 2 characters; shorter inputs return an empty predictions array
- Results are limited to Thailand (`includedRegionCodes: ['TH']`)
- Language is set to Thai for localized results
- Use `sessionToken` to group autocomplete and details requests for billing optimization

---

### 2. Details

Get full details of a place including coordinates and address components. Also attempts to match the address to Thai administrative location codes.

**Request**

```
POST /api-places/details
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `place_id` | string | Yes | Google Places ID from autocomplete |
| `sessionToken` | string | No | Google Places session token (should match autocomplete) |

**Request Body Example**

```json
{
  "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "sessionToken": "uuid-session-token"
}
```

**Response**

```json
{
  "data": {
    "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "name": "เซ็นทรัลเวิลด์",
    "formatted_address": "999/9 ถนนพระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพมหานคร 10330 ประเทศไทย",
    "latitude": 13.7465354,
    "longitude": 100.5393327,
    "google_maps_url": "https://maps.google.com/?cid=12345678901234567890",
    "google_maps_embed_url": "https://www.google.com/maps/embed?pb=...",
    "address_components": {
      "street_address": "999/9 ถนนพระราม 1",
      "subdistrict": "ปทุมวัน",
      "district": "ปทุมวัน",
      "province": "กรุงเทพมหานคร",
      "postal_code": "10330",
      "country": "ประเทศไทย"
    },
    "matched_location": {
      "province_code": 10,
      "district_code": 1007,
      "subdistrict_code": 100701
    }
  }
}
```

**Response Fields**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `place_id` | string | No | Google Places unique identifier |
| `name` | string | No | Place name |
| `formatted_address` | string | No | Full formatted address |
| `latitude` | number | No | Latitude coordinate |
| `longitude` | number | No | Longitude coordinate |
| `google_maps_url` | string | No | URL to open in Google Maps |
| `google_maps_embed_url` | string | No | URL for embedding Google Maps |
| `address_components` | object | No | Parsed address components |
| `matched_location` | object | Yes | Matched Thai location codes (null if no match) |

**Address Components Object**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `street_address` | string | Yes | Street number and route |
| `subdistrict` | string | Yes | Thai: ตำบล/แขวง |
| `district` | string | Yes | Thai: อำเภอ/เขต |
| `province` | string | Yes | Thai: จังหวัด |
| `postal_code` | string | Yes | Thai postal code |
| `country` | string | Yes | Country name |

**Matched Location Object**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `province_code` | number | Yes | ID from ref_provinces table |
| `district_code` | number | Yes | ID from ref_districts table |
| `subdistrict_code` | number | Yes | ID from ref_sub_districts table |

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-places/details" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4"}'
```

---

## Error Responses

All errors follow the standard API error format:

```json
{
  "error": "Error message"
}
```

### Common Errors

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 400 | กรุณาระบุคำค้นหา | Missing or empty `input` field in autocomplete |
| 400 | กรุณาระบุ place_id | Missing or empty `place_id` field in details |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 404 | ไม่พบ endpoint | Invalid endpoint path |
| 405 | Method not allowed | Only POST methods are allowed |
| 500 | CONFIGURATION_ERROR: Google Places API key is not configured | Server missing API key |

### Google Places API Errors

When the Google Places API returns an error, the response includes the error code:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid place ID provided"
  }
}
```

| Error Code | Description |
|------------|-------------|
| `CONFIGURATION_ERROR` | Google Places API key is not configured on server |
| `INVALID_REQUEST` | Invalid request parameters |
| `NOT_FOUND` | Place not found |
| `API_ERROR` | Generic Google API error |

---

## Usage Notes

### Session Tokens

Google Places API uses session tokens for billing optimization. A session groups an autocomplete search and the subsequent details request:

1. Generate a UUID on the client when the user starts typing
2. Include the same `sessionToken` in both autocomplete and details requests
3. Generate a new session token when the user starts a new search

```javascript
// Example session token usage
const sessionToken = crypto.randomUUID();

// Autocomplete request
await fetch('/api-places/autocomplete', {
  method: 'POST',
  body: JSON.stringify({ input: 'Central', sessionToken })
});

// Details request (same session)
await fetch('/api-places/details', {
  method: 'POST',
  body: JSON.stringify({ place_id: 'ChIJ...', sessionToken })
});
```

### Location Code Matching

The API automatically attempts to match Google's address components to Thai administrative codes:

1. **Province matching**: Matches `administrative_area_level_1` to `ref_provinces`
2. **District matching**: Matches `sublocality_level_1` or `locality` to `ref_districts`
3. **Subdistrict matching**: Matches `sublocality_level_2` to `ref_sub_districts`
4. **Postal code fallback**: If subdistrict not found, tries matching by postal code

The matching process:
- Normalizes Thai location names (removes prefixes like จังหวัด, อำเภอ, etc.)
- Uses fuzzy matching (ILIKE) for flexibility
- Backfills missing codes from the hierarchy (e.g., if only subdistrict found, looks up its district and province)

### Site Creation Workflow

This API is typically used in the site creation flow:

1. User types an address in the search field
2. Frontend calls `/autocomplete` with user input
3. User selects a place from the predictions
4. Frontend calls `/details` with the selected `place_id`
5. Frontend pre-fills site form with:
   - `latitude` and `longitude` for map position
   - `address_components` for address fields
   - `matched_location` codes for province/district/subdistrict dropdowns
   - `google_maps_url` for the site's Google Maps link

---

## Related Tables

| Table | Description |
|-------|-------------|
| `ref_provinces` | Thai provinces (77 records) |
| `ref_districts` | Thai districts/amphoes |
| `ref_sub_districts` | Thai subdistricts/tambons with zip codes |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Yes | Google Cloud API key with Places API enabled |

---

## Related Endpoints

- **Sites API** (`/api-sites`) - Create and manage customer sites using place data
- **Reference Data API** (`/api-reference-data`) - Get province/district/subdistrict lists
