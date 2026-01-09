# Why Companies Are Skipped

The scraper filters companies at multiple stages. Here's why companies get skipped:

## Skip Reasons

### 1. **Not Active** ✅ API-Filtered
- **Reason**: Company status is not "active"
- **When**: ✅ Filtered in API request (`companyStatus: ['active']`), also checked in results as safety
- **Why**: We only want active companies for acquisition targets
- **Example**: Companies that are dissolved, in liquidation, or dormant
- **Note**: Should rarely occur now since API filters by status

### 2. **Wrong SIC Code** ✅ API-Filtered
- **Reason**: Company doesn't have SIC codes 62020 or 62090
- **When**: ✅ Filtered in API request (`sicCodes: ['62020', '62090']`), also verified in profile as safety
- **Why**: Our thesis targets IT consultancy/services (SIC 62020/62090)
- **Example**: Companies with SIC codes like 62012, 63110, etc.
- **Note**: Should rarely occur now since API filters by SIC codes

### 3. **Missing Required Fields**
- **Reason**: Missing critical data (company_name, company_number, or date_of_incorporation)
- **When**: After transformation, before validation
- **Why**: These fields are required for our schema
- **Example**: Incomplete API data

### 4. **Validation Failed**
- **Reason**: Data doesn't match our Zod schema
- **When**: After transformation, during schema validation
- **Why**: Ensures data integrity - no "dirty data" allowed
- **Example**: Type mismatches, invalid formats

### 5. **Duplicate**
- **Reason**: Company already processed in this scraping session
- **When**: Early in the process
- **Why**: Avoids processing the same company multiple times
- **Example**: Same company appears in multiple search query results

## Typical Skip Distribution

### Before API Filtering (Old Approach)
For a keyword search with 100 results:
- **~40-50%**: Wrong SIC codes (not 62020/62090)
- **~20-30%**: Not active
- **~5-10%**: Missing fields or validation issues
- **~5%**: Duplicates

### After API Filtering (Current Approach)
With Advanced Search API filtering:
- **~0%**: Wrong SIC codes (✅ filtered by API)
- **~0%**: Not active (✅ filtered by API)
- **~5-10%**: Missing fields or validation issues (still possible)
- **~0-5%**: Duplicates (rare, only if same company in multiple pages)

## Why This Is Expected

The skip rate has **dramatically improved** with API filtering:

1. **API Filtering**: We now filter by SIC codes and status directly in the API request
   - ✅ Active companies only (`companyStatus: ['active']`)
   - ✅ Target SIC codes only (`sicCodes: ['62020', '62090']`)

2. **Client-Side Validation**: We still validate for:
   - Complete data (required fields)
   - Valid schema (Zod validation)
   - Duplicates (session-based deduplication)

3. **Quality over Quantity**: Better to have fewer, high-quality targets than many irrelevant companies

**Note**: With API filtering, most skip reasons should now be near zero. Remaining skips are primarily data quality issues (missing fields, validation failures).

## Improving Results

To reduce skip rate:
- Use more specific search keywords
- Target specific geographic areas
- Filter by company age in search (if API supports)
- Use multiple search strategies

## Viewing Skip Details

The scraper now shows a breakdown of skip reasons at the end:

```
┌─ SKIP REASONS BREAKDOWN ───────────────────────────────────┐
│
│  Not Active:           12
│  Wrong SIC Code:       25
│  Missing Fields:        3
│  Validation Failed:     2
│
└──────────────────────────────────────────────────────────────┘
```

