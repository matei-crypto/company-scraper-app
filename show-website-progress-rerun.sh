#!/bin/bash

LOG_FILE="analyze_websites_rerun_log.txt"

if [ ! -f "$LOG_FILE" ]; then
  echo "Log file not found. Process may not have started yet."
  exit 1
fi

# Count totals
TOTAL=$(grep -c "Processing:" "$LOG_FILE" 2>/dev/null || echo "0")
ANALYZED=$(grep -c "✓ Analysis complete" "$LOG_FILE" 2>/dev/null || echo "0")
SKIPPED=$(grep -c "○.*skipping" "$LOG_FILE" 2>/dev/null || echo "0")
ERRORS=$(grep -c "✗ Error:" "$LOG_FILE" 2>/dev/null || echo "0")
FALLBACK=$(grep -c "fallback" "$LOG_FILE" 2>/dev/null || echo "0")

# Get current company being processed
CURRENT=$(grep "Processing:" "$LOG_FILE" | tail -1 | sed 's/.*Processing: //' | sed 's/─.*//' || echo "N/A")

echo "═══════════════════════════════════════════════════════════"
echo "  WEBSITE ANALYSIS PROGRESS (RERUN)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Current:     $CURRENT"
echo "  Total:       $TOTAL companies processed"
echo "  ✓ Analyzed: $ANALYZED"
echo "  ○ Skipped:   $SKIPPED"
echo "  ✗ Errors:    $ERRORS"
echo "  ⚠ Fallback:  $FALLBACK (used web search fallback)"
echo ""
echo "═══════════════════════════════════════════════════════════"
