#!/bin/bash
# Create PostgreSQL on Fly.io for DevLoop

set -e

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

# Check if fly is installed
if ! command -v fly &> /dev/null; then
    error "fly CLI not found. Install with: curl -L https://fly.io/install.sh | sh"
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    error "Not logged in to Fly.io. Run: fly auth login"
fi

APP_NAME="devloop-api"
DB_NAME="devloop-db"
REGION="iad"

log "Setting up PostgreSQL for DevLoop..."

# Check if app exists
if ! fly apps list | grep -q "$APP_NAME"; then
    log "Creating Fly.io app: $APP_NAME"
    cd "$(dirname "$0")/../api"
    fly apps create "$APP_NAME" --machines
fi

# Check if database already exists
if fly postgres list | grep -q "$DB_NAME"; then
    warn "Database $DB_NAME already exists"
else
    log "Creating PostgreSQL cluster: $DB_NAME"
    fly postgres create \
        --name "$DB_NAME" \
        --region "$REGION" \
        --initial-cluster-size 1 \
        --vm-size shared-cpu-1x \
        --volume-size 1

    success "PostgreSQL cluster created!"
fi

# Attach database to app
log "Attaching database to app..."
fly postgres attach "$DB_NAME" --app "$APP_NAME" || warn "Database may already be attached"

# Get connection string
log "Getting connection string..."
CONNECTION_STRING=$(fly postgres connect -a "$DB_NAME" --database postgres --command "SELECT 1" 2>/dev/null && echo "Connected!" || echo "")

success "PostgreSQL setup complete!"
echo ""
log "Next steps:"
echo "  1. Set environment secrets:"
echo "     fly secrets set SECRET_KEY=\$(openssl rand -hex 32) -a $APP_NAME"
echo "     fly secrets set LICENSE_SECRET=\$(openssl rand -hex 32) -a $APP_NAME"
echo "     fly secrets set STRIPE_SECRET_KEY=sk_live_... -a $APP_NAME"
echo "     fly secrets set STRIPE_WEBHOOK_SECRET=whsec_... -a $APP_NAME"
echo ""
echo "  2. Deploy the API:"
echo "     ./scripts/release.sh --api"
