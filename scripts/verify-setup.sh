#!/bin/bash

# MerchOps Beta MVP - Setup Verification Script
# Validates that all CI/CD and environment configuration is correct
#
# Expected ports (non-standard to avoid conflicts):
#   - Next.js: 3847 (instead of 3000)
#   - PostgreSQL: 5847 (instead of 5432)
#   - Redis: 6847 (instead of 6379)

set -e

echo "=========================================="
echo "MerchOps Beta MVP - Setup Verification"
echo "=========================================="
echo ""

# Configuration
POSTGRES_PORT=5847
REDIS_PORT=6847
NEXTJS_PORT=3847

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Track verification status
ERRORS=0
WARNINGS=0

# Function to check if a file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 (missing)"
        ((ERRORS++))
    fi
}

# Function to check if a command exists
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 ($($1 --version 2>&1 | head -n1))"
    else
        echo -e "${RED}✗${NC} $1 (not installed)"
        ((ERRORS++))
    fi
}

# Function to check environment variable
check_env_var() {
    if grep -q "^$1=" .env 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${YELLOW}!${NC} $1 (not set in .env)"
        ((WARNINGS++))
    fi
}

echo "1. Checking Prerequisites..."
echo "----------------------------"
check_command node
check_command pnpm
check_command docker
check_command git
echo ""

echo "2. Checking Configuration Files..."
echo "-----------------------------------"
check_file ".github/workflows/ci.yml"
check_file ".env.example"
check_file "package.json"
check_file "turbo.json"
check_file ".eslintrc.json"
check_file ".prettierrc.json"
check_file ".gitignore"
check_file "docker-compose.yml"
echo ""

echo "3. Checking Test Configuration..."
echo "-----------------------------------"
check_file "apps/web/playwright.config.ts"
check_file "apps/web/vitest.config.ts"
check_file "apps/web/tests/setup.ts"
check_file "apps/web/tests/e2e/global-setup.ts"
check_file "apps/web/tests/e2e/global-teardown.ts"
echo ""

echo "4. Checking Documentation..."
echo "----------------------------"
check_file "docs/deploy-runbook.md"
check_file "docs/ci-cd-setup.md"
check_file "README.md"
check_file "CLAUDE.md"
echo ""

echo "5. Checking Environment Variables..."
echo "-------------------------------------"
if [ -f ".env" ]; then
    echo "Found .env file. Checking required variables..."
    check_env_var "DATABASE_URL"
    check_env_var "REDIS_URL"
    check_env_var "NEXTAUTH_SECRET"
    check_env_var "NEXTAUTH_URL"
    check_env_var "SHOPIFY_CLIENT_ID"
    check_env_var "SHOPIFY_CLIENT_SECRET"
    check_env_var "SHOPIFY_SCOPES"
else
    echo -e "${YELLOW}!${NC} .env file not found (copy from .env.example)"
    ((WARNINGS++))
fi
echo ""

echo "6. Checking Docker Services..."
echo "-------------------------------"
echo -e "${CYAN}Expected ports: PostgreSQL=$POSTGRES_PORT, Redis=$REDIS_PORT${NC}"
if docker ps &> /dev/null; then
    if docker ps | grep -q merchops_dev_postgres; then
        echo -e "${GREEN}✓${NC} PostgreSQL container running (port $POSTGRES_PORT)"
        # Verify PostgreSQL is responding
        if docker exec merchops_dev_postgres pg_isready -U merchops -d merchops_dev &> /dev/null; then
            echo -e "${GREEN}✓${NC} PostgreSQL is accepting connections"
        else
            echo -e "${YELLOW}!${NC} PostgreSQL container running but not ready"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}!${NC} PostgreSQL container not running (run: pnpm db:start)"
        ((WARNINGS++))
    fi

    if docker ps | grep -q merchops_dev_redis; then
        echo -e "${GREEN}✓${NC} Redis container running (port $REDIS_PORT)"
        # Verify Redis is responding
        if docker exec merchops_dev_redis redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✓${NC} Redis is accepting connections"
        else
            echo -e "${YELLOW}!${NC} Redis container running but not ready"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}!${NC} Redis container not running (run: pnpm redis:start)"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}!${NC} Docker daemon not running"
    ((WARNINGS++))
fi
echo ""

echo "7. Checking Node Modules..."
echo "---------------------------"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${YELLOW}!${NC} node_modules not found (run: pnpm install)"
    ((WARNINGS++))
fi
echo ""

echo "8. Checking Prisma Setup..."
echo "---------------------------"
if [ -d "prisma" ]; then
    echo -e "${GREEN}✓${NC} prisma directory exists"
    check_file "prisma/schema.prisma"

    if [ -d "node_modules/.prisma" ]; then
        echo -e "${GREEN}✓${NC} Prisma Client generated"
    else
        echo -e "${YELLOW}!${NC} Prisma Client not generated (run: pnpm prisma:generate)"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}✗${NC} prisma directory not found"
    ((ERRORS++))
fi
echo ""

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""

echo "9. Checking Port Configuration..."
echo "---------------------------------"
echo -e "${CYAN}Configured ports (non-standard to avoid conflicts):${NC}"
echo "  Next.js: $NEXTJS_PORT (instead of 3000)"
echo "  PostgreSQL: $POSTGRES_PORT (instead of 5432)"
echo "  Redis: $REDIS_PORT (instead of 6379)"

# Check if .env has correct ports
if [ -f ".env" ]; then
    if grep -q "localhost:$POSTGRES_PORT" .env 2>/dev/null; then
        echo -e "${GREEN}✓${NC} DATABASE_URL configured for port $POSTGRES_PORT"
    else
        echo -e "${YELLOW}!${NC} DATABASE_URL may not be using port $POSTGRES_PORT"
        ((WARNINGS++))
    fi
    if grep -q "localhost:$REDIS_PORT" .env 2>/dev/null; then
        echo -e "${GREEN}✓${NC} REDIS_URL configured for port $REDIS_PORT"
    else
        echo -e "${YELLOW}!${NC} REDIS_URL may not be using port $REDIS_PORT"
        ((WARNINGS++))
    fi
    if grep -q "localhost:$NEXTJS_PORT" .env 2>/dev/null; then
        echo -e "${GREEN}✓${NC} NEXTAUTH_URL configured for port $NEXTJS_PORT"
    else
        echo -e "${YELLOW}!${NC} NEXTAUTH_URL may not be using port $NEXTJS_PORT"
        ((WARNINGS++))
    fi
fi
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your MerchOps development environment is ready."
    echo ""
    echo "Quick start commands:"
    echo "  pnpm setup          - Complete setup (first time)"
    echo "  pnpm services:start - Start PostgreSQL and Redis"
    echo "  pnpm dev:local      - Start Next.js on port $NEXTJS_PORT"
    echo "  pnpm workers        - Start background workers"
    echo "  pnpm test           - Run tests"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}Setup complete with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Review the warnings above and take action if needed."
    echo ""
    echo "Quick fix: Run 'pnpm setup' to auto-configure everything."
    exit 0
else
    echo -e "${RED}Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo ""
    echo "Fix the errors above before proceeding."
    echo ""
    echo "Quick fix: Run 'pnpm setup' to auto-configure everything."
    exit 1
fi
