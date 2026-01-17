# API Places - Google Places Proxy

> Proxy endpoints for Google Places API (New) with Thai location code matching.
> Uses the new Places API with 200+ million places.
> https://developers.google.com/maps/documentation/places/web-service

## Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-places
```

## Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Endpoints

### 1. Place Autocomplete

Search for places as user types (like Google Maps search box).

**Endpoint:** `POST /api-places/autocomplete`

**Request:**
```json
{
  "input": "Central World Bangkok",
  "sessionToken": "optional-uuid-for-billing"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string | ✅ | Search query (min 2 characters) |
| `sessionToken` | string | ❌ | UUID for billing optimization |

**Response:**
```json
{
  "data": {
    "predictions": [
      {
        "place_id": "ChIJgQqfwoKe4jARLqGay-fWlQI",
        "description": "CentralWorld, ถนน ราชดำริ แขวง ปทุมวัน เขตปทุมวัน กรุงเทพมหานคร ประเทศไทย",
        "main_text": "CentralWorld",
        "secondary_text": "ถนน ราชดำริ แขวง ปทุมวัน เขตปทุมวัน กรุงเทพมหานคร",
        "types": ["shopping_mall", "point_of_interest", "establishment"]
      }
    ]
  }
}
```

**Google API Used:** `POST https://places.googleapis.com/v1/places:autocomplete`

---

### 2. Place Details

Get full details of a selected place including coordinates and address components.

**Endpoint:** `POST /api-places/details`

**Request:**
```json
{
  "place_id": "ChIJgQqfwoKe4jARLqGay-fWlQI",
  "sessionToken": "same-uuid-from-autocomplete"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `place_id` | string | ✅ | Google Place ID from autocomplete |
| `sessionToken` | string | ❌ | Same token used in autocomplete |

**Response:**
```json
{
  "data": {
    "place_id": "ChIJgQqfwoKe4jARLqGay-fWlQI",
    "name": "CentralWorld",
    "formatted_address": "999/9 ถนน พระรามที่ ๑ แขวง ปทุมวัน เขตปทุมวัน กรุงเทพมหานคร 10330 ประเทศไทย",
    "latitude": 13.7465354,
    "longitude": 100.5391488,
    "google_maps_url": "https://maps.google.com/?cid=...",
    "google_maps_embed_url": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d500!2d100.5391488!3d13.7465354!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1sChIJgQqfwoKe4jARLqGay-fWlQI!2s!5e0!3m2!1sth!2sth",
    "address_components": {
      "street_address": "999/9 ถนน พระรามที่ ๑",
      "subdistrict": "ปทุมวัน",
      "district": "ปทุมวัน",
      "province": "กรุงเทพมหานคร",
      "postal_code": "10330",
      "country": "ประเทศไทย"
    },
    "matched_location": {
      "province_code": 1,
      "district_code": 1001,
      "subdistrict_code": 100101
    }
  }
}
```

**Google API Used:** `GET https://places.googleapis.com/v1/places/{placeId}`

---

## Response Fields

### address_components

| Field | Description | Thai Term |
|-------|-------------|-----------|
| `street_address` | Street number + route | บ้านเลขที่ + ถนน |
| `subdistrict` | Sublocality level 2 | ตำบล/แขวง |
| `district` | Sublocality level 1 | อำเภอ/เขต |
| `province` | Administrative area level 1 | จังหวัด |
| `postal_code` | Postal code | รหัสไปรษณีย์ |
| `country` | Country | ประเทศ |

### matched_location

Automatically matched Thai location codes from `ref_provinces`, `ref_districts`, `ref_sub_districts` tables.

| Field | Description |
|-------|-------------|
| `province_code` | Matched province ID |
| `district_code` | Matched district ID |
| `subdistrict_code` | Matched subdistrict ID |

> **Note:** `matched_location` may be `null` if fuzzy matching fails. Frontend should handle fallback to manual selection.

---

## Error Responses

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Place not found"
  }
}
```

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Place not found |
| `INVALID_ARGUMENT` | Invalid request parameters |
| `RESOURCE_EXHAUSTED` | API quota exceeded |
| `PERMISSION_DENIED` | API key issue |
| `CONFIGURATION_ERROR` | API key not configured (500) |

---

## Frontend Integration Example

```typescript
// Generate session token once per search session
const sessionToken = crypto.randomUUID();

// 1. User types in search box (debounced 300ms)
const { data } = await fetch('/api-places/autocomplete', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: "Central World",
    sessionToken
  })
});

// 2. User selects a prediction
const details = await fetch('/api-places/details', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    place_id: selectedPrediction.place_id,
    sessionToken  // Same token for billing optimization
  })
});

// 3. Auto-fill site form
const site = {
  name: details.data.name,
  address_detail: details.data.formatted_address,
  latitude: details.data.latitude,
  longitude: details.data.longitude,
  map_url: details.data.google_maps_embed_url,  // Use embed URL for iframe
  province_code: details.data.matched_location?.province_code,
  district_code: details.data.matched_location?.district_code,
  subdistrict_code: details.data.matched_location?.subdistrict_code,
  postal_code: parseInt(details.data.address_components.postal_code)
};

// 4. Display map in iframe
<iframe
  src={details.data.google_maps_embed_url}
  width="600"
  height="450"
  style="border:0"
  allowFullScreen
  loading="lazy"
  referrerPolicy="no-referrer-when-downgrade"
/>
```

---

## Session Tokens

Session tokens group autocomplete + details calls into a single billable session.

- Generate a UUID on the frontend when user starts typing
- Use the same token for all autocomplete calls in that session
- Use the same token when calling details for the selected place
- Generate a new token when user clears the search and starts over

**Billing Impact:**
- Without session tokens: Each API call is billed separately
- With session tokens: Autocomplete calls + 1 details call = 1 session (~40% savings)

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Google Places API key (set via Supabase secrets) |

### Google API Configuration

The proxy uses the **new Places API** (`places.googleapis.com/v1`):

| Setting | Value |
|---------|-------|
| **Language** | Thai (`th`) |
| **Region restriction** | Thailand only (`includedRegionCodes: ["TH"]`) |
| **Field mask** | `id,displayName,formattedAddress,location,addressComponents,googleMapsUri` |

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Places API (New)**
3. Create API key with restrictions:
   - Application restriction: IP addresses (your server IPs)
   - API restriction: Places API (New) only
4. Set up billing (required)

### Pricing (New API)

| SKU | Price per 1000 requests |
|-----|-------------------------|
| Autocomplete (Essentials) | $2.83 |
| Place Details (Essentials) | $5.00 |
| Place Details (Pro) | $7.00 |

Using session tokens reduces costs by grouping autocomplete + details into one session.
