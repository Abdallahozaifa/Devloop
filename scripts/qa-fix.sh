#!/bin/bash
# qa-fix.sh - Auto-fix loop using Claude CLI
#
# Reads QA results and attempts to fix failures automatically
#
# Usage: ./scripts/qa-fix.sh [options]
#
# Options:
#   --max-attempts=N   Maximum fix attempts (default: 3)
#   --api-only         Only fix API issues
#   --ui-only          Only fix UI issues

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
QA_DIR="$PROJECT_DIR/.claude/qa"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
MAX_ATTEMPTS=${MAX_ATTEMPTS:-3}
FIX_API=true
FIX_UI=true

# Parse arguments
for arg in "$@"; do
    case $arg in
        --max-attempts=*)
            MAX_ATTEMPTS="${arg#*=}"
            ;;
        --api-only)
            FIX_UI=false
            ;;
        --ui-only)
            FIX_API=false
            ;;
    esac
done

echo "=============================================="
echo "        DevLoop Auto-Fix Loop"
echo "=============================================="
echo ""
echo "Max attempts: $MAX_ATTEMPTS"
echo ""

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude CLI not found.${NC}"
    echo "Install it with: npm install -g @anthropic-ai/claude-cli"
    exit 1
fi

# Collect failures from QA results
collect_failures() {
    local failures=""

    if [ "$FIX_API" = "true" ] && [ -f "$QA_DIR/api-results.json" ]; then
        local api_failures=$(jq -r '.tests[] | select(.status == "fail") | "API: \(.name) - \(.details)"' "$QA_DIR/api-results.json" 2>/dev/null)
        if [ -n "$api_failures" ]; then
            failures="$failures$api_failures\n"
        fi
    fi

    if [ "$FIX_UI" = "true" ] && [ -f "$QA_DIR/ui-results.json" ]; then
        local ui_failures=$(jq -r '.tests[] | select(.status == "fail") | "UI: \(.name) - \(.details)"' "$QA_DIR/ui-results.json" 2>/dev/null)
        if [ -n "$ui_failures" ]; then
            failures="$failures$ui_failures\n"
        fi
    fi

    echo -e "$failures"
}

# Count failures
count_failures() {
    local count=0

    if [ "$FIX_API" = "true" ] && [ -f "$QA_DIR/api-results.json" ]; then
        local api_count=$(jq '[.tests[] | select(.status == "fail")] | length' "$QA_DIR/api-results.json" 2>/dev/null || echo "0")
        count=$((count + api_count))
    fi

    if [ "$FIX_UI" = "true" ] && [ -f "$QA_DIR/ui-results.json" ]; then
        local ui_count=$(jq '[.tests[] | select(.status == "fail")] | length' "$QA_DIR/ui-results.json" 2>/dev/null || echo "0")
        count=$((count + ui_count))
    fi

    echo $count
}

# Main fix loop
ATTEMPT=1
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "----------------------------------------------"
    echo -e "${BLUE}Attempt $ATTEMPT of $MAX_ATTEMPTS${NC}"
    echo "----------------------------------------------"
    echo ""

    # Collect current failures
    FAILURES=$(collect_failures)
    FAILURE_COUNT=$(count_failures)

    if [ $FAILURE_COUNT -eq 0 ]; then
        echo -e "${GREEN}No failures found! All tests passing.${NC}"
        exit 0
    fi

    echo -e "${YELLOW}Found $FAILURE_COUNT failures:${NC}"
    echo -e "$FAILURES"
    echo ""

    # Create fix task for Claude
    TASK_FILE="$QA_DIR/fix-task.md"
    cat > "$TASK_FILE" << EOF
# QA Fix Task - Attempt $ATTEMPT

## Failures to Fix
$FAILURES

## Instructions
1. Analyze each failure and identify the root cause
2. Make the necessary code changes to fix the issues
3. After fixing, the QA tests will be re-run automatically

## Context
- Read .claude/INSTRUCTIONS.md for project conventions
- Read .claude/features.md for feature documentation
- Check recent git changes with \`git diff\`

## Rules
- Make minimal, targeted fixes
- Don't introduce new bugs
- Follow existing code patterns
- Add error handling where missing
EOF

    echo "Running Claude CLI to fix issues..."
    echo ""

    # Run Claude CLI with the fix task
    claude --print "You are fixing QA test failures.

READ FIRST:
- $TASK_FILE (the specific failures to fix)
- .claude/INSTRUCTIONS.md (project conventions)
- .claude/features.md (feature documentation)

YOUR JOB:
1. Analyze each failure listed in the task file
2. Find the relevant code causing the issue
3. Make targeted fixes to resolve each failure

IMPORTANT:
- Focus on the actual error messages
- Make minimal changes - don't refactor unrelated code
- If you can't fix something, document why in .claude/qa/unfixable.md

Start by reading the task file and analyzing the failures." || true

    echo ""
    echo "Claude fix attempt completed."
    echo ""

    # Re-run QA tests
    echo "Re-running QA tests..."
    echo ""

    if [ "$FIX_API" = "true" ]; then
        "$SCRIPT_DIR/qa-api.sh" --no-auth 2>/dev/null || true
    fi

    if [ "$FIX_UI" = "true" ]; then
        "$SCRIPT_DIR/qa-ui.sh" --no-vision 2>/dev/null || true
    fi

    # Check if we fixed everything
    NEW_FAILURE_COUNT=$(count_failures)

    if [ $NEW_FAILURE_COUNT -eq 0 ]; then
        echo ""
        echo -e "${GREEN}All failures fixed!${NC}"
        exit 0
    elif [ $NEW_FAILURE_COUNT -lt $FAILURE_COUNT ]; then
        echo ""
        echo -e "${YELLOW}Progress: $FAILURE_COUNT → $NEW_FAILURE_COUNT failures${NC}"
    else
        echo ""
        echo -e "${RED}No progress: still $NEW_FAILURE_COUNT failures${NC}"
    fi

    ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "=============================================="
echo -e "${RED}Max attempts reached. Some failures remain.${NC}"
echo "=============================================="
echo ""
echo "Remaining failures:"
collect_failures
echo ""
echo "Manual intervention required."
echo "Review the failures and fix manually, then run:"
echo "  ./scripts/qa.sh all"
exit 1
