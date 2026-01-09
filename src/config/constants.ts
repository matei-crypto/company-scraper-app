/**
 * Application-wide constants
 * Centralized configuration for maintainability
 */

// API Rate Limiting
export const RATE_LIMIT_DELAY_MS = 100; // Standard API request delay
export const RATE_LIMIT_DELAY_DOWNLOAD_MS = 200; // Document download delay

// API Pagination
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 5000;
export const DEFAULT_FILING_HISTORY_LIMIT = 25;
export const MAX_FILING_HISTORY_LIMIT = 100;

// Document Types
export const ACCOUNT_DOCUMENT_CATEGORY = 'accounts';
export const ACCOUNT_DOCUMENT_TYPE = 'AA';

// Target SIC Codes (Investment Thesis)
export const TARGET_SIC_CODES = ['62020', '62090'] as const;

// Date Calculations
export const MILLISECONDS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

// Investment Scoring Thresholds
// Thesis Criteria: £500k-£1m EBITDA OR £3m-£6m revenue OR 15-40 employees
export const MIN_EBITDA = 500000; // £500k
export const MAX_EBITDA = 1000000; // £1m
export const MIN_REVENUE = 3000000; // £3m
export const MAX_REVENUE = 6000000; // £6m
export const MIN_EMPLOYEES = 15; // 15 employees
export const MAX_EMPLOYEES = 40; // 40 employees
export const REVENUE_SCORE_DIVISOR = 100000; // £100k per point
export const HEADCOUNT_SCORE_DIVISOR = 5; // 5 employees per point

// Company Status
export const ACTIVE_COMPANY_STATUS = 'active';

// File Extensions
export const PDF_EXTENSION = 'pdf';

