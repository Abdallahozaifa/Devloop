#!/bin/bash
# qa.sh - Main QA runner that orchestrates all tests
#
# Usage: ./scripts/qa.sh [command] [options]
#
# Commands:
#   all       Run full QA suite (api + ui)
#   api       Run API tests only
#   ui        Run UI tests only
#   smoke     Quick smoke test (critical paths only)
#   report    Generate QA report from last run
#   fix       Run qa-fix.sh auto-fixer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
QA_DIR="$PROJECT_DIR/.devloop/qa"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$PROJECT_DIR"

# Ensure QA directory exists
mkdir -p "$QA_DIR"

# Load environment
if [ -f ".env.qa" ]; then
    source .env.qa
fi

# Default values
DEVLOOP_API_URL=${DEVLOOP_API_URL:-"http://localhost:3000/api"}
DEVLOOP_APP_URL=${DEVLOOP_APP_URL:-"http://localhost:3000"}
TOKEN_FILE="$PROJECT_DIR/.devloop/.token"

# Auto-authenticate if no token
ensure_auth() {
    # Skip if --no-auth flag is present
    for arg in "$@"; do
        if [ "$arg" = "--no-auth" ]; then
            return 0
        fi
    done

    # Check if we already have a token
    if [ -n "$DEVLOOP_TOKEN" ]; then
        return 0
    fi

    # Try to read from cached token file
    if [ -f "$TOKEN_FILE" ]; then
        export DEVLOOP_TOKEN=$(cat "$TOKEN_FILE")
        if [ -n "$DEVLOOP_TOKEN" ]; then
            echo -e "${GREEN}Using cached auth token${NC}"
            return 0
        fi
    fi

    # Get new token
    if [ -f "$SCRIPT_DIR/get-token.sh" ]; then
        echo -e "${YELLOW}Authenticating...${NC}"
        source "$SCRIPT_DIR/get-token.sh"
        if [ -n "$DEVLOOP_TOKEN" ]; then
            return 0
        fi
    fi

    echo -e "${YELLOW}Warning: No auth token available. Protected tests will be skipped.${NC}"
    return 0
}

print_header() {
    echo -e "${BLUE}"
    echo "=============================================="
    echo "           DevLoop QA Test Suite"
    echo "=============================================="
    echo -e "${NC}"
    echo "Timestamp: $TIMESTAMP"
    echo "API: $DEVLOOP_API_URL"
    echo "URL: $DEVLOOP_APP_URL"
    echo ""
}

run_api_tests() {
    echo -e "${YELLOW}Running API Tests...${NC}"
    echo ""

    if [ -f "$SCRIPT_DIR/qa-api.sh" ]; then
        "$SCRIPT_DIR/qa-api.sh" "$@"
        API_EXIT=$?
    else
        echo -e "${RED}qa-api.sh not found${NC}"
        API_EXIT=1
    fi

    return $API_EXIT
}

run_ui_tests() {
    echo -e "${YELLOW}Running UI Tests...${NC}"
    echo ""

    if [ -f "$SCRIPT_DIR/qa-ui.sh" ]; then
        "$SCRIPT_DIR/qa-ui.sh" "$@"
        UI_EXIT=$?
    else
        echo -e "${RED}qa-ui.sh not found${NC}"
        UI_EXIT=1
    fi

    return $UI_EXIT
}

run_smoke_test() {
    echo -e "${YELLOW}Running Smoke Test (Critical Paths Only)...${NC}"
    echo ""

    # Quick API health check
    echo "Checking API health..."
    if curl -s -f "$DEVLOOP_API_URL/health" > /dev/null 2>&1 || curl -s -f "$DEVLOOP_API_URL/../health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is healthy${NC}"
    else
        echo -e "${YELLOW}⚠ API health endpoint not found (trying root)${NC}"
        if curl -s -f "$DEVLOOP_APP_URL" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ App is accessible${NC}"
        else
            echo -e "${RED}✗ App is not accessible${NC}"
            return 1
        fi
    fi

    # Quick UI check
    echo "Checking UI..."
    if curl -s -f "$DEVLOOP_APP_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ UI is accessible${NC}"
    else
        echo -e "${RED}✗ UI is not accessible${NC}"
        return 1
    fi

    echo ""
    echo -e "${GREEN}Smoke test passed!${NC}"
    return 0
}

generate_report() {
    REPORT_FILE="$QA_DIR/qa-report-$TIMESTAMP.md"

    echo "# QA Report - $TIMESTAMP" > "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "## Summary" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Count results from latest test files
    if [ -f "$QA_DIR/api-results.json" ]; then
        PASSED=$(jq '[.tests[] | select(.status == "pass")] | length' "$QA_DIR/api-results.json" 2>/dev/null || echo "0")
        FAILED=$(jq '[.tests[] | select(.status == "fail")] | length' "$QA_DIR/api-results.json" 2>/dev/null || echo "0")
        echo "### API Tests" >> "$REPORT_FILE"
        echo "- Passed: $PASSED" >> "$REPORT_FILE"
        echo "- Failed: $FAILED" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    if [ -f "$QA_DIR/ui-results.json" ]; then
        PASSED=$(jq '[.tests[] | select(.status == "pass")] | length' "$QA_DIR/ui-results.json" 2>/dev/null || echo "0")
        FAILED=$(jq '[.tests[] | select(.status == "fail")] | length' "$QA_DIR/ui-results.json" 2>/dev/null || echo "0")
        echo "### UI Tests" >> "$REPORT_FILE"
        echo "- Passed: $PASSED" >> "$REPORT_FILE"
        echo "- Failed: $FAILED" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    echo ""
    echo -e "${GREEN}Report generated: $REPORT_FILE${NC}"
    cat "$REPORT_FILE"
}

run_fix() {
    echo -e "${YELLOW}Running Auto-Fix...${NC}"
    echo ""

    if [ -f "$SCRIPT_DIR/qa-fix.sh" ]; then
        "$SCRIPT_DIR/qa-fix.sh" "$@"
    else
        echo -e "${RED}qa-fix.sh not found${NC}"
        return 1
    fi
}

show_help() {
    echo "DevLoop QA Test Suite"
    echo "====================="
    echo ""
    echo "Usage: ./scripts/qa.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  all       Run full QA suite (api + ui tests)"
    echo "  api       Run API tests only"
    echo "  ui        Run UI tests only"
    echo "  smoke     Quick smoke test (critical paths only)"
    echo "  report    Generate QA report from last run"
    echo "  fix       Run auto-fix loop with DevLoop AI"
    echo ""
    echo "Options:"
    echo "  --priority=HIGH    Run only HIGH priority tests"
    echo "  --verbose          Show detailed output"
    echo "  --no-auth          Skip authenticated tests"
    echo ""
    echo "Examples:"
    echo "  ./scripts/qa.sh smoke          # Quick health check"
    echo "  ./scripts/qa.sh api            # Run API tests"
    echo "  ./scripts/qa.sh all            # Full test suite"
    echo "  ./scripts/qa.sh fix            # Auto-fix failures"
    echo ""
    echo "Environment Variables:"
    echo "  DEVLOOP_API_URL    API base URL (default: http://localhost:3000/api)"
    echo "  DEVLOOP_APP_URL    UI base URL (default: http://localhost:3000)"
    echo "  DEVLOOP_TOKEN      Auth token for protected endpoints"
    echo ""
}

# Main command handling
case "${1:-help}" in
    all)
        print_header
        ensure_auth "${@:2}"
        FAILED=0

        run_api_tests "${@:2}" || FAILED=1
        echo ""
        run_ui_tests "${@:2}" || FAILED=1
        echo ""
        generate_report

        if [ $FAILED -eq 0 ]; then
            echo -e "${GREEN}All tests passed!${NC}"
        else
            echo -e "${RED}Some tests failed. Run './scripts/qa.sh fix' to auto-fix.${NC}"
            exit 1
        fi
        ;;

    api)
        print_header
        ensure_auth "${@:2}"
        run_api_tests "${@:2}"
        ;;

    ui)
        print_header
        ensure_auth "${@:2}"
        run_ui_tests "${@:2}"
        ;;

    smoke)
        print_header
        run_smoke_test
        ;;

    report)
        generate_report
        ;;

    fix)
        print_header
        run_fix "${@:2}"
        ;;

    help|--help|-h|*)
        show_help
        ;;
esac
