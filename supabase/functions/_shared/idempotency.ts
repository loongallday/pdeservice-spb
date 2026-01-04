/**
 * Idempotency service - Prevents duplicate operations
 */

import { createServiceClient } from './supabase.ts';
import { DatabaseError, ValidationError } from './error.ts';

export interface IdempotencyResult {
  isNew: boolean;
  responseData?: unknown;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * Check if an idempotency key has been used before
 * If it has, return the previous response
 * If not, mark it as in-progress
 */
export async function checkIdempotencyKey(
  idempotencyKey: string,
  operationType: string,
  employeeId: string,
  requestPayload: Record<string, unknown>
): Promise<IdempotencyResult> {
  const supabase = createServiceClient();

  // Check if key exists
  const { data: existing, error: checkError } = await supabase
    .from('sys_idempotency_keys')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .eq('operation_type', operationType)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle not found gracefully

  if (checkError) {
    // Log the actual error for debugging
    console.error('[idempotency] Error checking key:', {
      code: checkError.code,
      message: checkError.message,
      details: checkError.details,
      hint: checkError.hint,
    });
    throw new DatabaseError(`ไม่สามารถตรวจสอบ idempotency key ได้: ${checkError.message}`);
  }

  if (existing) {
    // Key exists - check if it's from the same user
    if (existing.employee_id !== employeeId) {
      throw new ValidationError('Idempotency key นี้ถูกใช้โดยพนักงานคนอื่นแล้ว');
    }

    // Check if request payload matches (to detect misuse of same key for different requests)
    const existingPayload = JSON.stringify(existing.request_payload);
    const newPayload = JSON.stringify(requestPayload);
    if (existingPayload !== newPayload) {
      throw new ValidationError('Idempotency key นี้ถูกใช้กับข้อมูลที่แตกต่างกันแล้ว');
    }

    // Check if expired
    if (new Date(existing.expires_at) < new Date()) {
      // Expired - delete and allow new request
      await supabase
        .from('sys_idempotency_keys')
        .delete()
        .eq('id', existing.id);

      return { isNew: true };
    }

    // If operation is completed, return the cached response
    if (existing.is_completed) {
      return {
        isNew: false,
        responseData: existing.response_data,
        statusCode: existing.status_code || 200,
      };
    }

    // If operation failed, return the cached error
    if (existing.is_failed) {
      return {
        isNew: false,
        errorMessage: existing.error_message || 'การดำเนินการล้มเหลว',
        statusCode: existing.status_code || 500,
      };
    }

    // Operation is in progress - this is a concurrent duplicate request
    // Return a "processing" response
    throw new ValidationError('คำขอกำลังดำเนินการอยู่ กรุณารอสักครู่');
  }

  // Key doesn't exist - create a new in-progress entry
  const { error: createError } = await supabase
    .from('sys_idempotency_keys')
    .insert({
      idempotency_key: idempotencyKey,
      operation_type: operationType,
      employee_id: employeeId,
      request_payload: requestPayload,
      is_completed: false,
      is_failed: false,
    });

  if (createError) {
    // Handle race condition - another request might have created it concurrently
    if (createError.message.includes('duplicate key') || createError.message.includes('unique')) {
      // Retry the check
      return await checkIdempotencyKey(idempotencyKey, operationType, employeeId, requestPayload);
    }
    throw new DatabaseError('ไม่สามารถสร้าง idempotency key ได้');
  }

  return { isNew: true };
}

/**
 * Save the successful response for an idempotency key
 */
export async function saveIdempotencyResponse(
  idempotencyKey: string,
  operationType: string,
  responseData: unknown,
  statusCode = 200
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('sys_idempotency_keys')
    .update({
      response_data: responseData,
      status_code: statusCode,
      is_completed: true,
    })
    .eq('idempotency_key', idempotencyKey)
    .eq('operation_type', operationType);

  if (error) {
    console.error('[idempotency] Failed to save response:', error);
    // Don't throw - this is not critical, the operation already succeeded
  }
}

/**
 * Save the failed response for an idempotency key
 */
export async function saveIdempotencyError(
  idempotencyKey: string,
  operationType: string,
  errorMessage: string,
  statusCode = 500
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('sys_idempotency_keys')
    .update({
      error_message: errorMessage,
      status_code: statusCode,
      is_failed: true,
    })
    .eq('idempotency_key', idempotencyKey)
    .eq('operation_type', operationType);

  if (error) {
    console.error('[idempotency] Failed to save error:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Extract idempotency key from request headers
 * Returns null if not provided
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key');
}

