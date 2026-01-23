#!/bin/bash

# =============================================================================
# MerchOps Local Development Setup Script
# =============================================================================
# This script sets up a complete local development environment with a single
# command. It handles Docker services, database migrations, and dependency
# installation.
#
# Ports (non-standard to avoid conflicts):
#   - Next.js: 3847 (instead of 3000)
#   - PostgreSQL: 5847 (instead of 5432)
#   - Redis: 6847 (instead of 6379)
#
# Usage:
#   pnpm setup        # Full setup
#   ./scripts/setup.sh --skip-deps    # Skip pnpm install
#   ./scripts/setup.sh --reset        # Reset all data (fresh start)
# =============================================================================

set -e

# Configuration
POSTGRES_PORT=5847
REDIS_PORT=6847
NEXTJS_PORT=3847
MAX_WAIT_SECONDS=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse arguments
SKIP_DEPS=false
RESET_DATA=false
SEED_DATA=false

for arg in "$@"; do
  case $arg in
    --skip-deps)
      SKIP_DEPS=true
      shift
      ;;
    --reset)
      RESET_DATA=true
      shift
      ;;
    --seed)
      SEED_DATA=true
      shift
      ;;
    *)
      ;;
  esac
done

# Helper functions
print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}============================================${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}============================================${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_info() {
    echo -e "    $1"
}

# Check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        case "$1" in
            docker)
                echo "    Install Docker: https://docs.docker.com/get-docker/"
                ;;
            pnpm)
                echo "    Install pnpm: npm install -g pnpm"
                ;;
            node)
                echo "    Install Node.js: https://nodejs.org/"
                ;;
        esac
        exit 1
    fi
}

# Wait for a service to be ready
wait_for_service() {
    local name=$1
    local host=$2
    local port=$3
    local check_cmd=$4
    local seconds=0

    print_step "Waiting for $name to be ready..."

    while [ $seconds -lt $MAX_WAIT_SECONDS ]; do
        if eval "$check_cmd" &> /dev/null; then
            print_success "$name is ready"
            return 0
        fi
        sleep 1
        ((seconds++))
        printf "."
    done

    echo ""
    print_error "$name failed to start within $MAX_WAIT_SECONDS seconds"
    return 1
}

# Check if Docker is running
check_docker_running() {
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
}

# Main setup flow
main() {
    print_header "MerchOps Local Development Setup"

    echo "Configuration:"
    echo "  - PostgreSQL port: $POSTGRES_PORT"
    echo "  - Redis port: $REDIS_PORT"
    echo "  - Next.js port: $NEXTJS_PORT"
    echo ""

    # Step 1: Check prerequisites
    print_step "Checking prerequisites..."
    check_command docker
    check_command node
    check_command pnpm
    check_docker_running
    print_success "All prerequisites met"

    # Step 2: Handle reset if requested
    if [ "$RESET_DATA" = true ]; then
        print_step "Resetting all data (fresh start)..."
        docker compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true
        print_success "All data volumes removed"
    fi

    # Step 3: Copy .env if it doesn't exist
    print_step "Checking environment configuration..."
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env from .env.example"
            print_warning "Review and update .env with your specific values"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi

    # Also copy web app .env if needed
    if [ ! -f "apps/web/.env" ]; then
        if [ -f "apps/web/.env.example" ]; then
            cp apps/web/.env.example apps/web/.env
            print_success "Created apps/web/.env from .env.example"
        fi
    fi

    # Step 4: Install dependencies
    if [ "$SKIP_DEPS" = false ]; then
        print_step "Installing dependencies..."
        pnpm install
        print_success "Dependencies installed"
    else
        print_warning "Skipping dependency installation (--skip-deps)"
    fi

    # Step 5: Start Docker services
    print_step "Starting Docker services..."
    docker compose -f docker-compose.dev.yml up -d

    # Step 6: Wait for PostgreSQL
    wait_for_service "PostgreSQL" "localhost" "$POSTGRES_PORT" \
        "docker exec merchops_dev_postgres pg_isready -U merchops -d merchops_dev"

    # Step 7: Wait for Redis
    wait_for_service "Redis" "localhost" "$REDIS_PORT" \
        "docker exec merchops_dev_redis redis-cli ping"

    # Step 8: Generate Prisma Client
    print_step "Generating Prisma Client..."
    pnpm prisma:generate
    print_success "Prisma Client generated"

    # Step 9: Run database migrations
    print_step "Running database migrations..."
    pnpm prisma migrate dev --name init 2>/dev/null || pnpm prisma migrate deploy
    print_success "Database migrations applied"

    # Step 10: Seed development data (optional)
    if [ "$SEED_DATA" = true ]; then
        print_step "Seeding development data..."
        if [ -f "prisma/seed.ts" ]; then
            pnpm prisma db seed
            print_success "Development data seeded"
        else
            print_warning "No seed file found (prisma/seed.ts)"
        fi
    fi

    # Done!
    print_header "Setup Complete!"

    echo "Services running:"
    echo "  - PostgreSQL: localhost:$POSTGRES_PORT"
    echo "  - Redis: localhost:$REDIS_PORT"
    echo ""
    echo "Quick commands:"
    echo -e "  ${CYAN}pnpm dev:local${NC}        Start Next.js on port $NEXTJS_PORT"
    echo -e "  ${CYAN}pnpm workers${NC}          Start background job workers"
    echo -e "  ${CYAN}pnpm prisma:studio${NC}    Open Prisma Studio (database GUI)"
    echo -e "  ${CYAN}pnpm db:shell${NC}         Open PostgreSQL shell"
    echo -e "  ${CYAN}pnpm redis:cli${NC}        Open Redis CLI"
    echo -e "  ${CYAN}pnpm services:stop${NC}    Stop all services"
    echo -e "  ${CYAN}pnpm services:logs${NC}    View service logs"
    echo ""
    echo "Next steps:"
    echo "  1. Review and update .env with your Shopify credentials"
    echo "  2. Run 'pnpm dev:local' to start the development server"
    echo "  3. Open http://localhost:$NEXTJS_PORT in your browser"
    echo ""
    print_success "Ready to develop!"
}

# Run main function
main
