# Document Extraction with Mistral OCR 3

## Overview

The system can extract structured financial data from company account documents (PDFs) using Mistral OCR 3. This enables multi-year trend analysis and detailed financial insights aligned with the investment thesis.

## Setup

### Environment Variables

Set one of the following API keys in your `.env` file:

**Option 1: Mistral AI API (Recommended)**
```bash
MISTRAL_API_KEY=your_mistral_ai_api_key
```
- Uses Mistral AI's `mistral-ocr-2512` OCR model
- Supports PDF documents directly (no conversion needed)
- Supports structured JSON extraction directly
- Get your key at: https://console.mistral.ai/

**Option 2: Mistral OCR Service**
```bash
MISTRAL_OCR_API_KEY=your_mistral_ocr_api_key
```
- Uses Mistral OCR service (mistralocr.app)
- Note: May require additional LLM call for structured extraction
- Get your key at: https://www.mistralocr.app/

## Usage

### Extract from a Single Company

```bash
npm run extract-docs <company_number>
```

Example:
```bash
npm run extract-docs 07019261
```

### Extract from Multiple Companies

```bash
npm run extract-docs <company_number> [company_number...]
```

Example:
```bash
npm run extract-docs 07019261 04298949 06228885
```

### Extract from All Companies

```bash
npm run extract-docs -- --all
```

### Options

- `--force`: Re-extract even if data already exists for a document
- `--max-docs=N`: Limit the number of documents processed per company (default: all)

Example:
```bash
npm run extract-docs 07019261 --max-docs=3 --force
```

## What Gets Extracted

For each account document, the system extracts:

### Financial Statements
- **P&L Data**: Revenue, costs, gross profit, operating expenses, EBITDA, profit
- **Balance Sheet**: Assets, liabilities, net assets, shareholders' equity
- **Cash Flow**: Operating, investing, financing cash flows

### Revenue Breakdown (Critical for Thesis)
- **Recurring Revenue**: Monthly/annual contracts, subscriptions
- **Recurring Revenue %**: Percentage of total revenue (target: 70%+)
- **Service Revenue**: Breakdown by type (managed services, cloud, etc.)

### Client Data
- **Client Concentration**: Top client %, top 3 clients %, top 10 clients %
- **Total Clients**: Number of active clients
- **Average Revenue per Client**

### Employee Data
- **Average Employee Count**: For the period
- **Total Staff Costs**: Salaries, benefits, pension
- **Average Cost per Employee**

### Technology Indicators
- **Technology Mentions**: Especially Microsoft products
- **IT/Software Costs**: Technology spending
- **Cloud Services Costs**: Azure, AWS, etc.

### Financial Ratios
- **Gross Margin**: (Gross Profit / Revenue) × 100
- **Operating Margin**: (Operating Profit / Revenue) × 100
- **EBITDA Margin**: (EBITDA / Revenue) × 100
- **Current Ratio**: Current Assets / Current Liabilities

### Strategic Insights
- **Business Description**: What the company does
- **Technology Mentions**: From directors' report
- **Key Contracts**: Major client contracts
- **Future Plans**: Expansion plans, new services

## Data Storage

Extracted data is stored in `company.financials.extracted`:

```typescript
{
  annual_data: [
    {
      period_end: "2024-03-31",
      revenue: 1200000,
      ebitda: 600000,
      recurring_revenue_percentage: 75,
      // ... full year data
    },
    {
      period_end: "2023-03-31",
      revenue: 1000000,
      ebitda: 500000,
      // ... previous year data
    }
  ],
  trends: {
    revenue_growth_1y: 20.0,  // 20% YoY growth
    revenue_trend: "growing",
    average_ebitda_3y: 500000
  },
  latest_year: {
    period_end: "2024-03-31",
    revenue: 1200000,
    ebitda: 600000,
    recurring_revenue_percentage: 75
  }
}
```

## Trend Analysis

The system automatically calculates:

- **Year-over-Year Growth**: Revenue, profit, EBITDA, employees
- **3-Year CAGR**: Compound Annual Growth Rate
- **Trend Directions**: Growing, stable, or declining
- **Multi-Year Averages**: 3-year averages for key metrics

## Integration with Scoring

Extracted data automatically updates:
- `company.financials.revenue` - From latest year
- `company.financials.profit` - From latest year
- `company.financials.employees` - From latest year
- `company.enrichment.tech_stack` - Aggregated from all years

## Validation

- All extracted data is validated against `AnnualFinancialDataSchema`
- Validation warnings are logged but don't stop extraction
- Partial data is preserved (better than no data)

## Error Handling

- **API Errors**: Logged with status codes and details
- **Parse Errors**: JSON parsing failures are logged
- **Validation Errors**: Schema validation warnings are logged
- **Missing Documents**: Skipped gracefully

## Rate Limiting

- 1 second delay between document extractions
- Respects API rate limits
- Adjustable in code if needed

## Next Steps

After extraction:
1. Review extracted data in company JSON files
2. Check trends for growth patterns
3. Use recurring revenue % for thesis alignment
4. Update investment scores based on extracted financials

