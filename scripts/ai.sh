#!/bin/bash
# ai.sh - Run Claude CLI with auto-approve (no permission prompts)
#
# This wrapper runs Claude CLI with --dangerously-skip-permissions flag,
# which skips all permission prompts and auto-approves tool calls.
#
# WARNING: Only use this in trusted environments where you understand
# the risks of allowing Claude to execute commands without confirmation.
#
# Usage:
#   ./scripts/ai.sh "Your prompt here"
#   ./scripts/ai.sh --print "Your prompt here"
#   ./scripts/ai.sh -c  # Continue previous conversation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "Claude CLI not found. Install it:"
    echo "   npm install -g @anthropic-ai/claude-cli"
    exit 1
fi

# Show warning banner on first use
if [ ! -f ".claude/.ai-warned" ]; then
    echo "AUTO-APPROVE MODE"
    echo "=============================================="
    echo "Running Claude with --dangerously-skip-permissions"
    echo "Claude will execute commands WITHOUT asking."
    echo ""
    echo "This includes:"
    echo "  - File reads, writes, and deletions"
    echo "  - Shell command execution"
    echo "  - Git operations"
    echo ""
    echo "Only use this in trusted projects."
    echo "=============================================="
    echo ""
    mkdir -p .claude
    touch .claude/.ai-warned
fi

# Pass all arguments to claude with auto-approve flag
exec claude --dangerously-skip-permissions "$@"
