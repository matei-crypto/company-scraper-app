#!/bin/bash

cd "/Users/user/Downloads/Company Scraper App"

while true; do
  clear
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║        WEBSITE ANALYSIS PROGRESS                         ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  
  # Count companies with websites
  WITH_WEBSITE=$(node -e "
    const fs = require('fs');
    const files = fs.readdirSync('data/companies').filter(f => f.endsWith('.json'));
    let count = 0;
    files.forEach(f => {
      try {
        const d = JSON.parse(fs.readFileSync(\`data/companies/\${f}\`, 'utf8'));
        if (d.enrichment?.website) count++;
      } catch(e) {}
    });
    console.log(count);
  " 2>/dev/null || echo "0")
  
  # Count analyzed companies
  ANALYZED=$(node -e "
    const fs = require('fs');
    const files = fs.readdirSync('data/companies').filter(f => f.endsWith('.json'));
    let count = 0;
    files.forEach(f => {
      try {
        const d = JSON.parse(fs.readFileSync(\`data/companies/\${f}\`, 'utf8'));
        if (d.enrichment?.website && d.enrichment?.business_keywords && d.enrichment.business_keywords.length > 0) count++;
      } catch(e) {}
    });
    console.log(count);
  " 2>/dev/null || echo "0")
  
  # Count from log file
  LOG_ANALYZED=$(grep -c "Analysis complete" analyze_websites_log.txt 2>/dev/null || echo "0")
  LOG_SKIPPED=$(grep -c "Already analyzed" analyze_websites_log.txt 2>/dev/null || echo "0")
  LOG_ERRORS=$(grep -c "Error:" analyze_websites_log.txt 2>/dev/null || echo "0")
  
  REMAINING=$((WITH_WEBSITE - ANALYZED))
  PERCENT=$(awk "BEGIN {printf \"%.1f\", ($ANALYZED/$WITH_WEBSITE)*100}" 2>/dev/null || echo "0")
  
  echo "📊 Progress: $ANALYZED / $WITH_WEBSITE companies ($PERCENT%)"
  echo "   Remaining: $REMAINING companies"
  echo ""
  
  echo "✓ Analyzed in this session: $LOG_ANALYZED companies"
  echo "○ Skipped (already done): $LOG_SKIPPED companies"
  echo "✗ Errors: $LOG_ERRORS companies"
  echo ""
  
  echo "📝 Recent Activity:"
  echo "────────────────────────────────────────────────────────────"
  tail -8 analyze_websites_log.txt 2>/dev/null | grep -E "(Processing:|Analysis complete|Keywords:|Tech Stack:|Error:|Already analyzed)" | tail -6
  echo ""
  
  echo "⏱️  Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "Press Ctrl+C to exit"
  
  sleep 3
done

