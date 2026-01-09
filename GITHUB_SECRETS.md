# GitHub Secrets Configuration

## Required Secrets

Add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

### 1. `COMPANIES_HOUSE_API_KEY` (Required for scraping)
- **What it's for**: Scraping company data from Companies House API
- **Where to get it**: https://developer.company-information.service.gov.uk/
- **Used by**: `scrape` script

### 2. `MISTRAL_API_KEY` (Required for enrichment)
- **What it's for**: Website analysis and document extraction
- **Where to get it**: https://console.mistral.ai/
- **Used by**: `analyze-websites`, `extract-docs` scripts

### 3. `MISTRAL_OCR_API_KEY` (Optional)
- **What it's for**: Alternative OCR service for document extraction
- **Where to get it**: https://console.mistral.ai/
- **Used by**: `extract-docs` script (if MISTRAL_API_KEY not available)
- **Note**: Only needed if you want to use the OCR service instead

## How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - Name: `COMPANIES_HOUSE_API_KEY`
   - Value: `your_api_key_here`
   - Click **Add secret**
5. Repeat for `MISTRAL_API_KEY` (and `MISTRAL_OCR_API_KEY` if needed)

## Which Scripts Need Which Secrets

| Script | COMPANIES_HOUSE_API_KEY | MISTRAL_API_KEY | MISTRAL_OCR_API_KEY |
|--------|------------------------|-----------------|---------------------|
| `scrape` | ✅ Required | ❌ | ❌ |
| `analyze-websites` | ❌ | ✅ Required | ❌ |
| `extract-docs` | ❌ | ✅ Required | ⚠️ Optional |
| `compute-scores` | ❌ | ❌ | ❌ |
| `recompute-msp-scores` | ❌ | ❌ | ❌ |
| `download-docs` | ❌ | ❌ | ❌ |
| `sync-docs` | ❌ | ❌ | ❌ |
| `load-csv` | ❌ | ❌ | ❌ |
| `dashboard` | ❌ | ❌ | ❌ |
| `scorecard-all` | ❌ | ❌ | ❌ |
| `top-companies` | ❌ | ❌ | ❌ |

## Testing

After adding secrets, test by:
1. Go to **Actions** tab
2. Select a workflow (e.g., "Run Company Scraper Scripts")
3. Click **Run workflow**
4. Select script and click **Run workflow**
