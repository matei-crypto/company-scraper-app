# Testing the Companies House Scraper

## Quick Test (10 Companies)

Run this command to scrape 10 companies with SIC codes 62020 and 62090:

```bash
npm run scrape "62020,62090" 10
```

Or use the test script:

```bash
./test-scraper.sh
```

## What to Expect

The scraper will:
1. Search for companies using IT-related keywords
2. Filter for active companies only
3. Validate SIC codes match 62020 or 62090
4. Fetch full company profiles with:
   - Basic company information
   - Officers (directors, secretaries)
   - Persons with Significant Control
   - Charges/Mortgages
   - Insolvency information
   - Filing history
5. Save validated companies to `/data/companies/{company_number}.json`

## Output

You'll see:
- Progress indicators for each company
- ✓ for successfully scraped companies
- ↻ for updated companies
- ✗ for errors
- Summary statistics at the end

## Verify Results

After scraping, check the results:

```bash
# View dashboard
npm run dashboard

# View a specific company scorecard
npm run scorecard <company_number>

# List all scraped companies
ls -la data/companies/
```

## Troubleshooting

If you get API errors:
- Check your API key is correct in `.env`
- Verify you haven't exceeded rate limits (600 requests per 5 minutes)
- Check your internet connection

