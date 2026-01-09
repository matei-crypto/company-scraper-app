# Codebase Refactoring Plan

## Overview
This document outlines recommended improvements to refactor and clean up the codebase. The improvements are organized by priority and impact.

---

## 🔴 High Priority - Code Quality & Maintainability

### 1. Extract Constants and Configuration
**Problem**: Magic numbers and hardcoded strings scattered throughout the codebase.

**Solution**: Create a centralized configuration file.

**Files to create**:
- `src/config/constants.ts` - Application constants
- `src/config/api.ts` - API-specific configuration

**Constants to extract**:
```typescript
// Rate limiting
RATE_LIMIT_DELAY_MS = 100
RATE_LIMIT_DELAY_DOWNLOAD_MS = 200

// API pagination
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 5000
DEFAULT_FILING_HISTORY_LIMIT = 25
MAX_FILING_HISTORY_LIMIT = 100

// Document types
ACCOUNT_DOCUMENT_CATEGORY = 'accounts'
ACCOUNT_DOCUMENT_TYPE = 'AA'

// Target SIC codes
TARGET_SIC_CODES = ['62020', '62090']

// Date calculations
MILLISECONDS_PER_YEAR = 1000 * 60 * 60 * 24 * 365

// Investment scoring thresholds
MIN_EBITDA = 400000
MAX_EBITDA = 1200000
REVENUE_SCORE_DIVISOR = 100000
HEADCOUNT_SCORE_DIVISOR = 5
```

**Impact**: 
- ✅ Easier to maintain and update
- ✅ Reduces risk of inconsistencies
- ✅ Better testability

---

### 2. Create Array Normalization Utility
**Problem**: Array normalization logic (`Array.isArray` checks) is duplicated 18+ times across the codebase.

**Solution**: Create a utility function for safe array normalization.

**File to create**: `src/utils/arrayHelpers.ts`

```typescript
/**
 * Safely normalize a value to an array
 * Handles: arrays, objects, null, undefined
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
 * Normalize object values to array (for API responses that return objects with numeric keys)
 */
export function objectValuesToArray<T>(obj: Record<string, T> | T[] | null | undefined): T[] {
  if (Array.isArray(obj)) {
    return obj;
  }
  if (obj && typeof obj === 'object') {
    return Object.values(obj).filter((v): v is T => v !== null && v !== undefined);
  }
  return [];
}
```

**Usage example**:
```typescript
// Before
const sicCodes = Array.isArray(apiData.sic_codes) 
  ? apiData.sic_codes 
  : (typeof apiData.sic_codes === 'object' 
      ? Object.values(apiData.sic_codes).filter((v): v is string => typeof v === 'string')
      : []);

// After
const sicCodes = objectValuesToArray<string>(apiData.sic_codes);
```

**Impact**:
- ✅ Reduces code duplication by ~200 lines
- ✅ Consistent array handling
- ✅ Easier to test edge cases

---

### 3. Extract Document Filtering Logic
**Problem**: Account document filtering logic is duplicated in `downloadDocuments.ts` and `syncDocuments.ts`.

**Solution**: Create a shared utility function.

**File to update**: `src/utils/fileSystem.ts` (or create `src/utils/documentHelpers.ts`)

```typescript
/**
 * Filter filing history items for account documents
 */
export function filterAccountDocuments(filings: any[]): any[] {
  return filings.filter(
    (filing: any) => 
      filing.category === ACCOUNT_DOCUMENT_CATEGORY && 
      filing.type === ACCOUNT_DOCUMENT_TYPE && 
      filing.transaction_id
  );
}
```

**Impact**:
- ✅ Single source of truth for document filtering
- ✅ Easier to update if criteria change

---

### 4. Improve Type Safety
**Problem**: Heavy use of `any` types, especially in `transformToCompany` method.

**Solution**: Create TypeScript interfaces for API responses.

**File to create**: `src/types/companiesHouseApi.ts`

```typescript
export interface CompaniesHouseCompanyProfile {
  company_name: string;
  company_number: string;
  company_status: string;
  sic_codes?: string[] | Record<string, string>;
  date_of_creation: string;
  // ... other fields
}

export interface CompaniesHouseOfficersResponse {
  items: CompaniesHouseOfficer[];
  total_count: number;
}

export interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  // ... other fields
}

// ... more interfaces
```

**Impact**:
- ✅ Better IDE autocomplete
- ✅ Compile-time error checking
- ✅ Self-documenting code

---

### 5. Split Large Methods
**Problem**: `transformToCompany` method is 240+ lines and handles too many responsibilities.

**Solution**: Break into smaller, focused methods.

**Refactoring**:
```typescript
// Split into:
- transformBasicCompanyInfo()
- transformSicCodes()
- transformAddress()
- transformAccounts()
- transformOfficers()
- transformPSCs()
- transformCharges()
- transformInsolvency()
- transformFilingHistory()
- transformPreviousNames()
```

**Impact**:
- ✅ Easier to test individual transformations
- ✅ Better code organization
- ✅ Easier to maintain

---

## 🟡 Medium Priority - Code Organization

### 6. Create Shared Error Handling Utilities
**Problem**: Inconsistent error handling patterns across files.

**Solution**: Create error handling utilities.

**File to create**: `src/utils/errorHandling.ts`

```typescript
export class CompaniesHouseError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiResponse?: any
  ) {
    super(message);
    this.name = 'CompaniesHouseError';
  }
}

export function handleApiError(error: any): never {
  if (error.response) {
    throw new CompaniesHouseError(
      `API error: ${error.response.status} - ${error.response.statusText}`,
      error.response.status,
      error.response.data
    );
  }
  throw error;
}
```

**Impact**:
- ✅ Consistent error handling
- ✅ Better error messages
- ✅ Easier debugging

---

### 7. Extract Date Calculation Utilities
**Problem**: Date calculations (years active) are duplicated in multiple files.

**Solution**: Create date utility functions.

**File to create**: `src/utils/dateHelpers.ts`

```typescript
export function calculateYearsActive(incorporationDate: string | Date): number {
  const date = typeof incorporationDate === 'string' 
    ? new Date(incorporationDate) 
    : incorporationDate;
  const now = Date.now();
  const diff = now - date.getTime();
  return diff / MILLISECONDS_PER_YEAR;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}
```

**Impact**:
- ✅ Consistent date handling
- ✅ Single source of truth

---

### 8. Create Document Path Builder
**Problem**: Document path construction is duplicated.

**Solution**: Centralize path building logic.

**File to update**: `src/utils/fileSystem.ts`

```typescript
export function buildDocumentPath(
  companyNumber: string, 
  transactionId: string, 
  extension: string = 'pdf'
): string {
  return `data/companies/${companyNumber}/documents/${transactionId}.${extension}`;
}
```

**Impact**:
- ✅ Consistent path format
- ✅ Easier to change structure later

---

### 9. Extract CLI Entry Point Pattern
**Problem**: Similar CLI entry point code duplicated across multiple files.

**Solution**: Create a shared CLI utility.

**File to create**: `src/utils/cli.ts`

```typescript
export function isCliEntryPoint(scriptName: string): boolean {
  return import.meta.url.endsWith(process.argv[1]) || 
         process.argv[1]?.includes(scriptName);
}

export function handleCliError(error: unknown): never {
  console.error(chalk.red('\n✗ Fatal error:'), error);
  process.exit(1);
}
```

**Impact**:
- ✅ Consistent CLI handling
- ✅ Less boilerplate

---

## 🟢 Low Priority - Nice to Have

### 10. Add JSDoc Comments
**Problem**: Some functions lack documentation.

**Solution**: Add comprehensive JSDoc comments to all public functions.

**Impact**:
- ✅ Better IDE support
- ✅ Self-documenting code
- ✅ Easier onboarding

---

### 11. Create Rate Limiting Utility
**Problem**: Rate limiting delays are hardcoded throughout.

**Solution**: Create a rate limiter class.

**File to create**: `src/utils/rateLimiter.ts`

```typescript
export class RateLimiter {
  private lastRequestTime = 0;
  
  constructor(private delayMs: number) {}
  
  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.delayMs) {
      await new Promise(resolve => 
        setTimeout(resolve, this.delayMs - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }
}
```

**Impact**:
- ✅ More accurate rate limiting
- ✅ Configurable delays
- ✅ Better API usage

---

### 12. Add Validation Helpers
**Problem**: Validation logic is mixed with transformation logic.

**Solution**: Extract validation helpers.

**File to create**: `src/utils/validationHelpers.ts`

```typescript
export function hasRequiredFields(data: any, fields: string[]): boolean {
  return fields.every(field => data[field] !== undefined && data[field] !== null);
}

export function isValidCompanyNumber(companyNumber: string): boolean {
  return /^(SC)?[0-9]{6,8}$/.test(companyNumber);
}
```

**Impact**:
- ✅ Reusable validation
- ✅ Better error messages

---

## 📊 Implementation Priority

### Phase 1 (Quick Wins - 2-3 hours)
1. ✅ Extract constants (1)
2. ✅ Create array normalization utility (2)
3. ✅ Extract document filtering (3)

### Phase 2 (Medium Effort - 4-6 hours)
4. ✅ Improve type safety (4)
5. ✅ Split large methods (5)
6. ✅ Extract date utilities (7)

### Phase 3 (Longer Term - 6-8 hours)
7. ✅ Error handling utilities (6)
8. ✅ Rate limiting utility (11)
9. ✅ Add comprehensive JSDoc (10)

---

## 🧪 Testing Recommendations

After refactoring, add tests for:
- Array normalization utilities
- Date calculation utilities
- Document filtering logic
- Error handling utilities

---

## 📝 Notes

- All refactoring should maintain backward compatibility
- Run existing tests after each refactoring phase
- Consider using a feature flag approach for large changes
- Document breaking changes in CHANGELOG.md

