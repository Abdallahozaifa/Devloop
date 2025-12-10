#!/bin/bash
# context.sh - Generates codebase context for AI tools
# Run this to give DevLoop AI fresh context about your project

set -e

OUT=".devloop/codebase.md"
PROJECT_NAME=$(basename "$(pwd)")

echo "Generating codebase context..."

cat > "$OUT" << EOF
# Codebase Context: $PROJECT_NAME

> Auto-generated: $(date)
> This file is read by AI tools for context

EOF

# File structure
echo "## File Structure" >> "$OUT"
echo '```' >> "$OUT"
if command -v tree &> /dev/null; then
    tree -I 'node_modules|.git|dist|build|__pycache__|.venv|.next|coverage|.pytest_cache' --dirsfirst -L 3 2>/dev/null >> "$OUT" || find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.js" -o -name "*.jsx" | head -50 >> "$OUT"
else
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.js" -o -name "*.jsx" \) | grep -v node_modules | grep -v .git | head -50 >> "$OUT"
fi
echo '```' >> "$OUT"
echo "" >> "$OUT"

# Git status
echo "## Git Status" >> "$OUT"
echo '```' >> "$OUT"
git status --short 2>/dev/null >> "$OUT" || echo "Not a git repo" >> "$OUT"
echo '```' >> "$OUT"
echo "" >> "$OUT"

# Recent commits
echo "## Recent Changes" >> "$OUT"
echo '```' >> "$OUT"
git log --oneline -10 2>/dev/null >> "$OUT" || echo "No git history" >> "$OUT"
echo '```' >> "$OUT"
echo "" >> "$OUT"

# Package.json dependencies
if [ -f "package.json" ]; then
    echo "## Dependencies (package.json)" >> "$OUT"
    echo '```json' >> "$OUT"
    cat package.json | grep -A 50 '"dependencies"' | head -30 >> "$OUT"
    echo '```' >> "$OUT"
    echo "" >> "$OUT"
fi

# Python requirements
if [ -f "requirements.txt" ]; then
    echo "## Dependencies (requirements.txt)" >> "$OUT"
    echo '```' >> "$OUT"
    cat requirements.txt >> "$OUT"
    echo '```' >> "$OUT"
    echo "" >> "$OUT"
fi

# Current task if exists
if [ -f ".devloop/task.md" ]; then
    echo "## Current Task" >> "$OUT"
    cat .devloop/task.md >> "$OUT"
    echo "" >> "$OUT"
fi

# Known errors if exist
if [ -f ".devloop/errors.md" ]; then
    echo "## Known Errors" >> "$OUT"
    cat .devloop/errors.md >> "$OUT"
    echo "" >> "$OUT"
fi

echo "Generated $OUT ($(wc -l < "$OUT") lines)"
