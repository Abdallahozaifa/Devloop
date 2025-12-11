#!/bin/bash
# End DevLoop Week 1 Marketing Test
# Usage: ./scripts/end-test.sh

set -e

MARKETING_DIR="$(dirname "$0")/.."
RESULTS_FILE="$MARKETING_DIR/test-results.md"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "          DevLoop Week 1 Test - Final Evaluation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Pause all campaigns
echo -e "${YELLOW}Step 1: Pausing all campaigns...${NC}"
./scripts/pause-ads.sh all 2>/dev/null || true
echo ""

# Step 2: Generate results file
echo -e "${YELLOW}Step 2: Generating test results...${NC}"
echo ""

cat > "$RESULTS_FILE" << 'EOF'
# DevLoop Marketing Test Results - Week 1

## Test Period
- **Start Date**: December 10, 2024
- **End Date**: December 17, 2024
- **Total Budget**: $100

## Results Summary

| Platform | Budget | Spent | Clicks | CPC | Signups | CPA |
|----------|--------|-------|--------|-----|---------|-----|
| Twitter  | $25    | $___  | ___    | $___ | ___   | $___ |
| Reddit   | $25    | $___  | ___    | $___ | ___   | $___ |
| Google   | $30    | $___  | ___    | $___ | ___   | $___ |
| Facebook | $20    | $___  | ___    | $___ | ___   | $___ |
| **TOTAL**| $100   | $___  | ___    | $___ | ___   | $___ |

## Performance Analysis

### Best Performing Channel
- **Winner**: ____________
- **CPA**: $___
- **Reason**: ____________

### Worst Performing Channel
- **Loser**: ____________
- **CPA**: $___
- **Issue**: ____________

## Decision Matrix

| Platform | CPA | CTR | Decision |
|----------|-----|-----|----------|
| Twitter  | $___ | ___% | SCALE / OPTIMIZE / CUT |
| Reddit   | $___ | ___% | SCALE / OPTIMIZE / CUT |
| Google   | $___ | ___% | SCALE / OPTIMIZE / CUT |
| Facebook | $___ | ___% | SCALE / OPTIMIZE / CUT |

### Decision Criteria
- **SCALE** (CPA < $10): Increase budget 3-5x
- **OPTIMIZE** (CPA $10-20): Improve targeting/copy, retest
- **CUT** (CPA > $20 or no conversions): Stop spending

## Ad Performance

### Top Performing Ad
- **Platform**: ____________
- **Ad Variant**: ____________
- **CTR**: ____%
- **Why it worked**: ____________

### Worst Performing Ad
- **Platform**: ____________
- **Ad Variant**: ____________
- **CTR**: ____%
- **What to change**: ____________

## Key Learnings

1. ____________
2. ____________
3. ____________

## Recommendations for Week 2

### Budget Reallocation
| Platform | Week 1 | Week 2 (Recommended) |
|----------|--------|---------------------|
| Twitter  | $25    | $___ |
| Reddit   | $25    | $___ |
| Google   | $30    | $___ |
| Facebook | $20    | $___ |

### Creative Changes
- ____________
- ____________

### Targeting Changes
- ____________
- ____________

## Next Steps

1. [ ] Fill in actual numbers from ad platforms
2. [ ] Make SCALE/OPTIMIZE/CUT decisions
3. [ ] Reallocate budget based on results
4. [ ] Create new ad variants for OPTIMIZE channels
5. [ ] Launch Week 2 test (if applicable)

---
Generated: $(date)
EOF

echo -e "${GREEN}✓ Results template created: $RESULTS_FILE${NC}"
echo ""

# Step 3: Show instructions
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}NEXT STEPS:${NC}"
echo ""
echo "1. Open the results file:"
echo "   $RESULTS_FILE"
echo ""
echo "2. Fill in actual data from each platform:"
echo "   - Twitter: ads.twitter.com/analytics"
echo "   - Reddit:  ads.reddit.com"
echo "   - Google:  ads.google.com"
echo "   - Facebook: business.facebook.com/adsmanager"
echo ""
echo "3. Calculate CPA for each channel:"
echo "   CPA = Total Spent / Number of Signups"
echo ""
echo "4. Make decisions using the criteria:"
echo "   - CPA < \$10 = SCALE (increase budget 3-5x)"
echo "   - CPA \$10-20 = OPTIMIZE (tweak and retest)"
echo "   - CPA > \$20 = CUT (stop spending)"
echo ""
echo "5. Plan Week 2 based on results"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}Test evaluation complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
