/**
 * Shared constants for Edge Functions
 */

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// Role levels (matching current database)
export const ROLE_LEVELS = {
  TECHNICIAN_L1: 0,
  STANDARD: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error messages (Thai)
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'ไม่ได้รับอนุญาต',
  FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึง',
  NOT_FOUND: 'ไม่พบข้อมูล',
  VALIDATION_ERROR: 'ข้อมูลไม่ถูกต้อง',
  DATABASE_ERROR: 'เกิดข้อผิดพลาดในการเข้าถึงข้อมูล',
  INTERNAL_ERROR: 'เกิดข้อผิดพลาดภายในระบบ',
} as const;

