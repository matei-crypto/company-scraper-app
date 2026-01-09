# Deployment Guide for Vercel

## Overview

This app uses **Vercel Blob Storage** to store company data in the serverless environment, while maintaining local filesystem support for development.

## Setup Steps

### 1. Create Vercel Blob Store

1. Go to [Vercel Dashboard](https://vercel.com/dashboard/stores)
2. Click "Create Store" → Select "Blob"
3. Name it (e.g., "company-scraper-data")
4. Copy the `BLOB_READ_WRITE_TOKEN`

### 2. Set Environment Variable

Add the token to your Vercel project:

```bash
# Via Vercel CLI
vercel env add BLOB_READ_WRITE_TOKEN

# Or via Vercel Dashboard:
# Project Settings → Environment Variables → Add BLOB_READ_WRITE_TOKEN
```

### 3. Migrate Local Data to Blob Storage

Before first deployment, migrate your local company files:

```bash
# Set the token locally (one-time)
export BLOB_READ_WRITE_TOKEN="your_token_here"

# Run migration
npm run migrate-blob
```

This uploads all `data/companies/*.json` files to Vercel Blob Storage.

### 4. Deploy to Vercel

```bash
# Login to Vercel
npx vercel login

# Deploy
npx vercel --yes
```

Or connect your GitHub repo for automatic deployments.

## API Endpoints

Once deployed, you'll have:

- **GET `/api/companies`** - Query companies
  - Query params: `limit`, `minScore`, `mspConfidence`, `sortBy`
  - Example: `/api/companies?limit=20&mspConfidence=high`

- **POST `/api/run-script`** - Execute CLI scripts
  - Body: `{ "script": "scrape", "params": {} }`
  - Available scripts: `scrape`, `analyze-websites`, `compute-scores`, `recompute-msp-scores`, etc.

- **POST `/api/migrate-blob`** - Migrate local files to Blob (one-time)

## How It Works

- **Local Development**: Uses filesystem (`data/companies/*.json`)
- **Vercel Production**: Automatically uses Blob Storage when `BLOB_READ_WRITE_TOKEN` is set
- **Seamless**: Same API, different storage backend

## Notes

- Scripts that write to filesystem will work in Vercel via Blob Storage
- Long-running scripts may hit Vercel's timeout limits (use Background Functions for Pro/Enterprise)
- Documents (PDFs) still use filesystem - consider migrating to Blob Storage if needed
