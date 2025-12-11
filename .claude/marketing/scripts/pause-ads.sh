#!/bin/bash
# Pause DevLoop ad campaigns
# Usage: ./scripts/pause-ads.sh [twitter|reddit|google|facebook|all]

set -e

PLATFORM=${1:-all}
MARKETING_DIR="$(dirname "$0")/.."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "              DevLoop Campaign Pause Script"
echo "═══════════════════════════════════════════════════════════"
echo ""

pause_twitter() {
    echo -e "${YELLOW}Pausing Twitter/X campaigns...${NC}"
    echo ""
    echo "Manual steps required:"
    echo "1. Go to: https://ads.twitter.com/campaign"
    echo "2. Find campaign: 'DevLoop Week1 Test'"
    echo "3. Click the campaign menu (···)"
    echo "4. Select 'Pause campaign'"
    echo ""
    echo -e "${GREEN}✓ Twitter pause instructions shown${NC}"
}

pause_reddit() {
    echo -e "${YELLOW}Pausing Reddit campaigns...${NC}"
    echo ""
    echo "Manual steps required:"
    echo "1. Go to: https://ads.reddit.com"
    echo "2. Find campaign: 'DevLoop Week1 Test'"
    echo "3. Toggle the campaign status to 'Paused'"
    echo ""
    echo -e "${GREEN}✓ Reddit pause instructions shown${NC}"
}

pause_google() {
    echo -e "${YELLOW}Pausing Google Ads campaigns...${NC}"
    echo ""
    echo "Manual steps required:"
    echo "1. Go to: https://ads.google.com"
    echo "2. Navigate to Campaigns"
    echo "3. Find: 'DevLoop Week1 Test - Search'"
    echo "4. Check the campaign box"
    echo "5. Click 'Edit' > 'Pause'"
    echo ""
    echo -e "${GREEN}✓ Google Ads pause instructions shown${NC}"
}

pause_facebook() {
    echo -e "${YELLOW}Pausing Facebook/Meta campaigns...${NC}"
    echo ""
    echo "Manual steps required:"
    echo "1. Go to: https://business.facebook.com/adsmanager"
    echo "2. Find campaign: 'DevLoop Week1 Test'"
    echo "3. Toggle the campaign status to 'Off'"
    echo ""
    echo -e "${GREEN}✓ Facebook pause instructions shown${NC}"
}

case $PLATFORM in
    twitter)
        pause_twitter
        ;;
    reddit)
        pause_reddit
        ;;
    google)
        pause_google
        ;;
    facebook)
        pause_facebook
        ;;
    all)
        pause_twitter
        echo ""
        pause_reddit
        echo ""
        pause_google
        echo ""
        pause_facebook
        ;;
    *)
        echo -e "${RED}Unknown platform: $PLATFORM${NC}"
        echo "Usage: $0 [twitter|reddit|google|facebook|all]"
        exit 1
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}Pause instructions complete!${NC}"
echo ""
echo "Remember to verify campaigns are paused in each platform's dashboard."
echo "═══════════════════════════════════════════════════════════"
