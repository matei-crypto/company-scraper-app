#!/bin/bash

# Test script for Companies House scraper
# This script will scrape 10 companies with SIC codes 62020 and 62090

echo "Testing Companies House Scraper..."
echo "Target: 10 companies with SIC codes 62020 and 62090"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with your COMPANIES_HOUSE_API_KEY"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the scraper with limit of 10 companies
echo "🚀 Starting scraper..."
echo ""
npm run scrape "62020,62090" 10

echo ""
echo "✅ Scraping complete! Check /data/companies for results."

