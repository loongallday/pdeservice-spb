# Merchandise Replacement API

API สำหรับจัดการการเปลี่ยน/แทนที่อุปกรณ์ (Equipment Replacement Tracking)

## Table of Contents
- [Overview](#overview)
- [Data Model](#data-model)
- [How It Works](#how-it-works)
- [API Usage](#api-usage)
- [TypeScript Types](#typescript-types)
- [React Query Hooks](#react-query-hooks)
- [UI Components](#ui-components)

---

## Overview

ระบบ Merchandise มี field `replaced_by_id` สำหรับติดตามเมื่ออุปกรณ์ถูกเปลี่ยน/แทนที่ด้วยอุปกรณ์ตัวใหม่

### Use Cases
- UPS เสียและถูกเปลี่ยนด้วยเครื่องใหม่
- อัพเกรดอุปกรณ์เป็นรุ่นใหม่
- ติดตามประวัติการเปลี่ยนอุปกรณ์
- ดูว่าอุปกรณ์ตัวเก่าถูกแทนที่ด้วยตัวไหน

### Relationship
```
┌─────────────────┐         ┌─────────────────┐
│  Old Equipment  │────────▶│  New Equipment  │
│  (replaced)     │         │  (replacement)  │
│                 │         │                 │
│ replaced_by_id ─┼────────▶│ id              │
└─────────────────┘         └─────────────────┘
```

---

## Data Model

### main_merchandise Table

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| serial_no | string | Serial number |
| model_id | UUID | FK to main_models |
| site_id | UUID | FK to main_sites |
| replaced_by_id | UUID (nullable) | FK to main_merchandise (self-reference) |
| ... | ... | Other fields |

### Relationship
- `replaced_by_id` references another merchandise record
- Self-referential foreign key (merchandise → merchandise)
- One-to-one relationship (one old equipment points to one new equipment)
- CASCADE on delete (if replacement is deleted, reference is cleared)

---

## How It Works

### Scenario: Equipment Replacement

1. **Old equipment breaks down**
   - Serial: `ABC123` (id: `old-uuid`)
   - Status: Needs replacement

2. **New equipment is installed**
   - Create new merchandise record
   - Serial: `XYZ789` (id: `new-uuid`)

3. **Link old to new**
   - Update old equipment: `replaced_by_id = new-uuid`
   - Now `ABC123` → `XYZ789`

4. **Query results**
   - Old equipment shows `replaced_by: "XYZ789"` (serial number)
   - Easy to track replacement history

---

## API Usage

### Set Replacement (Update Merchandise)

**PUT /api-merchandise/:id**

Mark an old equipment as replaced by a new one:

```bash
PUT /api-merchandise/{old-merchandise-id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "replaced_by_id": "{new-merchandise-id}"
}
```

**Response:**
```json
{
  "data": {
    "id": "old-uuid",
    "serial_no": "ABC123",
    "replaced_by_id": "new-uuid",
    "model": { ... },
    "site": { ... },
    ...
  }
}
```

### Clear Replacement

To remove the replacement link:

```bash
PUT /api-merchandise/{old-merchandise-id}
Content-Type: application/json

{
  "replaced_by_id": null
}
```

### Search Results

**GET /api-merchandise/search?q=ABC**

Search results include `replaced_by` as the **serial number** (not UUID) for display:

```json
{
  "data": {
    "data": [
      {
        "id": "old-uuid",
        "serial_no": "ABC123",
        "replaced_by": "XYZ789",
        "model": { ... },
        "site": { ... },
        "distributor": { ... },
        "dealer": { ... }
      }
    ],
    "pagination": { ... }
  }
}
```

> **Note:** `replaced_by` in search results is the **serial_no** of the replacement, not the UUID. This is for display convenience.

---

## TypeScript Types

```typescript
// types/merchandise.ts

export interface Merchandise {
  id: string;
  serial_no: string;
  model_id: string;
  site_id: string;
  pm_count: number | null;
  distributor_id: string | null;
  dealer_id: string | null;
  replaced_by_id: string | null;  // UUID of replacement
  created_at: string;
  updated_at: string;

  // Nested relations
  model?: {
    id: string;
    model: string;
    name: string | null;
    website_url: string | null;
  };
  site?: {
    id: string;
    name: string;
  };
}

// Search result has replaced_by as serial_no string
export interface MerchandiseSearchResult {
  id: string;
  serial_no: string;
  replaced_by: string | null;  // Serial number of replacement (not UUID)
  model: {
    id: string;
    model: string;
    name: string | null;
  };
  site: {
    id: string;
    name: string;
  };
  distributor: {
    id: string;
    name: string | null;
  } | null;
  dealer: {
    id: string;
    name: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

// Input for setting replacement
export interface SetReplacementInput {
  replaced_by_id: string | null;
}
```

---

## React Query Hooks

```typescript
// hooks/useMerchandiseReplacement.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Merchandise } from '@/types/merchandise';

// Query key factory
export const merchandiseKeys = {
  all: ['merchandise'] as const,
  detail: (id: string) => [...merchandiseKeys.all, id] as const,
  search: (query: string) => [...merchandiseKeys.all, 'search', query] as const,
};

// Set replacement for merchandise
export function useSetReplacement(merchandiseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (replacedById: string | null) => {
      const response = await api.put<{ data: Merchandise }>(
        `/api-merchandise/${merchandiseId}`,
        { replaced_by_id: replacedById }
      );
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate both the specific merchandise and search results
      queryClient.invalidateQueries({ queryKey: merchandiseKeys.detail(merchandiseId) });
      queryClient.invalidateQueries({ queryKey: merchandiseKeys.all });
    },
  });
}

// Clear replacement
export function useClearReplacement(merchandiseId: string) {
  return useSetReplacement(merchandiseId);
}
```

---

## UI Components

### ReplacementBadge Component

```tsx
// components/merchandise/ReplacementBadge.tsx

import { ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReplacementBadgeProps {
  replacedBy: string | null;  // Serial number
}

export function ReplacementBadge({ replacedBy }: ReplacementBadgeProps) {
  if (!replacedBy) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <RefreshCw className="h-3 w-3" />
      แทนที่ด้วย
      <ArrowRight className="h-3 w-3" />
      {replacedBy}
    </Badge>
  );
}
```

### SetReplacementDialog Component

```tsx
// components/merchandise/SetReplacementDialog.tsx

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MerchandiseCombobox } from './MerchandiseCombobox';
import { useSetReplacement } from '@/hooks/useMerchandiseReplacement';

interface SetReplacementDialogProps {
  merchandiseId: string;
  currentReplacedById: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetReplacementDialog({
  merchandiseId,
  currentReplacedById,
  open,
  onOpenChange,
}: SetReplacementDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentReplacedById);
  const setReplacementMutation = useSetReplacement(merchandiseId);

  const handleSubmit = async () => {
    await setReplacementMutation.mutateAsync(selectedId);
    onOpenChange(false);
  };

  const handleClear = async () => {
    await setReplacementMutation.mutateAsync(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ระบุอุปกรณ์ที่ใช้แทนที่</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>อุปกรณ์ใหม่ที่ใช้แทน</Label>
            <MerchandiseCombobox
              value={selectedId}
              onChange={setSelectedId}
              excludeId={merchandiseId}  // Don't allow self-reference
              placeholder="ค้นหาด้วย Serial Number..."
            />
          </div>

          <p className="text-sm text-muted-foreground">
            เลือกอุปกรณ์ใหม่ที่ใช้แทนที่อุปกรณ์นี้ หรือกด "ล้าง" เพื่อยกเลิกการเชื่อมโยง
          </p>
        </div>

        <DialogFooter className="gap-2">
          {currentReplacedById && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={setReplacementMutation.isPending}
            >
              ล้าง
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={setReplacementMutation.isPending}
          >
            {setReplacementMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### MerchandiseCombobox Component

```tsx
// components/merchandise/MerchandiseCombobox.tsx

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useMerchandiseHint } from '@/hooks/useMerchandise';

interface MerchandiseComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  excludeId?: string;
  placeholder?: string;
}

export function MerchandiseCombobox({
  value,
  onChange,
  excludeId,
  placeholder = 'เลือกอุปกรณ์...',
}: MerchandiseComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: hints = [] } = useMerchandiseHint(search);

  // Filter out excluded ID
  const filteredHints = excludeId
    ? hints.filter((m) => m.id !== excludeId)
    : hints;

  const selectedItem = hints.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedItem ? selectedItem.serial_no : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="ค้นหา Serial Number..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>ไม่พบอุปกรณ์</CommandEmpty>
          <CommandGroup>
            {filteredHints.map((merchandise) => (
              <CommandItem
                key={merchandise.id}
                value={merchandise.serial_no}
                onSelect={() => {
                  onChange(merchandise.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === merchandise.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex flex-col">
                  <span>{merchandise.serial_no}</span>
                  <span className="text-xs text-muted-foreground">
                    {merchandise.model_code} - {merchandise.site_name}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Usage Example

### In Merchandise Detail Page

```tsx
// pages/merchandise/[id].tsx

import { useState } from 'react';
import { useMerchandise } from '@/hooks/useMerchandise';
import { ReplacementBadge } from '@/components/merchandise/ReplacementBadge';
import { SetReplacementDialog } from '@/components/merchandise/SetReplacementDialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function MerchandiseDetailPage({ merchandiseId }: { merchandiseId: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const { data: merchandise, isLoading } = useMerchandise(merchandiseId);

  if (isLoading || !merchandise) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{merchandise.serial_no}</h1>
          <p className="text-muted-foreground">
            {merchandise.model?.name || merchandise.model?.model}
          </p>
        </div>

        {merchandise.replaced_by_id && (
          <ReplacementBadge replacedBy={merchandise.replaced_by} />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowDialog(true)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {merchandise.replaced_by_id ? 'เปลี่ยนการแทนที่' : 'ระบุการแทนที่'}
        </Button>
      </div>

      {/* Replacement Dialog */}
      <SetReplacementDialog
        merchandiseId={merchandiseId}
        currentReplacedById={merchandise.replaced_by_id}
        open={showDialog}
        onOpenChange={setShowDialog}
      />

      {/* Rest of detail page... */}
    </div>
  );
}
```

---

---

## Replacement Chain API

### GET /:merchandiseId/replacement-chain

ดึงข้อมูล chain การแทนที่ทั้งหมดของอุปกรณ์ โดยจะ traverse ทั้งสองทิศทาง:
- **Predecessors**: อุปกรณ์ที่ถูกแทนที่ก่อนหน้า (เก่ากว่า)
- **Successors**: อุปกรณ์ที่มาแทนที่ (ใหม่กว่า)

**Authorization:** Level 0+ (All authenticated users)

**Example:**
```
Chain: A → B → C → D
       ↑       ↑
    oldest   newest

If queried from B:
- Predecessors: [A]
- Current: B (is_current: true)
- Successors: [C, D]
```

**Response:**
```json
{
  "data": {
    "chain": [
      {
        "id": "uuid-a",
        "serial_no": "SN-001",
        "model": { "id": "...", "model": "Model X", "name": "Model X Pro" },
        "site": { "id": "...", "name": "Site A" },
        "replaced_by_id": "uuid-b",
        "created_at": "2024-01-01T00:00:00Z",
        "is_current": false,
        "position": 1
      },
      {
        "id": "uuid-b",
        "serial_no": "SN-002",
        "model": { "id": "...", "model": "Model X", "name": "Model X Pro" },
        "site": { "id": "...", "name": "Site A" },
        "replaced_by_id": "uuid-c",
        "created_at": "2024-06-01T00:00:00Z",
        "is_current": true,
        "position": 2
      },
      {
        "id": "uuid-c",
        "serial_no": "SN-003",
        "model": { "id": "...", "model": "Model Y", "name": "Model Y Pro" },
        "site": { "id": "...", "name": "Site A" },
        "replaced_by_id": null,
        "created_at": "2025-01-01T00:00:00Z",
        "is_current": false,
        "position": 3
      }
    ],
    "total": 3,
    "current_position": 2
  }
}
```

### TypeScript Types

```typescript
interface ReplacementChainItem {
  id: string;
  serial_no: string;
  model: {
    id: string;
    model: string;
    name: string | null;
  } | null;
  site: {
    id: string;
    name: string;
  } | null;
  replaced_by_id: string | null;
  created_at: string;
  is_current: boolean;  // true for the queried merchandise
  position: number;     // 1-indexed position in chain
}

interface ReplacementChainResponse {
  chain: ReplacementChainItem[];
  total: number;
  current_position: number;  // Position of queried merchandise
}
```

### React Query Hook

```typescript
// hooks/useReplacementChain.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ReplacementChainItem {
  id: string;
  serial_no: string;
  model: { id: string; model: string; name: string | null } | null;
  site: { id: string; name: string } | null;
  replaced_by_id: string | null;
  created_at: string;
  is_current: boolean;
  position: number;
}

interface ReplacementChainResponse {
  chain: ReplacementChainItem[];
  total: number;
  current_position: number;
}

export function useReplacementChain(merchandiseId: string) {
  return useQuery({
    queryKey: ['merchandise', merchandiseId, 'replacement-chain'],
    queryFn: async () => {
      const response = await api.get<{ data: ReplacementChainResponse }>(
        `/api-merchandise/${merchandiseId}/replacement-chain`
      );
      return response.data.data;
    },
    enabled: !!merchandiseId,
  });
}
```

### UI Component

```tsx
// components/merchandise/ReplacementChain.tsx

import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReplacementChain } from '@/hooks/useReplacementChain';

interface ReplacementChainProps {
  merchandiseId: string;
  onSelect?: (id: string) => void;
}

export function ReplacementChain({ merchandiseId, onSelect }: ReplacementChainProps) {
  const { data, isLoading } = useReplacementChain(merchandiseId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">กำลังโหลด...</div>;
  }

  if (!data || data.total <= 1) {
    return <div className="text-sm text-muted-foreground">ไม่มีประวัติการแทนที่</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        ประวัติการแทนที่ ({data.total} รายการ)
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {data.chain.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <button
              onClick={() => onSelect?.(item.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                item.is_current
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              <div className="font-medium">{item.serial_no}</div>
              <div className="text-xs opacity-70">
                {item.model?.model || 'N/A'}
              </div>
            </button>
            {index < data.chain.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        ← เก่า | ใหม่ →
      </div>
    </div>
  );
}
```

---

## Notes

- `replaced_by_id` เป็น self-referential FK ไป main_merchandise
- ในผลลัพธ์ search, `replaced_by` จะเป็น serial_no (ไม่ใช่ UUID) เพื่อความสะดวกในการแสดงผล
- ใน getById และ getAll ยังคงเป็น `replaced_by_id` (UUID)
- ไม่สามารถอ้างอิงตัวเอง (self-reference) ได้
- เมื่อลบ merchandise ที่ถูกอ้างอิง, `replaced_by_id` จะถูก set เป็น NULL (ON DELETE SET NULL)
- Replacement chain API จะ traverse ทั้ง predecessors และ successors แบบ recursive
- มีการป้องกัน circular reference ด้วย visited set
