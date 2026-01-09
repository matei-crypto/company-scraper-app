#!/bin/bash

cd "/Users/user/Downloads/Company Scraper App"

while true; do
  clear
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║           CSV LOADING PROGRESS                            ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  
  TOTAL=9909
  LOADED=$(ls -1 data/companies/*.json 2>/dev/null | wc -l | tr -d ' ')
  REMAINING=$((TOTAL - LOADED))
  PERCENT=$(awk "BEGIN {printf \"%.1f\", ($LOADED/$TOTAL)*100}")
  
  echo "📊 Progress: $LOADED / $TOTAL companies ($PERCENT%)"
  echo "   Remaining: $REMAINING companies"
  echo ""
  
  SAVED=$(grep -c "Successfully saved" load_all_companies_log.txt 2>/dev/null || echo "0")
  ERRORS=$(grep -c "Error:" load_all_companies_log.txt 2>/dev/null | head -1 || echo "0")
  RATE_LIMIT=$(grep -c "429" load_all_companies_log.txt 2>/dev/null || echo "0")
  
  echo "✓ Successfully saved in this session: $SAVED companies"
  echo "✗ Total errors: $ERRORS"
  if [ "$RATE_LIMIT" != "0" ]; then
    echo "⚠ Rate limit errors (429): $RATE_LIMIT"
  fi
  echo ""
  
  echo "📝 Recent Activity:"
  echo "────────────────────────────────────────────────────────────"
  tail -10 load_all_companies_log.txt 2>/dev/null | grep -E "(Processing:|Successfully saved|Error:|429|Rate limited)" | tail -6
  echo ""
  
  echo "⏱️  Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "Press Ctrl+C to exit"
  
  sleep 5
done

