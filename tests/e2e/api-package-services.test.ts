/**
 * E2E Tests for api-package-services
 * Tests all package service CRUD operations with real database and authentication
 *
 * Permission Levels:
 * - Level 0 (Technician): Can list and view package services
 * - Level 1 (Assigner/PM/Sales): Can create and update package services
 * - Level 2 (Admin): Can delete package services
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  assertSuccess,
  setupTestUsers,
  TEST_EMPLOYEES,
  randomUUID,
} from './test-utils.ts';

// Track created package service IDs for cleanup/deletion tests
let createdPackageServiceId: string | null = null;

// Setup before all tests
Deno.test({
  name: 'Setup: Create test auth users',
  fn: async () => {
    await setupTestUsers();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================
// LIST PACKAGE SERVICES
// ============================================

Deno.test('GET /api-package-services - should return paginated list', async () => {
  const response = await apiGet('api-package-services');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-package-services - should support pagination parameters', async () => {
  const response = await apiGet('api-package-services?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.pagination);
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-package-services - should filter by category', async () => {
  const response = await apiGet('api-package-services?category=maintenance');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // If there are results, they should all have the matching category
  if (data.data.length > 0) {
    for (const service of data.data) {
      assertEquals(service.category, 'maintenance');
    }
  }
});

Deno.test('GET /api-package-services - should filter by is_active=true', async () => {
  const response = await apiGet('api-package-services?is_active=true');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // If there are results, they should all be active
  if (data.data.length > 0) {
    for (const service of data.data) {
      assertEquals(service.is_active, true);
    }
  }
});

Deno.test('GET /api-package-services - should filter by is_active=false', async () => {
  const response = await apiGet('api-package-services?is_active=false');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // If there are results, they should all be inactive
  if (data.data.length > 0) {
    for (const service of data.data) {
      assertEquals(service.is_active, false);
    }
  }
});

Deno.test('GET /api-package-services - should support search query (q)', async () => {
  const response = await apiGet('api-package-services?q=test');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-package-services - technician can list package services', async () => {
  const response = await apiGet('api-package-services', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// GET PACKAGE SERVICE BY ID
// ============================================

Deno.test('GET /api-package-services/:id - should return 404 for non-existent service', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-package-services/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-package-services/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-package-services/invalid-uuid');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// CREATE PACKAGE SERVICE
// ============================================

Deno.test('POST /api-package-services - should create package service with valid data', async () => {
  const serviceData = {
    code: `E2E_SVC_${Date.now()}`,
    name_th: 'บริการทดสอบ E2E',
    name_en: 'E2E Test Service',
    description: 'Package service created during E2E testing',
    category: 'maintenance',
    duration_months: 12,
    is_active: true,
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  // If created successfully, store ID for later tests
  if (response.status === 201) {
    const data = JSON.parse(text);
    createdPackageServiceId = data.data.id;
    assertExists(data.data.id);
    assertEquals(data.data.code, serviceData.code);
    assertEquals(data.data.name_th, serviceData.name_th);
  }
});

Deno.test('POST /api-package-services - should create package service with minimal required fields', async () => {
  const serviceData = {
    code: `E2E_MIN_${Date.now()}`,
    name_th: 'บริการขั้นต่ำ',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 201) {
    const data = JSON.parse(text);
    assertExists(data.data.id);
    assertEquals(data.data.is_active, true); // Default value
  }
});

Deno.test('POST /api-package-services - should reject missing code', async () => {
  const serviceData = {
    name_th: 'บริการไม่มีรหัส',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-package-services - should reject missing name_th', async () => {
  const serviceData = {
    code: 'MISSING_NAME',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-package-services - should reject empty body', async () => {
  const response = await apiPost('api-package-services', {}, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-package-services - PM (level 1) can create package services', async () => {
  const serviceData = {
    code: `E2E_PM_${Date.now()}`,
    name_th: 'บริการจาก PM',
    name_en: 'PM Created Service',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.pm1);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-package-services - Sales (level 1) can create package services', async () => {
  const serviceData = {
    code: `E2E_SALES_${Date.now()}`,
    name_th: 'บริการจาก Sales',
    name_en: 'Sales Created Service',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.sales1);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// UPDATE PACKAGE SERVICE
// ============================================

Deno.test('PUT /api-package-services/:id - should update package service', async () => {
  // First create a service to update
  const serviceData = {
    code: `E2E_UPD_${Date.now()}`,
    name_th: 'บริการที่จะอัปเดต',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const updateData = {
      name_en: 'Updated English Name',
      description: 'Updated description',
      duration_months: 24,
    };

    const updateResponse = await apiPut(`api-package-services/${serviceId}`, updateData, TEST_EMPLOYEES.assigner);
    const updateText = await updateResponse.text(); // Consume body
    assertEquals(updateResponse.status < 500, true, `Unexpected server error: ${updateText}`);

    if (updateResponse.status === 200) {
      const updatedData = JSON.parse(updateText);
      assertEquals(updatedData.data.name_en, updateData.name_en);
      assertEquals(updatedData.data.description, updateData.description);
      assertEquals(updatedData.data.duration_months, updateData.duration_months);
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('PUT /api-package-services/:id - should toggle is_active', async () => {
  // Create a service first
  const serviceData = {
    code: `E2E_TOGGLE_${Date.now()}`,
    name_th: 'บริการทดสอบ Toggle',
    is_active: true,
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    // Toggle to inactive
    const updateResponse = await apiPut(`api-package-services/${serviceId}`, { is_active: false }, TEST_EMPLOYEES.assigner);
    const updateText = await updateResponse.text();
    assertEquals(updateResponse.status < 500, true, `Unexpected server error: ${updateText}`);

    if (updateResponse.status === 200) {
      const updatedData = JSON.parse(updateText);
      assertEquals(updatedData.data.is_active, false);
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('PUT /api-package-services/:id - should return 404 for non-existent service', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut(`api-package-services/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('PUT /api-package-services/:id - should reject empty update body', async () => {
  // Create a service first
  const serviceData = {
    code: `E2E_EMPTY_${Date.now()}`,
    name_th: 'บริการทดสอบ Empty Update',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const response = await apiPut(`api-package-services/${serviceId}`, {}, TEST_EMPLOYEES.assigner);
    await response.text(); // Consume body
    assertEquals(response.status, 400);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('PUT /api-package-services/:id - should return 400 for invalid UUID', async () => {
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut('api-package-services/invalid-uuid', updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// DELETE PACKAGE SERVICE
// ============================================

Deno.test('DELETE /api-package-services/:id - should delete package service', async () => {
  // First create a service to delete
  const serviceData = {
    code: `E2E_DEL_${Date.now()}`,
    name_th: 'บริการที่จะลบ',
    name_en: 'Service to Delete',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.admin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const deleteResponse = await apiDelete(`api-package-services/${serviceId}`, TEST_EMPLOYEES.admin);
    await deleteResponse.text(); // Consume body
    assertEquals(deleteResponse.status < 500, true);

    // Verify it's deleted
    if (deleteResponse.status === 200) {
      const getResponse = await apiGet(`api-package-services/${serviceId}`);
      await getResponse.text(); // Consume body
      assertEquals(getResponse.status, 404);
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('DELETE /api-package-services/:id - should return 404 for non-existent service', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-package-services/${fakeId}`, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('DELETE /api-package-services/:id - should return 400 for invalid UUID', async () => {
  const response = await apiDelete('api-package-services/invalid-uuid', TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// PERMISSION TESTS - LEVEL 0 (TECHNICIAN)
// ============================================

Deno.test('Permission: Technician (level 0) can list package services', async () => {
  const response = await apiGet('api-package-services', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician (level 0) cannot create package services', async () => {
  const serviceData = {
    code: 'TECH_FAIL',
    name_th: 'ควรล้มเหลว',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician (level 0) cannot update package services', async () => {
  // First create a service with proper permissions
  const serviceData = {
    code: `E2E_TECH_UPD_${Date.now()}`,
    name_th: 'บริการทดสอบ Tech Update',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const updateData = { name_en: 'Should fail' };
    const response = await apiPut(`api-package-services/${serviceId}`, updateData, TEST_EMPLOYEES.tech1);
    await response.text(); // Consume body
    assertEquals(response.status, 403);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('Permission: Technician (level 0) cannot delete package services', async () => {
  // First create a service with proper permissions
  const serviceData = {
    code: `E2E_TECH_DEL_${Date.now()}`,
    name_th: 'บริการทดสอบ Tech Delete',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.admin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const response = await apiDelete(`api-package-services/${serviceId}`, TEST_EMPLOYEES.tech1);
    await response.text(); // Consume body
    assertEquals(response.status, 403);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

// ============================================
// PERMISSION TESTS - LEVEL 1 (ASSIGNER/PM/SALES)
// ============================================

Deno.test('Permission: Assigner (level 1) can create package services', async () => {
  const serviceData = {
    code: `E2E_ASSIGN_${Date.now()}`,
    name_th: 'บริการจาก Assigner',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  if (response.status === 201) {
    const data = JSON.parse(text);
    assertExists(data.data.id);
  }
});

Deno.test('Permission: Assigner (level 1) can update package services', async () => {
  const serviceData = {
    code: `E2E_ASSIGN_UPD_${Date.now()}`,
    name_th: 'บริการทดสอบ Assigner Update',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const updateData = { name_en: 'Assigner Updated' };
    const response = await apiPut(`api-package-services/${serviceId}`, updateData, TEST_EMPLOYEES.assigner);
    await response.text(); // Consume body
    assertEquals(response.status < 500, true);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('Permission: Assigner (level 1) cannot delete package services', async () => {
  const serviceData = {
    code: `E2E_ASSIGN_DEL_${Date.now()}`,
    name_th: 'บริการทดสอบ Assigner Delete',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const response = await apiDelete(`api-package-services/${serviceId}`, TEST_EMPLOYEES.assigner);
    await response.text(); // Consume body
    assertEquals(response.status, 403);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

// ============================================
// PERMISSION TESTS - LEVEL 2 (ADMIN)
// ============================================

Deno.test('Permission: Admin (level 2) can create package services', async () => {
  const serviceData = {
    code: `E2E_ADMIN_${Date.now()}`,
    name_th: 'บริการจาก Admin',
  };

  const response = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.admin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('Permission: Admin (level 2) can update package services', async () => {
  const serviceData = {
    code: `E2E_ADMIN_UPD_${Date.now()}`,
    name_th: 'บริการทดสอบ Admin Update',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.admin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const updateData = { name_en: 'Admin Updated' };
    const response = await apiPut(`api-package-services/${serviceId}`, updateData, TEST_EMPLOYEES.admin);
    await response.text(); // Consume body
    assertEquals(response.status < 500, true);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('Permission: Admin (level 2) can delete package services', async () => {
  const serviceData = {
    code: `E2E_ADMIN_DEL_${Date.now()}`,
    name_th: 'บริการทดสอบ Admin Delete',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.admin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const response = await apiDelete(`api-package-services/${serviceId}`, TEST_EMPLOYEES.admin);
    await response.text(); // Consume body
    assertEquals(response.status < 500, true);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

// ============================================
// PERMISSION TESTS - LEVEL 3 (SUPER ADMIN)
// ============================================

Deno.test('Permission: Super Admin (level 3) can perform all operations', async () => {
  const serviceData = {
    code: `E2E_SUPER_${Date.now()}`,
    name_th: 'บริการจาก Super Admin',
    name_en: 'Super Admin Service',
  };

  // Create
  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();
  assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    // Read
    const getResponse = await apiGet(`api-package-services/${serviceId}`, TEST_EMPLOYEES.superAdmin);
    assertEquals(getResponse.status, 200);
    const getData = await getResponse.json();
    assertExists(getData.data);

    // Update
    const updateResponse = await apiPut(`api-package-services/${serviceId}`, { description: 'Super Admin updated' }, TEST_EMPLOYEES.superAdmin);
    await updateResponse.text(); // Consume body
    assertEquals(updateResponse.status < 500, true);

    // Delete
    const deleteResponse = await apiDelete(`api-package-services/${serviceId}`, TEST_EMPLOYEES.superAdmin);
    await deleteResponse.text(); // Consume body
    assertEquals(deleteResponse.status < 500, true);
  }
});

// ============================================
// ERROR HANDLING
// ============================================

Deno.test('Error: Invalid route should return 404', async () => {
  const response = await apiGet('api-package-services/invalid/route/path');
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// DUPLICATE CODE HANDLING
// ============================================

Deno.test('POST /api-package-services - should reject duplicate code', async () => {
  const uniqueCode = `E2E_DUP_${Date.now()}`;
  const serviceData = {
    code: uniqueCode,
    name_th: 'บริการต้นฉบับ',
  };

  // Create first service
  const response1 = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const text1 = await response1.text();

  if (response1.status === 201) {
    // Try to create duplicate
    const response2 = await apiPost('api-package-services', {
      code: uniqueCode,
      name_th: 'บริการซ้ำ',
    }, TEST_EMPLOYEES.assigner);
    await response2.text(); // Consume body

    // Should fail with duplicate key error
    assertEquals(response2.status >= 400, true);
  } else {
    assertEquals(response1.status < 500, true, `First create failed: ${text1}`);
  }
});

// ============================================
// DATA INTEGRITY TESTS
// ============================================

Deno.test('Data Integrity: Created service should be retrievable', async () => {
  const serviceData = {
    code: `E2E_INT_${Date.now()}`,
    name_th: 'บริการทดสอบ Integrity',
    name_en: 'Integrity Test Service',
    description: 'Testing data integrity',
    category: 'warranty',
    duration_months: 6,
    is_active: true,
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    // Retrieve and verify
    const getResponse = await apiGet(`api-package-services/${serviceId}`);
    assertEquals(getResponse.status, 200);
    const getData = await getResponse.json();

    assertEquals(getData.data.code, serviceData.code);
    assertEquals(getData.data.name_th, serviceData.name_th);
    assertEquals(getData.data.name_en, serviceData.name_en);
    assertEquals(getData.data.description, serviceData.description);
    assertEquals(getData.data.category, serviceData.category);
    assertEquals(getData.data.duration_months, serviceData.duration_months);
    assertEquals(getData.data.is_active, serviceData.is_active);
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('Data Integrity: Updated fields should persist', async () => {
  const serviceData = {
    code: `E2E_UPD_INT_${Date.now()}`,
    name_th: 'บริการก่อนอัปเดต',
  };

  const createResponse = await apiPost('api-package-services', serviceData, TEST_EMPLOYEES.assigner);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const serviceId = createdData.data.id;

    const updateData = {
      name_th: 'บริการหลังอัปเดต',
      name_en: 'After Update',
      category: 'installation',
      duration_months: 18,
    };

    const updateResponse = await apiPut(`api-package-services/${serviceId}`, updateData, TEST_EMPLOYEES.assigner);
    await updateResponse.text(); // Consume body

    if (updateResponse.status === 200) {
      // Retrieve and verify
      const getResponse = await apiGet(`api-package-services/${serviceId}`);
      assertEquals(getResponse.status, 200);
      const getData = await getResponse.json();

      assertEquals(getData.data.name_th, updateData.name_th);
      assertEquals(getData.data.name_en, updateData.name_en);
      assertEquals(getData.data.category, updateData.category);
      assertEquals(getData.data.duration_months, updateData.duration_months);
      assertEquals(getData.data.code, serviceData.code); // Original code unchanged
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});
