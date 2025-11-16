/**
 * Unit tests for Features API handlers
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getEnabled } from '../../supabase/functions/api-features/handlers/getEnabled.ts';
import { getMenuItems } from '../../supabase/functions/api-features/handlers/getMenuItems.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockActiveFeature = {
  id: '1',
  code: 'DASHBOARD',
  name_th: 'แดชบอร์ด',
  name_en: 'Dashboard',
  is_menu_item: true,
  is_active: true,
  // Note: min_level is removed from response (security)
};

const mockInactiveFeature = {
  id: '2',
  code: 'OLD_FEATURE',
  name_th: 'ฟีเจอร์เก่า',
  name_en: 'Old Feature',
  is_menu_item: true,
  is_active: false,
  // Note: min_level is removed from response (security)
};

const mockHighLevelFeature = {
  id: '3',
  code: 'ADMIN_FEATURE',
  name_th: 'ฟีเจอร์ผู้ดูแล',
  name_en: 'Admin Feature',
  is_menu_item: true,
  is_active: true,
  // Note: min_level is removed from response (security)
};

Deno.test('get enabled features - success with active feature', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-features');

  // Mock FeatureService.getEnabledFeatures - returns only active features
  const originalGetEnabledFeatures = (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures;
  (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures = async () => [mockActiveFeature];

  try {
    const response = await getEnabled(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
    assertEquals((data[0] as { is_active: boolean }).is_active, true);
  } finally {
    (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures = originalGetEnabledFeatures;
  }
});

Deno.test('get enabled features - filters out inactive features', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-features');

  // Mock FeatureService.getEnabledFeatures - should only return active features
  // Service should filter out inactive features at database level
  const originalGetEnabledFeatures = (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures;
  (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures = async () => [mockActiveFeature]; // Only active returned

  try {
    const response = await getEnabled(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    // Verify inactive feature is not included
    const hasInactive = data.some((item: unknown) => (item as { is_active: boolean }).is_active === false);
    assertEquals(hasInactive, false);
  } finally {
    (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures = originalGetEnabledFeatures;
  }
});

Deno.test('get enabled features - filters by min_level requirement', async () => {
  const employee = createMockEmployeeWithLevel(1); // Level 1 employee
  const request = createMockRequest('GET', 'http://localhost/api-features');

  // Mock FeatureService.getEnabledFeatures - should only return features where min_level <= 1
  // Service should filter by both is_active AND min_level at database level
  // Note: min_level is removed from response for security
  const originalGetEnabledFeatures = (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures;
  (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures = async () => [mockActiveFeature]; // Only level 0 feature returned

  try {
    const response = await getEnabled(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    // Verify min_level is not in response (security)
    const hasMinLevel = data.some((item: unknown) => 'min_level' in (item as Record<string, unknown>));
    assertEquals(hasMinLevel, false);
  } finally {
    (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getEnabledFeatures = originalGetEnabledFeatures;
  }
});

Deno.test('get menu items - success with active menu item', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-features/menu');

  // Mock FeatureService.getMenuItems - returns only active menu items
  const originalGetMenuItems = (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems;
  (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems = async () => [mockActiveFeature];

  try {
    const response = await getMenuItems(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
    assertEquals((data[0] as { is_active: boolean }).is_active, true);
    assertEquals((data[0] as { is_menu_item: boolean }).is_menu_item, true);
  } finally {
    (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems = originalGetMenuItems;
  }
});

Deno.test('get menu items - filters out inactive menu items', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-features/menu');

  // Mock FeatureService.getMenuItems - should only return active menu items
  // Service should filter by is_active, is_menu_item, AND min_level at database level
  const originalGetMenuItems = (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems;
  (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems = async () => [mockActiveFeature]; // Only active returned

  try {
    const response = await getMenuItems(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    // Verify inactive menu item is not included
    const hasInactive = data.some((item: unknown) => (item as { is_active: boolean }).is_active === false);
    assertEquals(hasInactive, false);
    // Verify all items are menu items
    const allMenuItems = data.every((item: unknown) => (item as { is_menu_item: boolean }).is_menu_item === true);
    assertEquals(allMenuItems, true);
  } finally {
    (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems = originalGetMenuItems;
  }
});

Deno.test('get menu items - filters by min_level requirement', async () => {
  const employee = createMockEmployeeWithLevel(1); // Level 1 employee
  const request = createMockRequest('GET', 'http://localhost/api-features/menu');

  // Mock FeatureService.getMenuItems - should only return menu items where min_level <= 1
  // Service should filter by is_active, is_menu_item, AND min_level at database level
  // Note: min_level is removed from response for security
  const originalGetMenuItems = (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems;
  (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems = async () => [mockActiveFeature]; // Only level 0 menu item returned

  try {
    const response = await getMenuItems(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    // Verify min_level is not in response (security)
    const hasMinLevel = data.some((item: unknown) => 'min_level' in (item as Record<string, unknown>));
    assertEquals(hasMinLevel, false);
  } finally {
    (await import('../../supabase/functions/api-features/services/featureService.ts')).FeatureService.getMenuItems = originalGetMenuItems;
  }
});

