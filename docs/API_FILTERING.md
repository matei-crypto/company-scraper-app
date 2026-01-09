# Companies House API Filtering

## Current Implementation

**We now use the Advanced Company Search endpoint which supports direct filtering!**

## Advanced Search Endpoint

We use `/advanced-search/companies` which supports:
- ✅ **SIC code filtering** (`sic_codes` parameter)
- ✅ **Company status filtering** (`company_status` parameter)
- ✅ **Date range filtering** (`incorporated_from`, `incorporated_to`)
- ✅ **Company name filtering** (`company_name_includes`, `company_name_excludes`)
- ✅ **Location filtering** (`location`)
- ✅ **Pagination** (`size` up to 5000, `start_index`)

API Documentation: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search

## Current Flow (Highly Efficient)

```
1. Advanced Search API call → Returns filtered results (SIC codes + active status)
2. Process results → All companies already match our criteria
3. Fetch full profile → Only for matching companies
4. Fetch additional data → Only for matching companies
```

## Benefits

1. **Fewer API Calls**: No need to fetch profiles just to check SIC codes or status
2. **Server-Side Filtering**: API does the filtering, reducing data transfer
3. **More Accurate**: Direct SIC code matching instead of keyword guessing
4. **Better Performance**: Can fetch up to 5000 results per request (vs 100 with basic search)

## Usage

The scraper now filters directly in the API request:

```typescript
await scraper.advancedSearchCompanies({
  sicCodes: ['62020', '62090'],
  companyStatus: ['active'],
  companyNameIncludes: 'MSP', // Optional
  incorporatedFrom: '2020-01-01', // Optional
  incorporatedTo: '2024-12-31', // Optional
  size: 100,
  startIndex: 0,
});
```

## Migration Notes

- The old `searchCompanies` method is kept for backward compatibility but is deprecated
- The new `scrapeCompanies` method no longer requires keyword search queries
- All filtering happens server-side, making the scraper much more efficient

