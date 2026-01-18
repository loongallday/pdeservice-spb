/**
 * Error handling utilities for Supabase Edge Functions
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'ไม่ได้รับอนุญาต') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class AuthorizationError extends APIError {
  constructor(message = 'ไม่มีสิทธิ์เข้าถึง') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends APIError {
  constructor(message = 'ไม่พบข้อมูล') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class DatabaseError extends APIError {
  constructor(message = 'เกิดข้อผิดพลาดในการเข้าถึงข้อมูล') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class IdempotencyError extends APIError {
  constructor(
    message: string,
    public idempotencyCode: 'DUPLICATE_KEY_DIFFERENT_PAYLOAD' | 'DUPLICATE_KEY_DIFFERENT_USER' | 'REQUEST_IN_PROGRESS'
  ) {
    super(message, 409, `IDEMPOTENCY_${idempotencyCode}`);
  }
}

/**
 * Handle errors and return appropriate status code, message, and code
 */
export function handleError(err: unknown): { message: string; statusCode: number; code?: string } {
  if (err instanceof APIError) {
    return {
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
    };
  }
  
  if (err instanceof Error) {
    // Check for common Supabase/Postgres errors
    if (err.message.includes('JWT')) {
      return {
        message: 'Session หมดอายุกรุณาเข้าใช้งานใหม่',
        statusCode: 401,
      };
    }
    
    if (err.message.includes('duplicate key')) {
      return {
        message: 'ข้อมูลซ้ำ',
        statusCode: 409,
      };
    }
    
    if (err.message.includes('foreign key') ||
        err.message.includes('violates foreign key constraint') ||
        err.message.includes('is still referenced') ||
        err.message.includes('FK_') ||
        err.message.includes('fkey')) {
      return {
        message: 'มีข้อมูลอ้างอิงที่ใช้งานอยู่ ไม่สามารถลบได้',
        statusCode: 409,
        code: 'FOREIGN_KEY_VIOLATION',
      };
    }

    // Handle null constraint violations
    if (err.message.includes('null value in column') ||
        err.message.includes('violates not-null constraint')) {
      return {
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      };
    }
    
    return {
      message: err.message,
      statusCode: 500,
    };
  }
  
  return {
    message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    statusCode: 500,
  };
}

