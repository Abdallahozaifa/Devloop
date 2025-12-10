#!/bin/bash
# quick.sh - Quick commands for DevLoop workflow
#
# Usage: ./scripts/quick.sh <command>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

case "$1" in

    # Paste task from clipboard (macOS)
    paste|p)
        pbpaste > .claude/task.md
        echo "Task saved to .claude/task.md"
        echo ""
        head -15 .claude/task.md
        ;;

    # Generate context
    context|c)
        if [ -f "$SCRIPT_DIR/context.sh" ]; then
            ./scripts/context.sh
        else
            echo "context.sh not found"
        fi
        ;;

    # Run Claude CLI with auto-approve
    ai)
        if [ -f "$SCRIPT_DIR/ai.sh" ]; then
            ./scripts/ai.sh "${@:2}"
        else
            claude "${@:2}"
        fi
        ;;

    # Run Claude CLI on current task
    ai-task)
        if [ -f "$SCRIPT_DIR/ai.sh" ]; then
            ./scripts/ai.sh "Read .claude/task.md and .claude/INSTRUCTIONS.md. Implement the task."
        else
            claude "Read .claude/task.md and .claude/INSTRUCTIONS.md. Implement the task."
        fi
        ;;

    # Run tests
    test|t)
        echo "Running tests..."
        if [ -f "package.json" ]; then
            npm test
        elif [ -f "requirements.txt" ]; then
            pytest
        else
            echo "No test runner detected"
        fi
        ;;

    # Build
    build|b)
        echo "Building..."
        if [ -f "package.json" ]; then
            npm run build
        else
            echo "No build script detected"
        fi
        ;;

    # Check status
    status|s)
        echo "Project Status"
        echo "=============="
        echo ""
        echo "Current task:"
        if [ -f ".claude/task.md" ]; then
            head -5 .claude/task.md
        else
            echo "  (none)"
        fi
        echo ""
        echo "Git status:"
        git status --short 2>/dev/null || echo "  Not a git repo"
        echo ""
        echo "Recent commits:"
        git log --oneline -5 2>/dev/null || echo "  No commits"
        ;;

    # Clear task
    clear)
        rm -f .claude/task.md .claude/result.md .claude/errors.md .claude/logs.txt
        echo "Cleared task files"
        ;;

    # QA - Full suite
    qa)
        ./scripts/qa.sh "${2:-all}" "${@:3}"
        ;;

    # QA - API tests only
    qa-api)
        ./scripts/qa-api.sh "${@:2}"
        ;;

    # QA - UI tests only
    qa-ui)
        ./scripts/qa-ui.sh "${@:2}"
        ;;

    # QA - Smoke test
    smoke)
        ./scripts/qa.sh smoke
        ;;

    # QA - Auto-fix failures
    qa-fix)
        ./scripts/qa-fix.sh "${@:2}"
        ;;

    # QA - Generate report
    qa-report)
        ./scripts/qa.sh report
        ;;

    # Show help
    *)
        echo "DevLoop Quick Commands"
        echo "======================"
        echo ""
        echo "Usage: ./scripts/quick.sh <command>"
        echo ""
        echo "Commands:"
        echo ""
        echo "  Task Management:"
        echo "    paste, p       Paste task from clipboard to .claude/task.md"
        echo "    context, c     Generate fresh codebase context"
        echo "    clear          Clear task files"
        echo ""
        echo "  Development:"
        echo "    ai [prompt]    Run Claude CLI with prompt"
        echo "    ai-task        Run Claude CLI on current task"
        echo "    test, t        Run tests"
        echo "    build, b       Build project"
        echo "    status, s      Show project status"
        echo ""
        echo "  QA Testing:"
        echo "    qa [command]   Run QA suite (all/api/ui/smoke/report)"
        echo "    qa-api         Run API tests only"
        echo "    qa-ui          Run UI tests only"
        echo "    smoke          Quick smoke test"
        echo "    qa-fix         Auto-fix failures with AI"
        echo "    qa-report      Generate QA report"
        echo ""
        echo "Examples:"
        echo "  ./scripts/quick.sh smoke           # Quick health check"
        echo "  ./scripts/quick.sh qa              # Full QA suite"
        echo "  ./scripts/quick.sh qa-fix          # Auto-fix failures"
        echo "  ./scripts/quick.sh ai 'Fix bug X'  # Run Claude on prompt"
        ;;
esac
