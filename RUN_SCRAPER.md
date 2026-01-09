# Run the Scraper

## Quick Start

Open your terminal and run:

```bash
cd "/Users/user/Downloads/Company Scraper App"
npm install
npm run scrape "62020,62090" 10
```

## What This Does

- Searches Companies House for IT consultancy companies (SIC codes 62020, 62090)
- Filters for active companies only
- Fetches complete company data:
  - Company profile
  - Officers (directors, secretaries)
  - Persons with Significant Control
  - Charges/Mortgages
  - Insolvency information
  - Filing history
- Saves up to 10 companies to `/data/companies/`

## Expected Output

You'll see progress like:
```
╔════════════════════════════════════════════════════════════╗
║        COMPANIES HOUSE SCRAPER - TARGET SIC CODES          ║
╚════════════════════════════════════════════════════════════╝

Target SIC Codes: 62020, 62090
Filter: Active companies only

Searching with query: "IT consultancy"
  Page 1: Found 100 results (Total: 5000)
    Fetching additional data for 12345678...
  ✓ 12345678: Company Name Ltd
  ...
```

## After Scraping

View results:
- `npm run dashboard` - Summary dashboard
- `npm run scorecard <company_number>` - Detailed analysis
- `ls data/companies/` - List all companies

## Troubleshooting

**If you get "command not found: npm":**
- Install Node.js from https://nodejs.org/
- Or use Homebrew: `brew install node`

**If you get API errors:**
- Check `.env` file has your API key
- Verify API key is correct
- Check rate limits (600 requests per 5 minutes)

