#!/bin/bash
# DevLoop Release Script
# Deploys API to Fly.io and publishes CLI to npm

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[DevLoop]${NC} $1"; }
success() { echo -e "${GREEN}[DevLoop]${NC} $1"; }
warn() { echo -e "${YELLOW}[DevLoop]${NC} $1"; }
error() { echo -e "${RED}[DevLoop]${NC} $1"; exit 1; }

# Parse arguments
RELEASE_API=false
RELEASE_CLI=false
RELEASE_LANDING=false
VERSION=""

show_help() {
    echo "DevLoop Release Script"
    echo ""
    echo "Usage: ./scripts/release.sh [options]"
    echo ""
    echo "Options:"
    echo "  --api          Deploy API to Fly.io"
    echo "  --cli          Publish CLI to npm"
    echo "  --landing      Deploy landing page"
    echo "  --all          Release everything"
    echo "  --version      Set version (e.g., --version 1.0.0)"
    echo "  --help         Show this help"
    echo ""
    echo "Examples:"
    echo "  ./scripts/release.sh --api"
    echo "  ./scripts/release.sh --cli --version 1.0.1"
    echo "  ./scripts/release.sh --all"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --api) RELEASE_API=true; shift ;;
        --cli) RELEASE_CLI=true; shift ;;
        --landing) RELEASE_LANDING=true; shift ;;
        --all)
            RELEASE_API=true
            RELEASE_CLI=true
            RELEASE_LANDING=true
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help) show_help; exit 0 ;;
        *) error "Unknown option: $1" ;;
    esac
done

# Check if anything selected
if ! $RELEASE_API && ! $RELEASE_CLI && ! $RELEASE_LANDING; then
    show_help
    exit 1
fi

# Deploy API to Fly.io
if $RELEASE_API; then
    log "Deploying API to Fly.io..."

    cd "$ROOT_DIR/api"

    # Check if fly CLI is installed
    if ! command -v fly &> /dev/null; then
        error "fly CLI not found. Install with: curl -L https://fly.io/install.sh | sh"
    fi

    # Check if logged in
    if ! fly auth whoami &> /dev/null; then
        error "Not logged in to Fly.io. Run: fly auth login"
    fi

    # Deploy
    fly deploy --ha=false

    success "API deployed to Fly.io!"

    # Show URL
    fly status

    cd "$ROOT_DIR"
fi

# Publish CLI to npm
if $RELEASE_CLI; then
    log "Publishing CLI to npm..."

    cd "$ROOT_DIR/packages/create-devloop"

    # Check if logged in to npm
    if ! npm whoami &> /dev/null; then
        error "Not logged in to npm. Run: npm login"
    fi

    # Update version if specified
    if [[ -n "$VERSION" ]]; then
        npm version "$VERSION" --no-git-tag-version
    fi

    # Publish
    npm publish --access public

    CLI_VERSION=$(node -p "require('./package.json').version")
    success "CLI v$CLI_VERSION published to npm!"

    cd "$ROOT_DIR"
fi

# Deploy landing page
if $RELEASE_LANDING; then
    log "Building landing page..."

    cd "$ROOT_DIR/landing"

    # Build
    npm run build

    # Deploy to Vercel (or your preferred platform)
    if command -v vercel &> /dev/null; then
        log "Deploying to Vercel..."
        vercel --prod
        success "Landing page deployed to Vercel!"
    else
        warn "Vercel CLI not found. Build is ready in landing/dist/"
        warn "Install with: npm i -g vercel"
    fi

    cd "$ROOT_DIR"
fi

success "Release complete!"
