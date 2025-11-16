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

/**
 * Handle errors and return appropriate status code and message
 */
export function handleError(err: unknown): { message: string; statusCode: number } {
  if (err instanceof APIError) {
    return {
      message: err.message,
      statusCode: err.statusCode,
    };
  }
  
  if (err instanceof Error) {
    // Check for common Supabase/Postgres errors
    if (err.message.includes('JWT')) {
      return {
        message: 'รหัสยืนยันตัวตนไม่ถูกต้อง',
        statusCode: 401,
      };
    }
    
    if (err.message.includes('duplicate key')) {
      return {
        message: 'ข้อมูลซ้ำ',
        statusCode: 409,
      };
    }
    
    if (err.message.includes('foreign key')) {
      return {
        message: 'ไม่สามารถลบข้อมูลที่มีการใช้งานอยู่',
        statusCode: 409,
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

