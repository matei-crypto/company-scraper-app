/**
 * Date calculation and formatting utilities
 */

import { MILLISECONDS_PER_YEAR } from '../config/constants.js';

/**
 * Calculate years active from incorporation date
 * 
 * @param incorporationDate - Date string (YYYY-MM-DD) or Date object
 * @returns Number of years active (can be fractional)
 * 
 * @example
 * calculateYearsActive('2020-01-01') // ~4 years
 * calculateYearsActive(new Date('2020-01-01')) // ~4 years
 */
export function calculateYearsActive(incorporationDate: string | Date): number {
  const date = typeof incorporationDate === 'string' 
    ? new Date(incorporationDate) 
    : incorporationDate;
  const now = Date.now();
  const diff = now - date.getTime();
  return diff / MILLISECONDS_PER_YEAR;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 * 
 * @param date - Date string or Date object
 * @returns Formatted date string (YYYY-MM-DD)
 * 
 * @example
 * formatDate('2020-01-01T00:00:00Z') // '2020-01-01'
 * formatDate(new Date()) // '2024-01-15'
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Calculate time difference in years between two dates
 * 
 * @param startDate - Start date (string or Date)
 * @param endDate - End date (string or Date, defaults to now)
 * @returns Number of years between dates
 */
export function yearsBetween(startDate: string | Date, endDate: string | Date = new Date()): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diff = end.getTime() - start.getTime();
  return diff / MILLISECONDS_PER_YEAR;
}

