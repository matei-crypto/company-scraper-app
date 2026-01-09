# Document Extraction Strategy

## Overview

This document defines what data should be extracted from company account documents (PDFs) using LLM vision capabilities. The extraction strategy is aligned with the **AI-Enabled MSP Platform** investment thesis.

## Investment Thesis Context

**Target Profile:**
- **EBITDA Range**: £500k–£1m (PE Void opportunity)
- **Recurring Revenue**: 70%+ of total revenue
- **Technology Stack**: Microsoft-centric (Microsoft 365, Azure)
- **Company Age**: 3+ years (established operations)
- **No Red Flags**: No insolvency history, minimal outstanding charges

## Data to Extract (Priority Order)

### 🔴 Critical - Directly Used in Scoring

#### 1. Financial Statements Data

**Profit & Loss (P&L) Statement:**
- **Revenue** (Turnover) - Total revenue for the period
- **Cost of Sales** - Direct costs
- **Gross Profit** - Revenue minus cost of sales
- **Operating Expenses** - Breakdown by category:
  - Staff costs (salaries, benefits, pension)
  - Rent/premises costs
  - IT/software costs
  - Marketing costs
  - Professional fees (legal, accounting)
  - Other operating expenses
- **Operating Profit** (EBIT) - Profit before interest and tax
- **EBITDA** - Earnings Before Interest, Tax, Depreciation, and Amortization
  - *If not stated, calculate: Operating Profit + Depreciation + Amortization*
- **Profit Before Tax** - Operating profit minus interest
- **Tax** - Corporation tax
- **Profit After Tax** (Net Profit) - Final profit figure

**Balance Sheet:**
- **Total Assets** - Current and fixed assets
- **Current Assets** - Cash, debtors, stock
- **Fixed Assets** - Tangible and intangible assets
- **Total Liabilities** - Current and long-term liabilities
- **Current Liabilities** - Creditors, loans due within 1 year
- **Long-term Liabilities** - Loans, leases due after 1 year
- **Net Assets** - Assets minus liabilities
- **Shareholders' Equity** - Share capital, reserves, retained earnings

**Cash Flow Statement:**
- **Operating Cash Flow** - Cash from operations
- **Investing Cash Flow** - Capital expenditures, asset purchases
- **Financing Cash Flow** - Loans, dividends, share issues
- **Net Cash Flow** - Overall cash movement

#### 2. Revenue Breakdown (Critical for Thesis)

**Revenue by Type:**
- **Recurring Revenue** - Monthly/annual contracts, subscriptions, retainer fees
  - *This is KEY - need to identify % of total revenue*
- **One-time Revenue** - Project work, one-off services, hardware sales
- **Service Revenue** - Breakdown by service type:
  - Managed IT services
  - Cloud services (Azure, AWS, etc.)
  - Software licensing/reselling
  - Professional services/consulting
  - Hardware sales
  - Other services

**Revenue by Client:**
- **Top 5 Clients** - Revenue from largest clients (if disclosed)
- **Client Concentration** - % of revenue from top client, top 3 clients, top 10 clients
  - *High concentration (>50% from one client) is a risk*

**Revenue Trends:**
- **Year-over-Year Growth** - Compare current year to previous year
- **Multi-year Trend** - If multiple years of accounts available, extract trend

#### 3. Employee & Headcount Data

- **Average Number of Employees** - During the period
- **Employee Costs** - Total staff costs (salaries, benefits, pension)
- **Average Cost per Employee** - Employee costs / number of employees
- **Employee Breakdown** (if available):
  - Technical staff (engineers, support)
  - Sales/marketing staff
  - Administrative staff
  - Management/directors

### 🟡 Important - Used for Risk Assessment

#### 4. Technology & Infrastructure Indicators

**Technology Investments:**
- **IT/Software Costs** - Spending on technology infrastructure
- **Cloud Services Costs** - Azure, AWS, Microsoft 365 costs
- **Software Licenses** - Microsoft, other software licensing
- **Hardware Purchases** - Equipment, servers, workstations
- **Technology Mentions** - Any references to:
  - Microsoft products (Office 365, Azure, Teams, SharePoint)
  - Cloud platforms (Azure, AWS, Google Cloud)
  - IT tools (PSA, RMM, ticketing systems)
  - Security tools
  - Backup/disaster recovery solutions

#### 5. Client & Service Indicators

**Service Mix:**
- **Managed Services Revenue** - Ongoing support contracts
- **Project Revenue** - One-time implementations
- **Cloud Services Revenue** - Hosting, SaaS reselling
- **Hardware Revenue** - Equipment sales
- **Professional Services Revenue** - Consulting, implementation

**Client Base:**
- **Number of Clients** - Total active clients (if disclosed)
- **Average Revenue per Client** - Total revenue / number of clients
- **Client Retention Rate** - If mentioned in directors' report
- **New Client Wins** - New clients acquired during period

#### 6. Financial Health Indicators

**Profitability Metrics:**
- **Gross Margin** - (Gross Profit / Revenue) × 100
- **Operating Margin** - (Operating Profit / Revenue) × 100
- **Net Margin** - (Net Profit / Revenue) × 100
- **EBITDA Margin** - (EBITDA / Revenue) × 100
  - *Target: 15-30% for MSPs*

**Liquidity & Solvency:**
- **Current Ratio** - Current Assets / Current Liabilities
- **Quick Ratio** - (Current Assets - Stock) / Current Liabilities
- **Debt-to-Equity Ratio** - Total Liabilities / Shareholders' Equity
- **Cash Position** - Cash and cash equivalents

**Growth Indicators:**
- **Revenue Growth Rate** - Year-over-year % change
- **Profit Growth Rate** - Year-over-year % change
- **Employee Growth Rate** - Year-over-year % change

### 🟢 Valuable - Used for Integration Planning

#### 7. Directors' Report & Notes

**Strategic Information:**
- **Business Description** - What the company actually does
- **Market Position** - Competitive positioning, market share
- **Key Contracts** - Major client contracts, partnerships
- **Technology Stack Mentions** - Any technology references
- **Future Plans** - Expansion plans, new services
- **Risks & Challenges** - Identified risks, market challenges

**Operational Insights:**
- **Service Delivery Model** - How services are delivered
- **Geographic Coverage** - Service areas, locations
- **Key Personnel** - Important staff, technical leadership
- **Partnerships** - Vendor partnerships, reseller agreements

#### 8. Commitments & Contingencies

**Financial Commitments:**
- **Operating Leases** - Office rent, equipment leases
- **Capital Commitments** - Future asset purchases
- **Loan Commitments** - Outstanding loans, credit facilities
- **Pension Commitments** - Defined benefit pension obligations

**Contingent Liabilities:**
- **Guarantees** - Guarantees provided to third parties
- **Legal Proceedings** - Ongoing or potential legal issues
- **Warranties** - Product/service warranties provided

#### 9. Related Party Transactions

- **Director Loans** - Loans to/from directors
- **Related Company Transactions** - Transactions with related entities
- **Director Remuneration** - Total director pay, benefits
- **Shareholder Transactions** - Transactions with shareholders

## Data Structure for Extracted Data

### Recommended Schema Extension

**Key Design Decision**: Store data for **each year separately** to enable trend analysis, year-over-year comparisons, and growth trajectory tracking.

```typescript
/**
 * Single Year Financial Data
 * Represents one accounting period (typically one year)
 */
const AnnualFinancialDataSchema = z.object({
  // Period Information
  period_start: z.string(), // YYYY-MM-DD - Start of accounting period
  period_end: z.string(),   // YYYY-MM-DD - End of accounting period
  period_duration_months: z.number().optional(), // Usually 12, but can vary
  accounting_reference_date: z.string().optional(), // YYYY-MM-DD
  
  // P&L Data
  revenue: z.number().optional(),
  cost_of_sales: z.number().optional(),
  gross_profit: z.number().optional(),
  operating_expenses: z.object({
    staff_costs: z.number().optional(),
    rent_premises: z.number().optional(),
    it_software: z.number().optional(),
    marketing: z.number().optional(),
    professional_fees: z.number().optional(),
    depreciation: z.number().optional(),
    amortization: z.number().optional(),
    other: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
  operating_profit: z.number().optional(),
  ebitda: z.number().optional(), // Calculated or stated
  profit_before_tax: z.number().optional(),
  tax: z.number().optional(),
  profit_after_tax: z.number().optional(),
  
  // Balance Sheet Data
  total_assets: z.number().optional(),
  current_assets: z.number().optional(),
  fixed_assets: z.number().optional(),
  total_liabilities: z.number().optional(),
  current_liabilities: z.number().optional(),
  long_term_liabilities: z.number().optional(),
  net_assets: z.number().optional(),
  shareholders_equity: z.number().optional(),
  
  // Cash Flow Data
  operating_cash_flow: z.number().optional(),
  investing_cash_flow: z.number().optional(),
  financing_cash_flow: z.number().optional(),
  net_cash_flow: z.number().optional(),
  
  // Revenue Breakdown (CRITICAL)
  revenue_breakdown: z.object({
    recurring_revenue: z.number().optional(),
    recurring_revenue_percentage: z.number().optional(), // % of total
    one_time_revenue: z.number().optional(),
    service_revenue: z.object({
      managed_services: z.number().optional(),
      cloud_services: z.number().optional(),
      software_licensing: z.number().optional(),
      professional_services: z.number().optional(),
      hardware_sales: z.number().optional(),
      other: z.number().optional(),
    }).optional(),
  }).optional(),
  
  // Client Data
  client_data: z.object({
    total_clients: z.number().optional(),
    top_client_revenue_percentage: z.number().optional(),
    top_3_clients_revenue_percentage: z.number().optional(),
    top_10_clients_revenue_percentage: z.number().optional(),
    average_revenue_per_client: z.number().optional(),
  }).optional(),
  
  // Employee Data
  employees: z.object({
    average_count: z.number().optional(),
    total_costs: z.number().optional(),
    average_cost_per_employee: z.number().optional(),
    breakdown: z.object({
      technical: z.number().optional(),
      sales_marketing: z.number().optional(),
      administrative: z.number().optional(),
      management: z.number().optional(),
    }).optional(),
  }).optional(),
  
  // Technology Indicators
  technology_costs: z.object({
    it_software_total: z.number().optional(),
    cloud_services: z.number().optional(),
    software_licenses: z.number().optional(),
    hardware: z.number().optional(),
    mentions: z.array(z.string()).optional(), // Technology mentions
  }).optional(),
  
  // Financial Ratios (calculated for this year)
  ratios: z.object({
    gross_margin: z.number().optional(),
    operating_margin: z.number().optional(),
    net_margin: z.number().optional(),
    ebitda_margin: z.number().optional(),
    current_ratio: z.number().optional(),
    quick_ratio: z.number().optional(),
    debt_to_equity: z.number().optional(),
  }).optional(),
  
  // Directors' Report Insights (year-specific)
  strategic_insights: z.object({
    business_description: z.string().optional(),
    market_position: z.string().optional(),
    key_contracts: z.array(z.string()).optional(),
    technology_mentions: z.array(z.string()).optional(),
    future_plans: z.string().optional(),
    risks_challenges: z.array(z.string()).optional(),
  }).optional(),
  
  // Commitments (as of period end)
  commitments: z.object({
    operating_leases: z.number().optional(),
    capital_commitments: z.number().optional(),
    loan_commitments: z.number().optional(),
    pension_commitments: z.number().optional(),
  }).optional(),
  
  // Metadata
  extracted_at: z.string().optional(), // ISO timestamp
  extraction_method: z.string().optional(), // "llm_vision", etc.
  document_source: z.string().optional(), // Transaction ID of source document
  confidence_score: z.number().optional(), // 0-1 confidence in extraction
});

/**
 * Extracted Financials - Multi-Year Trend Data
 * Stores financial data for each accounting period separately
 */
const ExtractedFinancialsSchema = z.object({
  // Array of annual financial data, ordered by period_end (most recent first)
  annual_data: z.array(AnnualFinancialDataSchema).default([]),
  
  // Computed trend metrics (derived from annual_data)
  trends: z.object({
    // Growth rates (calculated from annual_data)
    revenue_growth_1y: z.number().optional(), // % change vs previous year
    revenue_growth_3y_cagr: z.number().optional(), // 3-year CAGR if available
    profit_growth_1y: z.number().optional(),
    profit_growth_3y_cagr: z.number().optional(),
    ebitda_growth_1y: z.number().optional(),
    employee_growth_1y: z.number().optional(),
    
    // Trend direction indicators
    revenue_trend: z.enum(['growing', 'stable', 'declining']).optional(),
    profit_trend: z.enum(['growing', 'stable', 'declining']).optional(),
    margin_trend: z.enum(['improving', 'stable', 'declining']).optional(),
    
    // Multi-year averages (for comparison)
    average_revenue_3y: z.number().optional(),
    average_profit_3y: z.number().optional(),
    average_ebitda_3y: z.number().optional(),
    average_ebitda_margin_3y: z.number().optional(),
    average_recurring_revenue_pct_3y: z.number().optional(),
  }).optional(),
  
  // Latest year summary (for quick access)
  latest_year: z.object({
    period_end: z.string().optional(),
    revenue: z.number().optional(),
    profit: z.number().optional(),
    ebitda: z.number().optional(),
    recurring_revenue_percentage: z.number().optional(),
    employees: z.number().optional(),
  }).optional(),
  
  // Metadata
  first_extracted_at: z.string().optional(), // ISO timestamp of first extraction
  last_extracted_at: z.string().optional(), // ISO timestamp of most recent extraction
  total_years_available: z.number().optional(), // Count of annual_data entries
});
```

## Extraction Priority by Document Type

### Annual Accounts (Full Accounts)
**Priority: HIGH** - Extract all data categories above

### Abbreviated Accounts (Small Companies)
**Priority: MEDIUM** - Extract:
- Basic P&L data
- Balance sheet summary
- Employee count
- Revenue (if disclosed)
- Limited notes

### Micro-entity Accounts
**Priority: LOW** - Extract:
- Basic financials only
- Employee count
- Limited data available

## LLM Vision Extraction Instructions

### Prompt Template

```
Extract financial and business data from this UK company account document.

IMPORTANT: Extract data for the SPECIFIC ACCOUNTING PERIOD shown in this document.
Do NOT average or combine data from multiple years. Each document represents ONE year.

Focus on:
1. Financial statements (P&L, Balance Sheet, Cash Flow) for THIS PERIOD
2. Revenue breakdown - CRITICAL: Identify recurring vs one-time revenue for THIS YEAR
3. EBITDA calculation or components for THIS PERIOD
4. Employee data and costs for THIS PERIOD
5. Technology mentions (especially Microsoft products) mentioned in THIS YEAR's report
6. Client concentration data for THIS PERIOD
7. Directors' report insights from THIS YEAR

For each value:
- Extract the exact number for THIS ACCOUNTING PERIOD
- Note the currency (should be GBP/£)
- Extract the period_start and period_end dates (YYYY-MM-DD format)
- If a value is not stated, mark as null
- Do NOT calculate averages or combine with other years

Return structured JSON matching AnnualFinancialDataSchema (single year data).
The system will combine multiple years' extractions into a trends array.
```

### Multi-Document Extraction Strategy

When extracting from multiple account documents:

1. **Process Each Document Separately**:
   - Each PDF represents one accounting period
   - Extract data for that specific period only
   - Store as a separate entry in `annual_data[]`

2. **Order by Period**:
   - Sort `annual_data[]` by `period_end` (most recent first)
   - This enables easy year-over-year comparisons

3. **Calculate Trends After Extraction**:
   - Once you have 2+ years of data, calculate:
     - Year-over-year growth rates
     - Multi-year averages
     - Trend direction indicators
   - Store in `trends` object

4. **Update Latest Year Summary**:
   - Always keep `latest_year` pointing to the most recent period
   - Use this for quick access without iterating through array

## Integration with Existing Schema

The extracted data should populate:
- `company.financials.*` - Basic financial fields (already in schema)
  - These should be populated from the **latest year** in `extracted_financials`
- `company.financials.extracted.*` - New detailed multi-year extraction (needs schema extension)
  - `annual_data[]` - Array of yearly financial data, ordered by period_end (most recent first)
  - `trends.*` - Computed growth metrics and trend indicators
  - `latest_year.*` - Quick access to most recent year's key metrics
- `company.enrichment.tech_stack` - Technology mentions aggregated from all years
- `company.enrichment.recurring_revenue_percentage` - From latest year's data

## Trend Analysis Benefits

By storing data for each year separately, you can:

1. **Calculate Growth Rates**:
   - Year-over-year revenue growth
   - 3-year CAGR (Compound Annual Growth Rate)
   - Profit margin trends
   - Employee growth trajectory

2. **Identify Patterns**:
   - Revenue acceleration or deceleration
   - Margin expansion or contraction
   - Recurring revenue % trends (improving or declining)
   - Client concentration trends

3. **Risk Assessment**:
   - Declining revenue trends
   - Margin compression
   - Increasing client concentration
   - Cash flow volatility

4. **Investment Thesis Validation**:
   - Track progress toward £500k-£1m EBITDA range
   - Monitor recurring revenue % trend (target: 70%+)
   - Assess financial stability over time
   - Evaluate growth sustainability

## Validation & Quality Checks

1. **Cross-Reference**: Compare extracted revenue/profit with Companies House API data
2. **Consistency Checks**: Ensure P&L balances (Revenue - Costs = Profit) for each year
3. **Period Validation**: 
   - Verify account period matches filing date
   - Ensure no duplicate periods in `annual_data[]`
   - Check that periods are sequential (no gaps unless expected)
4. **Currency Validation**: Ensure all values are in GBP
5. **Confidence Scoring**: LLM should provide confidence scores for uncertain extractions
6. **Trend Validation**:
   - Verify growth rate calculations are correct
   - Check that trends are calculated from actual annual_data
   - Ensure latest_year matches most recent annual_data entry
7. **Year-over-Year Consistency**:
   - Compare balance sheet items year-to-year (should be consistent)
   - Verify that retained earnings changes match profit/loss
   - Check that asset/liability movements make sense

## Next Steps

1. **Extend CompanySchema** - Add `extracted_financials` field with multi-year structure
2. **Create Extraction Service** - LLM vision integration that processes each document separately
3. **Build Trend Calculation Logic** - Automatically compute growth rates and trends when 2+ years available
4. **Build Validation Logic** - Cross-reference with existing data, validate year-over-year consistency
5. **Update Scoring Logic** - Use extracted recurring revenue % and trend data for thesis alignment
6. **Create Trend Visualization** - Display multi-year trends in scorecard/dashboard
7. **Create Extraction Report** - Show what was extracted vs what's missing, highlight trends

## Example Usage

```typescript
// Access latest year data
const latestRevenue = company.financials.extracted?.latest_year?.revenue;

// Access specific year
const year2023 = company.financials.extracted?.annual_data.find(
  d => d.period_end.startsWith('2023')
);

// Calculate growth rate
const revenueGrowth = company.financials.extracted?.trends?.revenue_growth_1y;

// Check trend direction
const isGrowing = company.financials.extracted?.trends?.revenue_trend === 'growing';

// Get 3-year average EBITDA
const avgEBITDA = company.financials.extracted?.trends?.average_ebitda_3y;
```

