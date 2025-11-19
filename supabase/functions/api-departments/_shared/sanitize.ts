/**
 * Data sanitization utilities
 * Used to filter out invalid fields before database operations
 */

/**
 * Sanitize data by keeping only valid fields
 * @param data - The data object to sanitize
 * @param validFields - Array of valid field names
 * @returns Sanitized data object containing only valid fields
 */
export function sanitizeData(
  data: Record<string, unknown>,
  validFields: string[]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const field of validFields) {
    if (field in data) {
      sanitized[field] = data[field];
    }
  }

  return sanitized;
}

/**
 * Get valid fields for a table by removing auto-generated and invalid fields
 * @param allFields - All possible fields for the table
 * @param excludeFields - Fields to exclude (auto-generated, deprecated, etc.)
 * @returns Array of valid fields
 */
export function getValidFields(
  allFields: string[],
  excludeFields: string[] = ['id', 'created_at', 'updated_at']
): string[] {
  return allFields.filter(field => !excludeFields.includes(field));
}






