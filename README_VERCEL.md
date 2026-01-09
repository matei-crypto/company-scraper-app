# Deploying to Vercel

## Important Considerations

### File System Limitations
Vercel serverless functions have a **read-only filesystem** (except `/tmp`). Your scripts write to `data/companies/*.json`, which won't persist in Vercel's serverless environment.

### Solutions

#### Option 1: Use Vercel Blob Storage (Recommended)
Store company JSON files in Vercel Blob Storage instead of the filesystem.

#### Option 2: Use a Database
Migrate to Vercel Postgres, MongoDB, or another database.

#### Option 3: GitHub as Source of Truth
- Keep the file-based database in GitHub
- Scripts run locally or via GitHub Actions
- API reads from GitHub or a database

#### Option 4: Hybrid Approach
- Use Vercel for API endpoints (read-only)
- Run scripts locally or via GitHub Actions
- Push results back to GitHub

## Current Setup

The `api/run-script.js` endpoint allows triggering scripts, but **will fail** for scripts that write to the filesystem unless you implement one of the solutions above.

## Recommended Next Steps

1. **For API/Read Operations**: Deploy as-is, but modify to read from GitHub or a database
2. **For Script Execution**: 
   - Use GitHub Actions for scheduled script runs
   - Or migrate to Vercel Blob Storage/database
   - Or run scripts locally and sync results

## Deployment

```bash
npx vercel login
npx vercel --yes
```
