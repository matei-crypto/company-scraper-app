# Document Downloads

## Overview

The system can download and store account documents from Companies House filing history. Documents are stored in a structured directory format per company.

## Directory Structure

Documents are stored in:
```
data/companies/{company_number}/documents/{transaction_id}.pdf
```

Example:
```
data/companies/07019261/documents/MzQ5MTQ0OTQwOWFkaXF6a2N4.pdf
```

## Usage

### Download Account Documents for a Company

```bash
npm run download-docs <company_number>
```

Example:
```bash
npm run download-docs 07019261
```

### Download for Multiple Companies

```bash
npm run download-docs 07019261 04298949 06228885
```

### Download for All Companies

```bash
npm run download-docs -- --all
```

This will download account documents for all companies in the database. Use `--` to pass arguments through npm.

### Options

- `--force`: Re-download documents even if they already exist
- `--max-docs=N`: Limit the number of documents downloaded per company (default: all)

Example with options:
```bash
npm run download-docs 07019261 --max-docs=5 --force
```

## What Gets Downloaded

The system automatically filters filing history for:
- **Category**: `accounts`
- **Type**: `AA` (Annual Accounts)

Only account documents matching these criteria are downloaded.

## Document Tracking

When a document is downloaded, the company record is updated to track:
- `document_downloaded`: `true`
- `document_path`: Path to the stored document
- `document_downloaded_at`: ISO timestamp of download

This information is stored in the `filing_history.filing_history[]` array for each matching filing.

## API Endpoints Used

1. **Get Filing History**: `/company/{company_number}/filing-history`
   - Retrieves list of filings
   - Filters for account documents

2. **Get Document Metadata**: `/company/{company_number}/filing-history/{transaction_id}`
   - Gets metadata including document download links

3. **Download Document**: Uses the `document_download` link from metadata
   - Downloads PDF document
   - Stores in company's documents directory

## File Naming

Documents are named using the `transaction_id` from the filing history:
- Format: `{transaction_id}.pdf`
- Example: `MzQ5MTQ0OTQwOWFkaXF6a2N4.pdf`

This ensures unique filenames and easy correlation with filing history records.

## Rate Limiting

The download process includes a 200ms delay between downloads to respect API rate limits (600 requests per 5 minutes).

## Error Handling

- Documents that are not available (404) are skipped
- Access denied documents (403) are skipped
- Other errors are logged but don't stop the process
- Summary shows: downloaded, skipped, errors

## Integration

The document download functionality can be integrated into:
- The main scraper workflow (future enhancement)
- Manual document retrieval for specific companies
- Batch processing of multiple companies

## Schema Updates

The `FilingHistoryItemSchema` has been extended to include:
- `document_downloaded`: boolean (optional)
- `document_path`: string (optional)
- `document_downloaded_at`: string (optional)

These fields track which documents have been downloaded and where they're stored.

