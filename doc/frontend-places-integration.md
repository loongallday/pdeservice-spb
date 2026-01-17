# Frontend Implementation: Google Places Integration for Site Creation

> Implement location search with Google Places autocomplete to auto-fill site creation/edit forms.

## Overview

Add a location search input that:
1. Shows autocomplete suggestions as user types
2. When user selects a place, auto-fills the site form fields
3. Displays an embedded map preview

---

## API Endpoints

Base URL: `https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-places`

### 1. Autocomplete Search

```typescript
POST /api-places/autocomplete
Authorization: Bearer <token>
Content-Type: application/json

{
  "input": "Central World",
  "sessionToken": "uuid-for-billing"
}
```

**Response:**
```typescript
{
  data: {
    predictions: Array<{
      place_id: string
      description: string      // Full address text
      main_text: string        // Place name
      secondary_text: string   // Address without place name
      types: string[]          // e.g., ["shopping_mall", "establishment"]
    }>
  }
}
```

### 2. Place Details

```typescript
POST /api-places/details
Authorization: Bearer <token>
Content-Type: application/json

{
  "place_id": "ChIJgQqfwoKe4jARLqGay-fWlQI",
  "sessionToken": "same-uuid"
}
```

**Response:**
```typescript
{
  data: {
    place_id: string
    name: string
    formatted_address: string
    latitude: number
    longitude: number
    google_maps_url: string        // Link to Google Maps
    google_maps_embed_url: string  // For iframe embedding
    address_components: {
      street_address?: string
      subdistrict?: string         // ตำบล/แขวง
      district?: string            // อำเภอ/เขต
      province?: string            // จังหวัด
      postal_code?: string
      country?: string
    }
    matched_location: {            // May be null if matching fails
      province_code: number
      district_code: number
      subdistrict_code: number
    } | null
  }
}
```

---

## UI Components

### 1. Location Search Input

```
┌─────────────────────────────────────────────────────┐
│ 🔍 ค้นหาสถานที่...                                    │
├─────────────────────────────────────────────────────┤
│ 📍 CentralWorld                                      │
│    ถนน ราชดำริ แขวง ปทุมวัน เขตปทุมวัน กรุงเทพมหานคร    │
├─────────────────────────────────────────────────────┤
│ 📍 Central Plaza Westgate                           │
│    ถนน รัตนาธิเบศร์ อำเภอบางใหญ่ นนทบุรี              │
├─────────────────────────────────────────────────────┤
│ 📍 Central Festival Pattaya                         │
│    ถนน บีชโรด เมืองพัทยา ชลบุรี                       │
└─────────────────────────────────────────────────────┘
```

### 2. Site Form with Map Preview

```
┌─────────────────────────────────────────────────────┐
│ สร้างสถานที่ใหม่                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🔍 ค้นหาสถานที่จาก Google Maps                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ CentralWorld                              ✕     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                 │ │
│ │           [Google Maps Embed]                   │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ชื่อสถานที่ *                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ CentralWorld                                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ รายละเอียดที่อยู่                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 999/9 ถนน พระรามที่ ๑ แขวง ปทุมวัน ...           │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ จังหวัด *              อำเภอ/เขต *                   │
│ ┌───────────────────┐  ┌───────────────────┐       │
│ │ กรุงเทพมหานคร  ▼  │  │ ปทุมวัน        ▼  │       │
│ └───────────────────┘  └───────────────────┘       │
│                                                     │
│ ตำบล/แขวง *            รหัสไปรษณีย์ *                │
│ ┌───────────────────┐  ┌───────────────────┐       │
│ │ ปทุมวัน        ▼  │  │ 10330             │       │
│ └───────────────────┘  └───────────────────┘       │
│                                                     │
│                              [ ยกเลิก ] [ บันทึก ]  │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Session Token Management

```typescript
// Generate session token when search input is focused
const [sessionToken, setSessionToken] = useState<string | null>(null)

const handleSearchFocus = () => {
  if (!sessionToken) {
    setSessionToken(crypto.randomUUID())
  }
}

// Clear session token after place is selected
const handlePlaceSelected = async (placeId: string) => {
  const details = await fetchPlaceDetails(placeId, sessionToken)
  // ... fill form
  setSessionToken(null)  // Reset for next search session
}
```

### Step 2: Debounced Autocomplete

```typescript
import { useDebouncedCallback } from 'use-debounce'

const [predictions, setPredictions] = useState([])
const [isLoading, setIsLoading] = useState(false)

const searchPlaces = useDebouncedCallback(async (input: string) => {
  if (input.length < 2) {
    setPredictions([])
    return
  }

  setIsLoading(true)
  try {
    const response = await fetch('/api-places/autocomplete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input, sessionToken })
    })
    const { data } = await response.json()
    setPredictions(data.predictions)
  } finally {
    setIsLoading(false)
  }
}, 300)  // 300ms debounce
```

### Step 3: Fetch Details & Auto-fill Form

```typescript
const handleSelectPlace = async (prediction: Prediction) => {
  setIsLoading(true)

  try {
    const response = await fetch('/api-places/details', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        place_id: prediction.place_id,
        sessionToken
      })
    })
    const { data } = await response.json()

    // Auto-fill form fields
    setFormData({
      name: data.name,
      address_detail: data.formatted_address,
      latitude: data.latitude,
      longitude: data.longitude,
      map_url: data.google_maps_url,
      map_embed_url: data.google_maps_embed_url,
      postal_code: data.address_components.postal_code
        ? parseInt(data.address_components.postal_code)
        : null,
      // Use matched codes if available
      province_code: data.matched_location?.province_code ?? null,
      district_code: data.matched_location?.district_code ?? null,
      subdistrict_code: data.matched_location?.subdistrict_code ?? null,
    })

    // Show map preview
    setMapEmbedUrl(data.google_maps_embed_url)

    // If location codes not matched, user needs to select manually
    if (!data.matched_location) {
      // Optionally show a warning
      toast.info('กรุณาเลือกจังหวัด/อำเภอ/ตำบล ด้วยตนเอง')
    }

    // Clear search state
    setSearchInput('')
    setPredictions([])
    setSessionToken(null)

  } finally {
    setIsLoading(false)
  }
}
```

### Step 4: Map Preview Component

```tsx
interface MapPreviewProps {
  embedUrl: string | null
  className?: string
}

export function MapPreview({ embedUrl, className }: MapPreviewProps) {
  if (!embedUrl) return null

  return (
    <div className={cn("rounded-lg overflow-hidden border", className)}>
      <iframe
        src={embedUrl}
        width="100%"
        height="300"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}
```

### Step 5: Location Cascade Fallback

When `matched_location` is null, user must select province/district/subdistrict manually:

```typescript
// If matched_location is null, trigger cascade selection
useEffect(() => {
  if (selectedPlace && !selectedPlace.matched_location) {
    // Reset location dropdowns
    setProvinceCode(null)
    setDistrictCode(null)
    setSubdistrictCode(null)

    // Focus on province dropdown
    provinceRef.current?.focus()
  }
}, [selectedPlace])
```

---

## Form Field Mapping

| API Response Field | Site Form Field | Notes |
|-------------------|-----------------|-------|
| `name` | `name` | ชื่อสถานที่ |
| `formatted_address` | `address_detail` | รายละเอียดที่อยู่ |
| `latitude` | `latitude` | ละติจูด |
| `longitude` | `longitude` | ลองจิจูด |
| `google_maps_url` | `map_url` | ลิงก์ไปยัง Google Maps |
| `google_maps_embed_url` | `map_embed_url` | URL สำหรับแสดงแผนที่ใน iframe |
| `address_components.postal_code` | `postal_code` | รหัสไปรษณีย์ |
| `matched_location.province_code` | `province_code` | รหัสจังหวัด |
| `matched_location.district_code` | `district_code` | รหัสอำเภอ |
| `matched_location.subdistrict_code` | `subdistrict_code` | รหัสตำบล |

---

## UX Considerations

### Loading States

```tsx
// Search input loading indicator
<Input
  placeholder="ค้นหาสถานที่..."
  value={searchInput}
  onChange={(e) => searchPlaces(e.target.value)}
  suffix={isLoading ? <Spinner size="sm" /> : <SearchIcon />}
/>

// Predictions loading skeleton
{isLoading && (
  <div className="p-4 space-y-2">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
  </div>
)}
```

### Empty States

```tsx
// No results
{predictions.length === 0 && searchInput.length >= 2 && !isLoading && (
  <div className="p-4 text-center text-muted-foreground">
    ไม่พบสถานที่ที่ค้นหา
  </div>
)}
```

### Error Handling

```typescript
try {
  const response = await fetch('/api-places/autocomplete', { ... })

  if (!response.ok) {
    const error = await response.json()
    if (error.error?.code === 'RESOURCE_EXHAUSTED') {
      toast.error('ระบบค้นหาถูกใช้งานมากเกินไป กรุณาลองใหม่ภายหลัง')
    } else {
      toast.error('เกิดข้อผิดพลาดในการค้นหา')
    }
    return
  }

  // ... handle success
} catch (err) {
  toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
}
```

### Clear Selection

```tsx
// Allow user to clear selected place and search again
{selectedPlace && (
  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
    <MapPinIcon className="h-4 w-4" />
    <span className="flex-1">{selectedPlace.name}</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setSelectedPlace(null)
        setMapEmbedUrl(null)
        setFormData({ ...formData, latitude: null, longitude: null, map_url: null })
      }}
    >
      <XIcon className="h-4 w-4" />
    </Button>
  </div>
)}
```

---

## TypeScript Types

```typescript
interface PlacePrediction {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
  types: string[]
}

interface AddressComponents {
  street_address?: string
  subdistrict?: string
  district?: string
  province?: string
  postal_code?: string
  country?: string
}

interface MatchedLocation {
  province_code: number
  district_code: number
  subdistrict_code: number
}

interface PlaceDetails {
  place_id: string
  name: string
  formatted_address: string
  latitude: number
  longitude: number
  google_maps_url: string
  google_maps_embed_url: string
  address_components: AddressComponents
  matched_location: MatchedLocation | null
}

interface SiteFormData {
  name: string
  address_detail: string
  latitude: number | null
  longitude: number | null
  map_url: string | null          // Google Maps link
  map_embed_url: string | null    // Google Maps embed URL for iframe
  province_code: number | null
  district_code: number | null
  subdistrict_code: number | null
  postal_code: number | null
}
```

---

## Testing Checklist

- [ ] Search shows autocomplete suggestions after 2+ characters
- [ ] Debounce prevents excessive API calls while typing
- [ ] Selecting a place auto-fills all form fields
- [ ] Map preview displays correctly in iframe
- [ ] Location codes are pre-selected when `matched_location` is available
- [ ] User can manually select location when `matched_location` is null
- [ ] User can clear selection and search again
- [ ] Loading states display correctly
- [ ] Error messages display in Thai
- [ ] Session tokens are managed correctly (new token per search session)
- [ ] Form submits correctly with all location data
