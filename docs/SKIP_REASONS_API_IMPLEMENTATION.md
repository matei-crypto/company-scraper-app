# Skip Reasons - API Implementation Status

## Summary

**2 out of 5 skip reasons are implemented as API filters.** The other 3 are client-side validation issues that cannot be filtered via the API.

## Implemented in API Request ✅

### 1. **Not Active** ✅
- **API Filter**: `companyStatus: ['active']`
- **Location**: Line 564 in `companiesHouse.ts`
- **Status**: ✅ Fully implemented
- **Note**: We still do a safety check (lines 603-607, 620-624) but this should rarely trigger

### 2. **Wrong SIC Code** ✅
- **API Filter**: `sicCodes: ['62020', '62090']`
- **Location**: Line 563 in `companiesHouse.ts`
- **Status**: ✅ Fully implemented
- **Note**: We still verify SIC codes (lines 626-650) but this should rarely trigger

## NOT Implemented in API (Client-Side Only) ❌

### 3. **Duplicate** ❌
- **Why Not**: This is session-based deduplication (same company appearing multiple times in results)
- **Location**: Lines 595-600 in `companiesHouse.ts`
- **Status**: Cannot be API-filtered (client-side logic)
- **Note**: This prevents processing the same company multiple times within a single scraping session

### 4. **Missing Required Fields** ❌
- **Why Not**: Data quality issue - API may return incomplete data
- **Location**: Lines 682-687 in `companiesHouse.ts`
- **Status**: Cannot be API-filtered (data validation)
- **Note**: We check for `company_name`, `company_number`, `date_of_incorporation`

### 5. **Validation Failed** ❌
- **Why Not**: Schema validation - ensures data matches our Zod schema
- **Location**: Lines 690-699 in `companiesHouse.ts`
- **Status**: Cannot be API-filtered (schema validation)
- **Note**: This ensures no "dirty data" enters our database

## Current API Request

```typescript
await this.advancedSearchCompanies({
  sicCodes: ['62020', '62090'],           // ✅ Filters wrong SIC codes
  companyStatus: ['active'],               // ✅ Filters inactive companies
  companyNameIncludes: '...',              // Optional refinement
  incorporatedFrom: '...',                 // Optional date filter
  incorporatedTo: '...',                   // Optional date filter
  size: 100,
  startIndex: 0,
});
```

## Redundant Safety Checks

We still perform client-side checks for the API-filtered criteria as a safety measure:

1. **Status Check** (lines 603-607, 620-624)
   - Should rarely trigger since API filters by `companyStatus: ['active']`
   - Kept for data integrity in case API returns stale data

2. **SIC Code Verification** (lines 626-650)
   - Should rarely trigger since API filters by `sicCodes`
   - Kept to handle edge cases where API might return partial matches

## Expected Skip Rate After API Filtering

With API filtering implemented:
- **Not Active**: Should be ~0% (API filters this)
- **Wrong SIC Code**: Should be ~0% (API filters this)
- **Duplicate**: Still possible (client-side deduplication)
- **Missing Fields**: Still possible (data quality issues)
- **Validation Failed**: Still possible (schema validation)

## Why Keep Safety Checks?

Even though the API filters by status and SIC codes, we keep the safety checks because:
1. **Data Integrity**: API might return stale or inconsistent data
2. **Edge Cases**: API might return partial matches or edge cases
3. **Defensive Programming**: Better to verify than assume
4. **Transparency**: Skip reasons help us understand data quality

## Recommendations

The current implementation is optimal:
- ✅ Main filters (status, SIC codes) are implemented in API
- ✅ Safety checks remain for data integrity
- ✅ Client-side validation for data quality issues
- ✅ Clear skip reason tracking for transparency

No changes needed - the architecture is correct!

