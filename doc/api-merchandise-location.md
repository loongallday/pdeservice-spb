# Merchandise Location API

API สำหรับจัดการตำแหน่งของสินค้า/อุปกรณ์ภายในไซต์ (อาคาร, ชั้น, ห้อง, โซน)

## Table of Contents
- [Overview](#overview)
- [Data Model](#data-model)
- [API Endpoints](#api-endpoints)
- [TypeScript Types](#typescript-types)
- [React Query Hooks](#react-query-hooks)
- [UI Components](#ui-components)

---

## Overview

`child_merchandise_location` เป็นตารางลูกของ `main_merchandise` สำหรับเก็บข้อมูลตำแหน่งที่ตั้งของสินค้าภายในไซต์ โดยมีความสัมพันธ์แบบ 1:1 (สินค้า 1 ชิ้น มีตำแหน่งได้ 1 รายการ)

### Use Cases
- ระบุตำแหน่งที่ตั้ง UPS ภายในอาคาร
- ช่วยช่างหาอุปกรณ์ได้ง่ายขึ้น
- บันทึกโน้ตเพิ่มเติมเกี่ยวกับตำแหน่ง

---

## Data Model

### MerchandiseLocation

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string (UUID) | No | Primary key |
| merchandise_id | string (UUID) | No | FK to main_merchandise |
| building | string | Yes | ชื่อหรือหมายเลขอาคาร |
| floor | string | Yes | ชั้น |
| room | string | Yes | ห้อง |
| zone | string | Yes | โซน/พื้นที่ |
| notes | string | Yes | หมายเหตุเพิ่มเติม |
| created_at | string (ISO 8601) | No | วันที่สร้าง |
| updated_at | string (ISO 8601) | No | วันที่แก้ไขล่าสุด |

---

## API Endpoints

Base URL: `https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise`

### GET /:merchandiseId/location

ดึงข้อมูลตำแหน่งของสินค้า

**Authorization:** Level 0+ (All authenticated users)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "merchandise_id": "uuid",
    "building": "อาคาร A",
    "floor": "3",
    "room": "301",
    "zone": "โซน IT",
    "notes": "ใกล้ห้องประชุมใหญ่",
    "created_at": "2026-01-12T10:00:00Z",
    "updated_at": "2026-01-12T10:00:00Z"
  }
}
```

**Response (No location set):**
```json
{
  "data": null
}
```

---

### POST /:merchandiseId/location

สร้างหรืออัปเดตตำแหน่งของสินค้า (Upsert)

**Authorization:** Level 1+ (Assigner, PM, Sales, Admin)

**Request Body:**
```json
{
  "building": "อาคาร A",
  "floor": "3",
  "room": "301",
  "zone": "โซน IT",
  "notes": "ใกล้ห้องประชุมใหญ่"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| building | string | No | ชื่อหรือหมายเลขอาคาร |
| floor | string | No | ชั้น |
| room | string | No | ห้อง |
| zone | string | No | โซน/พื้นที่ |
| notes | string | No | หมายเหตุเพิ่มเติม |

> **Note:** ต้องระบุอย่างน้อย 1 field

**Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "merchandise_id": "uuid",
    "building": "อาคาร A",
    "floor": "3",
    "room": "301",
    "zone": "โซน IT",
    "notes": "ใกล้ห้องประชุมใหญ่",
    "created_at": "2026-01-12T10:00:00Z",
    "updated_at": "2026-01-12T10:00:00Z"
  }
}
```

---

### PUT /:merchandiseId/location

อัปเดตตำแหน่งของสินค้า (เฉพาะ field ที่ส่งมา)

**Authorization:** Level 1+ (Assigner, PM, Sales, Admin)

**Request Body:**
```json
{
  "room": "302",
  "notes": "ย้ายไปห้องใหม่"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "merchandise_id": "uuid",
    "building": "อาคาร A",
    "floor": "3",
    "room": "302",
    "zone": "โซน IT",
    "notes": "ย้ายไปห้องใหม่",
    "created_at": "2026-01-12T10:00:00Z",
    "updated_at": "2026-01-12T11:00:00Z"
  }
}
```

---

### DELETE /:merchandiseId/location

ลบตำแหน่งของสินค้า

**Authorization:** Level 1+ (Assigner, PM, Sales, Admin)

**Response:**
```json
{
  "data": {
    "message": "ลบตำแหน่งสำเร็จ"
  }
}
```

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | กรุณาระบุตำแหน่งอย่างน้อย 1 ฟิลด์ | ไม่ได้ส่ง field ใดเลย |
| 401 | Unauthorized | ไม่ได้ login |
| 403 | ไม่มีสิทธิ์เข้าถึง | Level ไม่เพียงพอ |
| 404 | ไม่พบสินค้าที่ระบุ | merchandise_id ไม่ถูกต้อง |
| 404 | ไม่พบข้อมูลตำแหน่งสำหรับสินค้านี้ | ยังไม่มีข้อมูลตำแหน่ง (PUT only) |

---

## TypeScript Types

```typescript
// types/merchandiseLocation.ts

export interface MerchandiseLocation {
  id: string;
  merchandise_id: string;
  building: string | null;
  floor: string | null;
  room: string | null;
  zone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationInput {
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  zone?: string | null;
  notes?: string | null;
}

// Helper function to format location as display string
export function formatLocation(location: MerchandiseLocation | null): string | null {
  if (!location) return null;

  const parts: string[] = [];
  if (location.building) parts.push(`อาคาร ${location.building}`);
  if (location.floor) parts.push(`ชั้น ${location.floor}`);
  if (location.room) parts.push(`ห้อง ${location.room}`);
  if (location.zone) parts.push(`โซน ${location.zone}`);

  return parts.length > 0 ? parts.join(' ') : null;
}
```

---

## React Query Hooks

```typescript
// hooks/useMerchandiseLocation.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MerchandiseLocation, LocationInput } from '@/types/merchandiseLocation';

// Query key factory
export const locationKeys = {
  all: ['merchandise-location'] as const,
  detail: (merchandiseId: string) => [...locationKeys.all, merchandiseId] as const,
};

// Get location for a merchandise
export function useMerchandiseLocation(merchandiseId: string) {
  return useQuery({
    queryKey: locationKeys.detail(merchandiseId),
    queryFn: async () => {
      const response = await api.get<{ data: MerchandiseLocation | null }>(
        `/api-merchandise/${merchandiseId}/location`
      );
      return response.data.data;
    },
    enabled: !!merchandiseId,
  });
}

// Create or update location (upsert)
export function useUpsertLocation(merchandiseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LocationInput) => {
      const response = await api.post<{ data: MerchandiseLocation }>(
        `/api-merchandise/${merchandiseId}/location`,
        input
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.detail(merchandiseId) });
    },
  });
}

// Update location (partial update)
export function useUpdateLocation(merchandiseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LocationInput) => {
      const response = await api.put<{ data: MerchandiseLocation }>(
        `/api-merchandise/${merchandiseId}/location`,
        input
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.detail(merchandiseId) });
    },
  });
}

// Delete location
export function useDeleteLocation(merchandiseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.delete(`/api-merchandise/${merchandiseId}/location`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.detail(merchandiseId) });
    },
  });
}
```

---

## UI Components

### LocationDisplay Component

```tsx
// components/merchandise/LocationDisplay.tsx

import { MapPin } from 'lucide-react';
import { formatLocation } from '@/types/merchandiseLocation';
import type { MerchandiseLocation } from '@/types/merchandiseLocation';

interface LocationDisplayProps {
  location: MerchandiseLocation | null;
  showNotes?: boolean;
}

export function LocationDisplay({ location, showNotes = true }: LocationDisplayProps) {
  if (!location) {
    return (
      <div className="text-muted-foreground text-sm">
        ยังไม่ได้ระบุตำแหน่ง
      </div>
    );
  }

  const formattedLocation = formatLocation(location);

  return (
    <div className="space-y-1">
      {formattedLocation && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{formattedLocation}</span>
        </div>
      )}
      {showNotes && location.notes && (
        <div className="text-sm text-muted-foreground pl-6">
          {location.notes}
        </div>
      )}
    </div>
  );
}
```

### LocationForm Component

```tsx
// components/merchandise/LocationForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import type { LocationInput, MerchandiseLocation } from '@/types/merchandiseLocation';

const locationSchema = z.object({
  building: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => data.building || data.floor || data.room || data.zone || data.notes,
  { message: 'กรุณาระบุตำแหน่งอย่างน้อย 1 ฟิลด์' }
);

interface LocationFormProps {
  initialData?: MerchandiseLocation | null;
  onSubmit: (data: LocationInput) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function LocationForm({ initialData, onSubmit, onCancel, isLoading }: LocationFormProps) {
  const form = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      building: initialData?.building ?? '',
      floor: initialData?.floor ?? '',
      room: initialData?.room ?? '',
      zone: initialData?.zone ?? '',
      notes: initialData?.notes ?? '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="building"
            render={({ field }) => (
              <FormItem>
                <FormLabel>อาคาร</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น อาคาร A, ตึก 1" {...field} value={field.value ?? ''} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="floor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชั้น</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น 3, ชั้นใต้ดิน" {...field} value={field.value ?? ''} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="room"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ห้อง</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น 301, ห้อง Server" {...field} value={field.value ?? ''} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>โซน/พื้นที่</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น โซน IT, พื้นที่ผลิต" {...field} value={field.value ?? ''} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>หมายเหตุ</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับตำแหน่ง..."
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Usage Example

```tsx
// pages/merchandise/[id].tsx

import { useMerchandiseLocation, useUpsertLocation } from '@/hooks/useMerchandiseLocation';
import { LocationDisplay } from '@/components/merchandise/LocationDisplay';
import { LocationForm } from '@/components/merchandise/LocationForm';

export function MerchandiseDetailPage({ merchandiseId }: { merchandiseId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const { data: location, isLoading } = useMerchandiseLocation(merchandiseId);
  const upsertMutation = useUpsertLocation(merchandiseId);

  const handleSubmit = async (data: LocationInput) => {
    await upsertMutation.mutateAsync(data);
    setIsEditing(false);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">ตำแหน่งที่ตั้ง</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'ยกเลิก' : 'แก้ไข'}
        </Button>
      </div>

      {isEditing ? (
        <LocationForm
          initialData={location}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
          isLoading={upsertMutation.isPending}
        />
      ) : (
        <LocationDisplay location={location} />
      )}
    </div>
  );
}
```

---

## Notes

- ตำแหน่งมีความสัมพันธ์แบบ 1:1 กับสินค้า (สินค้า 1 ชิ้นมีตำแหน่งได้ 1 รายการ)
- POST endpoint ทำหน้าที่เป็น upsert - สร้างใหม่หรืออัปเดตถ้ามีอยู่แล้ว
- PUT endpoint อัปเดตเฉพาะ field ที่ส่งมา (partial update)
- ถ้าต้องการลบค่าของ field ให้ส่ง `null` มา
