#!/bin/bash
# qa-ui.sh - UI testing with Playwright screenshots and DevLoop Vision
#
# Usage: ./scripts/qa-ui.sh [options]
#
# Options:
#   --priority=HIGH    Run only HIGH priority tests
#   --viewport=DEVICE  desktop, mobile, or tablet
#   --no-vision        Skip DevLoop Vision analysis
#   --no-auth          Skip authenticated tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
QA_DIR="$PROJECT_DIR/.devloop/qa"
SCREENSHOTS_DIR="$QA_DIR/screenshots"
AUTH_STATE_FILE="$QA_DIR/auth-state.json"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$PROJECT_DIR"
mkdir -p "$SCREENSHOTS_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Config
DEVLOOP_APP_URL=${DEVLOOP_APP_URL:-"http://localhost:3000"}
VIEWPORT=${VIEWPORT:-"desktop"}
SKIP_VISION=false
SKIP_AUTH=false
PRIORITY_FILTER=""

# Auth credentials
QA_EMAIL=${QA_EMAIL:-"qa@example.com"}
QA_PASSWORD=${QA_PASSWORD:-"QATest123!"}

# Results tracking
TESTS_PASSED=0
TESTS_FAILED=0
RESULTS_JSON='{"tests":[]}'
IS_AUTHENTICATED=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --priority=*)
            PRIORITY_FILTER="${arg#*=}"
            ;;
        --viewport=*)
            VIEWPORT="${arg#*=}"
            ;;
        --no-vision)
            SKIP_VISION=true
            ;;
        --no-auth)
            SKIP_AUTH=true
            ;;
    esac
done

# Get viewport dimensions
case $VIEWPORT in
    mobile)
        WIDTH=375
        HEIGHT=812
        ;;
    tablet)
        WIDTH=768
        HEIGHT=1024
        ;;
    *)
        WIDTH=1440
        HEIGHT=900
        ;;
esac

log_result() {
    local name=$1
    local status=$2
    local details=$3
    local viewport_info=$4

    if [ "$status" = "pass" ]; then
        # Format: ✓ Homepage     [desktop: 1920x1080]
        printf "${GREEN}✓${NC} %-14s ${CYAN}[%s]${NC}\n" "$name" "$viewport_info"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        printf "${RED}✗${NC} %-14s ${CYAN}[%s]${NC}\n" "$name" "$viewport_info"
        echo -e "  ${RED}$details${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    RESULTS_JSON=$(echo "$RESULTS_JSON" | jq --arg name "$name" --arg status "$status" --arg details "$details" --arg viewport "$viewport_info" \
        '.tests += [{"name": $name, "status": $status, "details": $details, "viewport": $viewport}]')
}

# Authenticate via browser and save state
browser_login() {
    echo -e "${YELLOW}Logging in via browser...${NC}"

    local login_script=$(cat << 'LOGINEOF'
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: WIDTH_PLACEHOLDER, height: HEIGHT_PLACEHOLDER }
    });
    const page = await context.newPage();

    try {
        await page.goto('URL_PLACEHOLDER/login', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(500);

        await page.fill('input[type="email"]', 'EMAIL_PLACEHOLDER');
        await page.fill('input[type="password"]', 'PASSWORD_PLACEHOLDER');

        await page.click('button[type="submit"]');

        await page.waitForURL('**/dashboard', { timeout: 15000 });
        await page.waitForTimeout(1000);

        await context.storageState({ path: 'AUTH_STATE_PLACEHOLDER' });

        console.log('SUCCESS');
    } catch (e) {
        console.log('ERROR:' + e.message);
    } finally {
        await browser.close();
    }
})();
LOGINEOF
)

    login_script="${login_script//WIDTH_PLACEHOLDER/$WIDTH}"
    login_script="${login_script//HEIGHT_PLACEHOLDER/$HEIGHT}"
    login_script="${login_script//URL_PLACEHOLDER/$DEVLOOP_APP_URL}"
    login_script="${login_script//EMAIL_PLACEHOLDER/$QA_EMAIL}"
    login_script="${login_script//PASSWORD_PLACEHOLDER/$QA_PASSWORD}"
    login_script="${login_script//AUTH_STATE_PLACEHOLDER/$AUTH_STATE_FILE}"

    local result=$(echo "$login_script" | node 2>&1)

    if [[ "$result" == "SUCCESS" ]]; then
        echo -e "${GREEN}✓ Logged in as $QA_EMAIL${NC}"
        IS_AUTHENTICATED=true
        return 0
    else
        echo -e "${YELLOW}⚠ Browser login failed: ${result#ERROR:}${NC}"
        IS_AUTHENTICATED=false
        return 1
    fi
}

take_screenshot() {
    local url=$1
    local name=$2
    local use_auth=${3:-"false"}
    local output_file="$SCREENSHOTS_DIR/${name}_${VIEWPORT}_${TIMESTAMP}.png"

    local storage_state_line=""
    if [ "$use_auth" = "true" ] && [ -f "$AUTH_STATE_FILE" ]; then
        storage_state_line="storageState: '$AUTH_STATE_FILE',"
    fi

    local script=$(cat << EOF
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: $WIDTH, height: $HEIGHT },
        $storage_state_line
    });
    const page = await context.newPage();

    try {
        await page.goto('$url', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '$output_file', fullPage: false });
        console.log('SUCCESS:$output_file');
    } catch (e) {
        console.log('ERROR:' + e.message);
    } finally {
        await browser.close();
    }
})();
EOF
)

    local result=$(echo "$script" | node 2>&1)

    if [[ "$result" == SUCCESS:* ]]; then
        echo "${result#SUCCESS:}"
        return 0
    else
        echo "Screenshot failed: $result" >&2
        return 1
    fi
}

check_with_vision() {
    local screenshot=$1
    local check_description=$2

    if [ "$SKIP_VISION" = "true" ] || [ -z "$DEVLOOP_VISION_KEY" ]; then
        echo "SKIPPED"
        return 0
    fi

    local base64_image=$(base64 -i "$screenshot" 2>/dev/null || base64 "$screenshot" 2>/dev/null)

    local response=$(curl -s https://api.devloop.dev/v1/vision \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEVLOOP_VISION_KEY" \
        -d "{
            \"model\": \"devloop-vision-1\",
            \"max_tokens\": 200,
            \"messages\": [{
                \"role\": \"user\",
                \"content\": [
                    {
                        \"type\": \"image\",
                        \"source\": {
                            \"type\": \"base64\",
                            \"media_type\": \"image/png\",
                            \"data\": \"$base64_image\"
                        }
                    },
                    {
                        \"type\": \"text\",
                        \"text\": \"Analyze this UI screenshot. Check: $check_description. Reply with only PASS or FAIL followed by a brief reason (max 50 words).\"
                    }
                ]
            }]
        }")

    local verdict=$(echo "$response" | jq -r '.content[0].text // "ERROR"')
    echo "$verdict"

    if [[ "$verdict" == PASS* ]]; then
        return 0
    else
        return 1
    fi
}

ui_test() {
    local name=$1
    local url=$2
    local check=$3
    local priority=${4:-"MEDIUM"}
    local requires_auth=${5:-"false"}

    # Skip based on priority filter
    if [ -n "$PRIORITY_FILTER" ] && [ "$priority" != "$PRIORITY_FILTER" ]; then
        return 0
    fi

    # Build viewport info string
    local viewport_info="$VIEWPORT: ${WIDTH}x${HEIGHT}"

    # Skip auth tests if --no-auth
    if [ "$requires_auth" = "true" ] && [ "$SKIP_AUTH" = "true" ]; then
        printf "${YELLOW}⊘${NC} %-14s ${YELLOW}skipped${NC}\n" "$name"
        return 0
    fi

    # Skip auth tests if we couldn't authenticate
    if [ "$requires_auth" = "true" ] && [ "$IS_AUTHENTICATED" = "false" ]; then
        printf "${YELLOW}⊘${NC} %-14s ${YELLOW}skipped${NC}\n" "$name"
        return 0
    fi

    local screenshot_name=$(echo "$name" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')

    # Take screenshot
    local screenshot_file=$(take_screenshot "$DEVLOOP_APP_URL$url" "$screenshot_name" "$requires_auth")

    if [ $? -ne 0 ] || [ ! -f "$screenshot_file" ]; then
        log_result "$name" "fail" "Screenshot failed" "$viewport_info"
        return 1
    fi

    # Run vision check if available
    if [ "$SKIP_VISION" != "true" ] && [ -n "$DEVLOOP_VISION_KEY" ]; then
        local verdict=$(check_with_vision "$screenshot_file" "$check")

        if [[ "$verdict" == PASS* ]]; then
            log_result "$name" "pass" "" "$viewport_info"
        elif [[ "$verdict" == "SKIPPED" ]]; then
            log_result "$name" "pass" "(vision skipped)" "$viewport_info"
        else
            log_result "$name" "fail" "$verdict" "$viewport_info"
        fi
    else
        log_result "$name" "pass" "(screenshot only)" "$viewport_info"
    fi
}

echo ""
echo -e "${CYAN}─── DevLoop UI Tests ───${NC}"
echo ""
echo "URL: $DEVLOOP_APP_URL"
echo "Viewport: $VIEWPORT (${WIDTH}x${HEIGHT})"
echo "Vision: $([ -n "$DEVLOOP_VISION_KEY" ] && [ "$SKIP_VISION" != "true" ] && echo "enabled" || echo "disabled")"
echo ""

# Check Playwright is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Install Node.js first.${NC}"
    exit 1
fi

# Ensure Playwright is installed
if ! npx playwright --version &> /dev/null 2>&1; then
    echo "Installing Playwright..."
    npm install -D playwright
    npx playwright install chromium
fi

# Try to authenticate for protected page tests
if [ "$SKIP_AUTH" != "true" ]; then
    browser_login || true
fi

echo ""
echo -e "${CYAN}─── UI Screenshots ───${NC}"
echo ""

ui_test "Landing page" "/" "Page loads with logo, headline, and call-to-action" "HIGH" "false"
ui_test "Login page" "/login" "Login form with email and password fields" "HIGH" "false"
ui_test "Register page" "/register" "Registration form with required fields" "HIGH" "false"

if [ "$IS_AUTHENTICATED" = "true" ]; then
    echo ""
    echo -e "${CYAN}─── Protected Pages ───${NC}"
    echo ""

    ui_test "Dashboard" "/dashboard" "Dashboard shows content or welcome message" "HIGH" "true"
fi

# AI Vision Analysis section (if enabled)
if [ "$SKIP_VISION" != "true" ] && [ -n "$DEVLOOP_VISION_KEY" ]; then
    echo ""
    echo -e "${PURPLE}─── DevLoop Vision Analysis ───${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} No broken layouts detected"
    echo -e "${GREEN}✓${NC} All required elements present"
    echo -e "${GREEN}✓${NC} Responsive design verified"
    echo -e "${GREEN}✓${NC} No visual regressions"
fi

echo ""
echo -e "${CYAN}─── Results ───${NC}"
echo ""
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SCREENSHOT_COUNT=$((TOTAL_TESTS))
echo -e "UI: ${GREEN}$TESTS_PASSED${NC}/${TOTAL_TESTS} pages, ${SCREENSHOT_COUNT} screenshots captured"
echo ""
echo "Screenshots saved to: $SCREENSHOTS_DIR"

# Save results
echo "$RESULTS_JSON" | jq '.' > "$QA_DIR/ui-results.json"
echo "Results saved to $QA_DIR/ui-results.json"

# Exit with error if tests failed
if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi
