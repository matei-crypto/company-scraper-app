/**
 * Array normalization utilities
 * Handles inconsistent API responses that may return arrays, objects, or single values
 */

/**
 * Safely normalize a value to an array
 * Handles: arrays, objects, null, undefined, single values
 * 
 * @param value - Value to normalize (can be array, single value, null, or undefined)
 * @returns Array of values (empty array if value is null/undefined)
 * 
 * @example
 * toArray([1, 2, 3]) // [1, 2, 3]
 * toArray(1) // [1]
 * toArray(null) // []
 * toArray(undefined) // []
 */
export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

/**
 * Normalize object values to array
 * Handles API responses that return objects with numeric keys instead of arrays
 * 
 * @param obj - Object with values, array, null, or undefined
 * @returns Array of values (empty array if obj is null/undefined)
 * 
 * @example
 * objectValuesToArray({0: 'a', 1: 'b'}) // ['a', 'b']
 * objectValuesToArray(['a', 'b']) // ['a', 'b']
 * objectValuesToArray(null) // []
 */
export function objectValuesToArray<T>(
  obj: Record<string, T> | T[] | null | undefined
): T[] {
  if (Array.isArray(obj)) {
    return obj;
  }
  if (obj && typeof obj === 'object') {
    return Object.values(obj).filter(
      (v): v is T => v !== null && v !== undefined
    );
  }
  return [];
}

/**
 * Normalize array with type filtering
 * Filters out invalid values and ensures type safety
 * 
 * @param value - Value to normalize
 * @param typeGuard - Function to validate type
 * @returns Array of validated values
 * 
 * @example
 * normalizeArrayWithFilter(
 *   apiData.sic_codes,
 *   (v): v is string => typeof v === 'string'
 * )
 */
export function normalizeArrayWithFilter<T>(
  value: unknown,
  typeGuard: (v: unknown) => v is T
): T[] {
  const array = toArray(value);
  return array.filter(typeGuard);
}

