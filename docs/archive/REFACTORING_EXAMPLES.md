# Refactoring Examples - Before & After

This document shows concrete examples of the refactoring improvements.

## Example 1: Using Constants Instead of Magic Numbers

### Before
```typescript
// In downloadDocuments.ts
const filingHistory = await scraper.getCompanyFilingHistory(companyNumber, 100);
await new Promise(resolve => setTimeout(resolve, 200));
```

### After
```typescript
// In downloadDocuments.ts
import { MAX_FILING_HISTORY_LIMIT, RATE_LIMIT_DELAY_DOWNLOAD_MS } from '../config/constants.js';

const filingHistory = await scraper.getCompanyFilingHistory(companyNumber, MAX_FILING_HISTORY_LIMIT);
await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_DOWNLOAD_MS));
```

**Benefits**:
- ✅ Single source of truth
- ✅ Easy to update globally
- ✅ Self-documenting code

---

## Example 2: Using Document Filtering Utility

### Before
```typescript
// In downloadDocuments.ts
const accountFilings = filingHistory.items.filter((filing: any) => 
  filing.category === 'accounts' && filing.type === 'AA' && filing.transaction_id
);

// In syncDocuments.ts (duplicated)
const accountFilings = filingHistory.items.filter((filing: any) => 
  filing.category === 'accounts' && filing.type === 'AA' && filing.transaction_id
);
```

### After
```typescript
// In both files
import { filterAccountDocuments } from './documentHelpers.js';

const accountFilings = filterAccountDocuments(filingHistory.items);
```

**Benefits**:
- ✅ Single source of truth
- ✅ Consistent filtering logic
- ✅ Easier to update criteria

---

## Example 3: Array Normalization (Future Refactoring)

### Before
```typescript
// In companiesHouse.ts (repeated 18+ times)
const sicCodes: string[] = [];
if (apiData.sic_codes) {
  if (Array.isArray(apiData.sic_codes)) {
    sicCodes.push(...apiData.sic_codes);
  } else if (typeof apiData.sic_codes === 'object') {
    sicCodes.push(...Object.values(apiData.sic_codes).filter((v): v is string => typeof v === 'string'));
  }
}
```

### After
```typescript
import { objectValuesToArray } from '../utils/arrayHelpers.js';

const sicCodes = objectValuesToArray<string>(apiData.sic_codes);
```

**Benefits**:
- ✅ Reduces 5+ lines to 1 line
- ✅ Consistent handling across codebase
- ✅ Easier to test edge cases

---

## Implementation Status

### ✅ Completed
- [x] Created `src/config/constants.ts` with all magic numbers
- [x] Created `src/utils/arrayHelpers.ts` with normalization utilities
- [x] Created `src/utils/documentHelpers.ts` with document filtering
- [x] Updated `downloadDocuments.ts` to use new utilities
- [x] Updated `syncDocuments.ts` to use new utilities

### 🔄 Next Steps (Recommended)
- [ ] Update `companiesHouse.ts` to use array normalization utilities
- [ ] Update `companiesHouse.ts` to use constants
- [ ] Create date calculation utilities
- [ ] Split `transformToCompany` into smaller methods
- [ ] Add TypeScript interfaces for API responses

---

## Impact Summary

**Lines Reduced**: ~15-20 lines of duplicated code eliminated  
**Maintainability**: Significantly improved (single source of truth)  
**Type Safety**: Ready for improvement (utilities created)  
**Consistency**: Improved (shared utilities ensure consistent behavior)

