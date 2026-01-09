# Search Strategy

## Overview

**We now use the Advanced Company Search endpoint which supports direct SIC code and status filtering!**

No more keyword-based searching needed - the API filters directly by SIC codes and company status.

## Current Approach

The scraper uses the `/advanced-search/companies` endpoint with:
- ✅ **Direct SIC code filtering** (`sic_codes=62020,62090`)
- ✅ **Direct status filtering** (`company_status=active`)
- ✅ **Optional name filtering** (`company_name_includes`) for additional refinement

## Optional Name Filtering

While SIC code filtering is now done server-side, you can optionally add a company name filter to further narrow results:

### Suggested Name Filters (Optional):
- `"MSP"` - Find companies with MSP in the name
- `"managed services"` - Find companies explicitly mentioning managed services
- `"Microsoft"` - Find Microsoft-focused companies
- `"Azure"` - Find Azure-focused companies

### Example Usage:

```typescript
// Filter by SIC codes + active status only (no name filter)
await scraper.scrapeCompanies(['62020', '62090'], 100);

// Add optional name filter for MSP-focused companies
await scraper.scrapeCompanies(
  ['62020', '62090'], 
  100, 
  'MSP' // Optional: company_name_includes
);

// Add date range filtering
await scraper.scrapeCompanies(
  ['62020', '62090'],
  100,
  undefined, // no name filter
  '2020-01-01', // incorporated_from
  '2024-12-31'  // incorporated_to
);
```

## Filtering Process

1. **API Request**: Direct SIC code and status filtering at the API level
2. **Verification**: Double-check SIC codes and status from full profile (safety check)
3. **Thesis Criteria**: Final evaluation against thesis criteria (age, insolvency, etc.)

## Benefits

- **More Efficient**: No need to fetch profiles just to check SIC codes
- **More Accurate**: Direct SIC code matching instead of keyword guessing
- **Faster**: Server-side filtering reduces data transfer
- **Scalable**: Can fetch up to 5000 results per request

## Migration Notes

- The old keyword-based search approach is no longer used
- All filtering happens server-side via the Advanced Search API
- Name filtering is optional and can be used for additional refinement

