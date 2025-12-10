#!/bin/bash
# qa-api.sh - API endpoint testing
#
# Usage: ./scripts/qa-api.sh [options]
#
# Options:
#   --priority=HIGH    Run only HIGH priority tests
#   --verbose          Show full response bodies
#   --no-auth          Skip authenticated tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
QA_DIR="$PROJECT_DIR/.devloop/qa"

cd "$PROJECT_DIR"
mkdir -p "$QA_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Config
DEVLOOP_API_URL=${DEVLOOP_API_URL:-"http://localhost:3000/api"}
TOKEN_FILE="$PROJECT_DIR/.devloop/.token"
VERBOSE=false
PRIORITY_FILTER=""
SKIP_AUTH=false
TOKEN="${DEVLOOP_TOKEN:-""}"

# Results tracking
TESTS_PASSED=0
TESTS_FAILED=0
RESULTS_JSON='{"tests":[]}'

# Parse arguments
for arg in "$@"; do
    case $arg in
        --priority=*)
            PRIORITY_FILTER="${arg#*=}"
            ;;
        --verbose)
            VERBOSE=true
            ;;
        --no-auth)
            SKIP_AUTH=true
            ;;
    esac
done

log_result() {
    local name=$1
    local status=$2
    local details=$3
    local method=$4
    local endpoint=$5
    local code=$6
    local time=$7

    if [ "$status" = "pass" ]; then
        # Format: ✓ GET  /api/health        200 OK     [2ms]
        printf "${GREEN}✓${NC} %-6s %-20s ${GREEN}%s${NC}     [%sms]\n" "$method" "$endpoint" "$code" "$time"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        printf "${RED}✗${NC} %-6s %-20s ${RED}%s${NC}     [%sms]\n" "$method" "$endpoint" "$code" "$time"
        echo -e "  ${RED}$details${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Add to JSON results
    RESULTS_JSON=$(echo "$RESULTS_JSON" | jq --arg name "$name" --arg status "$status" --arg details "$details" \
        --arg method "$method" --arg endpoint "$endpoint" --arg code "$code" --arg time "$time" \
        '.tests += [{"name": $name, "status": $status, "details": $details, "method": $method, "endpoint": $endpoint, "code": $code, "time_ms": $time}]')
}

api_test() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_code=$4
    local data=$5
    local auth_required=$6
    local priority=${7:-"MEDIUM"}

    # Skip based on priority filter
    if [ -n "$PRIORITY_FILTER" ] && [ "$priority" != "$PRIORITY_FILTER" ]; then
        return 0
    fi

    # Skip auth tests if requested
    if [ "$auth_required" = "true" ] && [ "$SKIP_AUTH" = "true" ]; then
        printf "${YELLOW}⊘${NC} %-6s %-20s ${YELLOW}skipped${NC}\n" "$method" "$endpoint"
        return 0
    fi

    local url="$DEVLOOP_API_URL$endpoint"
    # Use curl write-out to capture both status code and time
    local curl_args="-s -w '%{http_code} %{time_total}' -o /tmp/qa_response.json"

    # Add auth header if needed and token available
    if [ "$auth_required" = "true" ] && [ -n "$TOKEN" ]; then
        curl_args="$curl_args -H 'Authorization: Bearer $TOKEN'"
    fi

    # Add content type for POST/PUT/PATCH
    if [ "$method" != "GET" ] && [ "$method" != "DELETE" ]; then
        curl_args="$curl_args -H 'Content-Type: application/json'"
    fi

    # Add data if provided
    if [ -n "$data" ]; then
        curl_args="$curl_args -d '$data'"
    fi

    # Execute request and capture response code + time
    local curl_output=$(eval "curl $curl_args -X $method '$url'" 2>/dev/null | tr -d "'")
    local response_code=$(echo "$curl_output" | awk '{print $1}')
    local time_seconds=$(echo "$curl_output" | awk '{print $2}')

    # Convert seconds to milliseconds (integer)
    local time_ms=$(echo "$time_seconds" | awk '{printf "%.0f", $1 * 1000}')

    if [ "$VERBOSE" = "true" ] && [ -f /tmp/qa_response.json ]; then
        echo "Response: $(cat /tmp/qa_response.json | head -c 200)"
    fi

    # Check result - supports multiple expected codes (e.g., "401|403")
    if [[ "$expected_code" == *"|"* ]]; then
        if [[ "$expected_code" == *"$response_code"* ]]; then
            log_result "$name" "pass" "" "$method" "$endpoint" "$response_code" "$time_ms"
        else
            log_result "$name" "fail" "Expected $expected_code, got $response_code" "$method" "$endpoint" "$response_code" "$time_ms"
        fi
    else
        if [ "$response_code" = "$expected_code" ]; then
            log_result "$name" "pass" "" "$method" "$endpoint" "$response_code" "$time_ms"
        else
            log_result "$name" "fail" "Expected $expected_code, got $response_code" "$method" "$endpoint" "$response_code" "$time_ms"
        fi
    fi
}

authenticate() {
    # First check if we already have a token
    if [ -n "$TOKEN" ]; then
        echo -e "${GREEN}Using token from environment${NC}"
        return 0
    fi

    # Try to read from cached token file
    if [ -f "$TOKEN_FILE" ]; then
        TOKEN=$(cat "$TOKEN_FILE")
        if [ -n "$TOKEN" ]; then
            echo -e "${GREEN}Using cached token${NC}"
            return 0
        fi
    fi

    # Try manual authentication
    echo -e "${YELLOW}Authenticating...${NC}"

    local email=${QA_EMAIL:-"qa@example.com"}
    local password=${QA_PASSWORD:-"QATest123!"}

    local response=$(curl -s -X POST "$DEVLOOP_API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")

    TOKEN=$(echo "$response" | jq -r '.token // .access_token // empty')

    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo -e "${GREEN}✓ Authenticated as $email${NC}"
        mkdir -p "$(dirname "$TOKEN_FILE")"
        echo "$TOKEN" > "$TOKEN_FILE"
        chmod 600 "$TOKEN_FILE"
        return 0
    else
        echo -e "${YELLOW}⚠ Authentication failed - running unauthenticated tests only${NC}"
        SKIP_AUTH=true
        return 1
    fi
}

echo ""
echo -e "${CYAN}─── DevLoop API Tests ───${NC}"
echo ""
echo "API: $DEVLOOP_API_URL"
echo ""

# Try to authenticate
if [ "$SKIP_AUTH" != "true" ]; then
    authenticate || true
fi

echo ""
echo -e "${CYAN}─── Public Endpoints ───${NC}"
echo ""

# Health check
api_test "Health check" "GET" "/health" "200" "" "false" "HIGH"

# Auth - public endpoints
api_test "Login - invalid credentials" "POST" "/auth/login" "401" '{"email":"fake@test.com","password":"wrong"}' "false" "HIGH"
api_test "Login - missing fields" "POST" "/auth/login" "400|422" '{}' "false" "HIGH"

echo ""
echo -e "${CYAN}─── Protected Endpoints ───${NC}"
echo ""

if [ "$SKIP_AUTH" != "true" ] && [ -n "$TOKEN" ]; then
    # Auth - protected
    api_test "Get current user" "GET" "/auth/me" "200" "" "true" "HIGH"

    # Add your protected endpoint tests here
    # Example:
    # api_test "List resources" "GET" "/resources" "200" "" "true" "HIGH"
else
    echo -e "${YELLOW}Skipping authenticated tests - no valid token${NC}"
fi

echo ""
echo -e "${CYAN}─── Unauthorized Access Tests ───${NC}"
echo ""

# Test that protected endpoints reject unauthenticated requests
api_test "Protected endpoint without auth" "GET" "/auth/me" "401|403" "" "false" "HIGH"

echo ""
echo -e "${CYAN}─── Results ───${NC}"
echo ""
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo -e "API: ${GREEN}$TESTS_PASSED${NC}/${TOTAL_TESTS} endpoints passed"
echo ""

# Save results
echo "$RESULTS_JSON" | jq '.' > "$QA_DIR/api-results.json"
echo "Results saved to $QA_DIR/api-results.json"

# Exit with error if tests failed
if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi
