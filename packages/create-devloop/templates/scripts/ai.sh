#!/bin/bash
# ai.sh - Run DevLoop AI with auto-approve (no permission prompts)
#
# This wrapper runs DevLoop AI with --dangerously-skip-permissions flag,
# which skips all permission prompts and auto-approves tool calls.
#
# WARNING: Only use this in trusted environments where you understand
# the risks of allowing DevLoop AI to execute commands without confirmation.
#
# Usage:
#   ./scripts/ai.sh "Your prompt here"
#   ./scripts/ai.sh --print "Your prompt here"
#   ./scripts/ai.sh -c  # Continue previous conversation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if devloop CLI is available
if ! command -v devloop &> /dev/null; then
    echo "DevLoop AI not found. Install it:"
    echo "   npm install -g devloop-ai"
    exit 1
fi

# Show warning banner on first use
if [ ! -f ".devloop/.ai-warned" ]; then
    echo "AUTO-APPROVE MODE"
    echo "=============================================="
    echo "Running DevLoop AI with --dangerously-skip-permissions"
    echo "DevLoop AI will execute commands WITHOUT asking."
    echo ""
    echo "This includes:"
    echo "  - File reads, writes, and deletions"
    echo "  - Shell command execution"
    echo "  - Git operations"
    echo ""
    echo "Only use this in trusted projects."
    echo "=============================================="
    echo ""
    mkdir -p .devloop
    touch .devloop/.ai-warned
fi

# Pass all arguments to devloop with auto-approve flag
exec devloop --dangerously-skip-permissions "$@"
