# Running Scripts in a Hosted Environment

## Option 1: GitHub Actions (Recommended - Free)

### Setup

1. **Add secrets to GitHub** (if needed):
   - Go to: `Settings → Secrets and variables → Actions`
   - Add `COMPANIES_HOUSE_API_KEY` (or other API keys)

2. **Workflows are ready to use:**
   - `.github/workflows/scrape.yml` - Daily scraping
   - `.github/workflows/enrich.yml` - Daily enrichment
   - `.github/workflows/run-scripts.yml` - Manual script execution

### Usage

**Automatic (Scheduled):**
- Scrape runs daily at 2 AM UTC
- Enrichment runs daily at 3 AM UTC
- Results are automatically committed to GitHub

**Manual Trigger:**
- Go to `Actions` tab in GitHub
- Select workflow → "Run workflow"
- Choose script to run

### Benefits
- ✅ Free for public repos
- ✅ Full filesystem access
- ✅ Scheduled execution
- ✅ Automatic commits
- ✅ No infrastructure to manage

---

## Option 2: Traditional Server/VPS

### Setup

1. **Deploy to a VPS** (DigitalOcean, AWS EC2, etc.)
2. **Clone your repo**
3. **Set up cron jobs:**

```bash
# Edit crontab
crontab -e

# Add scheduled tasks
0 2 * * * cd /path/to/repo && npm run scrape
0 3 * * * cd /path/to/repo && npm run analyze-websites
0 4 * * * cd /path/to/repo && npm run compute-scores
```

### Benefits
- ✅ Full control
- ✅ Persistent filesystem
- ✅ Can run any script
- ❌ Costs money (~$5-20/month)
- ❌ Need to manage server

---

## Option 3: Vercel with Database

Instead of Blob Storage, use a database:

### Setup

1. **Use Vercel Postgres** (or MongoDB, Supabase, etc.)
2. **Modify scripts** to read/write from database instead of files
3. **Deploy API endpoints** that trigger scripts

### Benefits
- ✅ Serverless (no server management)
- ✅ Scales automatically
- ❌ Requires code changes (database migration)
- ❌ Costs money (database hosting)

---

## Recommendation

**Use GitHub Actions** - It's free, integrates with your existing repo, and handles all your use cases:
- Scheduled execution
- Manual triggers
- Full filesystem access
- Automatic commits
- No infrastructure management

The workflows are already set up in `.github/workflows/`. Just push to GitHub and they'll be available!
