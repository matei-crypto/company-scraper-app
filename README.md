# Buy & Build Strategy Engine

A terminal-based acquisition target identification system that scrapes Companies House, enriches data with external signals, and stores everything in an agent-native file-based database.

## Investment Thesis

This platform supports our **AI-Enabled MSP Platform** investment strategy. See [`docs/INVESTMENT_THESIS.md`](docs/INVESTMENT_THESIS.md) for the complete investment thesis.

**Target Profile:**
- **EBITDA Range**: £500k–£1m (PE Void opportunity)
- **Recurring Revenue**: 70%+ of total revenue
- **Technology Stack**: Microsoft-centric (Microsoft 365, Azure)
- **SIC Codes**: 62020, 62090 (IT consultancy/services)
- **Company Age**: 3+ years (established operations)
- **No Red Flags**: No insolvency history, minimal outstanding charges

## Philosophy

- **Console as UI**: The interface is the Terminal. No Web/Tailwind.
- **Primitives over Abstractions**: The "Database" is a directory of JSON files in `/data/companies`.
- **Governance as Quality Control**: Every scraped company must pass Zod schema validation.

## Quick Start

```bash
# Install dependencies
npm install

# Set up Companies House API key (required for scraping)
# The .env file is automatically loaded. If you need to set it manually:
# export COMPANIES_HOUSE_API_KEY=your_api_key_here

# Scrape companies with SIC codes 62020 and 62090
npm run scrape

# Scrape with custom SIC codes and limit
npm run scrape "62020,62090" 50

# Run the dashboard
npm run dashboard

# View a company scorecard
npm run scorecard 12345678

# Run compliance tests
npm test

# Type check and test
npm run check
```

## Project Structure

```
/data/companies/          # File-based database (one JSON file per company)
/docs/                   # Investment thesis and documentation
/src/scrapers/           # Companies House API/Web scraping scripts
/src/enrichers/          # LinkedIn/Website/Financial enrichment scripts
/src/schemas/            # Zod schema definitions (Source of Truth)
/tests/governance/       # Compliance and data integrity tests
```

## Investment Logic

The investment scoring system evaluates companies based on our AI-Enabled MSP Platform thesis:

1. **Company Age** (0-25 points): Companies active for 3+ years score higher
2. **Financial Health** (0-30 points): Revenue and profitability indicators
3. **Employee Count** (0-20 points): Larger teams indicate established operations
4. **Enrichment Completeness** (0-15 points): Well-enriched companies are easier to evaluate
5. **Tech Stack Presence** (0-10 points): Companies with identified tech stacks are more attractive
6. **Microsoft Stack Alignment** (0-10 points): Bonus for Microsoft-centric technology stacks

**High-Value Target Criteria (Thesis-Aligned):**
- Must be active for 3+ years
- Must have financial data OR enrichment data
- No insolvency history
- Size Profile (meet at least one): £500k–£1m EBITDA OR £3m–£6m revenue OR 15–40 employees
- Ideal: 70%+ recurring revenue, Microsoft-centric stack

## Data Schema

All company records must conform to `CompanySchema` defined in `/src/schemas/CompanySchema.ts`. The schema includes:

- Core Companies House data (name, number, status, incorporation date)
- SIC codes
- Financial data (revenue, profit, assets, employees)
- Enrichment data (website, LinkedIn, headcount, tech stack)
- Metadata (scraped_at, updated_at, version)

## Scraping Companies House

The scraper targets active companies with SIC codes:
- **62020**: Information technology consultancy activities
- **62090**: Other information technology service activities

**How it works:**
1. Searches Companies House using IT-related keywords
2. Filters results to only active companies
3. Validates SIC codes match target codes (62020 or 62090)
4. Saves validated companies to `/data/companies/{company_number}.json`
5. Preserves existing enrichment data when updating records

**API Requirements:**
- Free tier: 600 requests per 5 minutes
- Get your API key at: https://developer.company-information.service.gov.uk/

## Behavioral Rules

See `.cursorrules` for complete behavioral guidelines. Key principles:

- **Source of Truth**: All data lives in `/data/companies` as `{company_number}.json`
- **Persistence over Volatility**: Failed enrichments don't delete records, they mark `enrichment_status: "failed"`
- **Governance**: No "Dirty Data" - all records must pass Zod validation

