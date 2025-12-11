#!/bin/bash
# DevLoop Marketing Report - Check campaign performance
# Usage: ./scripts/marketing-report.sh

set -e

MARKETING_DIR="$(dirname "$0")/.."
DATA_FILE="$MARKETING_DIR/spend-tracker.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Budget limits
TOTAL_BUDGET=100
ALERT_THRESHOLD=80
TWITTER_BUDGET=25
REDDIT_BUDGET=25
GOOGLE_BUDGET=30
FACEBOOK_BUDGET=20

# Campaign dates
START_DATE="2024-12-10"
END_DATE="2024-12-17"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "          DevLoop Marketing Report - Week 1 Test"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Calculate days remaining
TODAY=$(date +%Y-%m-%d)
DAYS_REMAINING=$(( ($(date -d "$END_DATE" +%s) - $(date -d "$TODAY" +%s)) / 86400 ))

if [ $DAYS_REMAINING -lt 0 ]; then
    DAYS_REMAINING=0
fi

echo -e "${BLUE}Campaign Period:${NC} $START_DATE to $END_DATE"
echo -e "${BLUE}Days Remaining:${NC} $DAYS_REMAINING"
echo ""

# Initialize spend data if file doesn't exist
if [ ! -f "$DATA_FILE" ]; then
    cat > "$DATA_FILE" << 'EOF'
{
  "last_updated": "",
  "platforms": {
    "twitter": { "spent": 0, "clicks": 0, "impressions": 0, "signups": 0 },
    "reddit": { "spent": 0, "clicks": 0, "impressions": 0, "signups": 0 },
    "google": { "spent": 0, "clicks": 0, "impressions": 0, "signups": 0 },
    "facebook": { "spent": 0, "clicks": 0, "impressions": 0, "signups": 0 }
  }
}
EOF
fi

# Read current spend (in production, this would fetch from APIs)
echo "┌─────────────┬──────────┬───────────┬────────┬───────┬─────────┐"
echo "│ Platform    │ Budget   │ Spent     │ Remain │ CPC   │ Clicks  │"
echo "├─────────────┼──────────┼───────────┼────────┼───────┼─────────┤"

# Function to display platform row
show_platform() {
    local name=$1
    local budget=$2
    local spent=$3
    local clicks=$4

    local remaining=$(echo "$budget - $spent" | bc)
    local cpc="N/A"
    if [ "$clicks" -gt 0 ]; then
        cpc=$(echo "scale=2; $spent / $clicks" | bc)
    fi

    # Color coding for spend
    local spend_pct=$(echo "scale=0; $spent * 100 / $budget" | bc)
    local color=$GREEN
    if [ "$spend_pct" -gt 80 ]; then
        color=$RED
    elif [ "$spend_pct" -gt 50 ]; then
        color=$YELLOW
    fi

    printf "│ %-11s │ \$%-7.2f │ ${color}\$%-8.2f${NC} │ \$%-5.2f │ \$%-4s │ %-7d │\n" \
        "$name" "$budget" "$spent" "$remaining" "$cpc" "$clicks"
}

# Display each platform (replace with actual API data)
show_platform "Twitter" $TWITTER_BUDGET 0 0
show_platform "Reddit" $REDDIT_BUDGET 0 0
show_platform "Google" $GOOGLE_BUDGET 0 0
show_platform "Facebook" $FACEBOOK_BUDGET 0 0

echo "└─────────────┴──────────┴───────────┴────────┴───────┴─────────┘"
echo ""

# Total calculations
TOTAL_SPENT=0  # Replace with actual sum
TOTAL_REMAINING=$(echo "$TOTAL_BUDGET - $TOTAL_SPENT" | bc)
TOTAL_CLICKS=0  # Replace with actual sum

echo "┌─────────────────────────────────────────────────────────────┐"
printf "│ ${BLUE}TOTAL BUDGET:${NC}  \$%-8.2f                                  │\n" $TOTAL_BUDGET
printf "│ ${GREEN}TOTAL SPENT:${NC}   \$%-8.2f                                  │\n" $TOTAL_SPENT
printf "│ ${YELLOW}REMAINING:${NC}     \$%-8.2f                                  │\n" $TOTAL_REMAINING
printf "│ ${BLUE}TOTAL CLICKS:${NC}  %-8d                                  │\n" $TOTAL_CLICKS
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

# Budget warning
if [ $(echo "$TOTAL_SPENT > $ALERT_THRESHOLD" | bc) -eq 1 ]; then
    echo -e "${RED}⚠️  WARNING: Approaching budget limit! ($TOTAL_SPENT / $TOTAL_BUDGET)${NC}"
    echo ""
fi

# Instructions
echo "─── Manual Update Instructions ───"
echo ""
echo "To update spend data manually, edit: $DATA_FILE"
echo ""
echo "Or fetch from ad platforms:"
echo "  Twitter: ads.twitter.com/analytics"
echo "  Reddit:  ads.reddit.com"
echo "  Google:  ads.google.com"
echo "  Facebook: business.facebook.com/adsmanager"
echo ""
echo "─── Quick Actions ───"
echo ""
echo "  Pause all campaigns:  ./scripts/pause-ads.sh all"
echo "  End test early:       ./scripts/end-test.sh"
echo ""
