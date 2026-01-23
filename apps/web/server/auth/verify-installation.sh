#!/bin/bash

# NextAuth Installation Verification Script
# Checks that all authentication components are properly installed

echo "=================================="
echo "NextAuth Installation Verification"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0

# Function to check file existence
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} $1 - MISSING"
    ((FAILED++))
    return 1
  fi
}

# Function to check directory existence
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} $1 - MISSING"
    ((FAILED++))
    return 1
  fi
}

echo "Checking core authentication files..."
echo "-------------------------------------"

# Core auth files
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/config.ts"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/providers.ts"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/session.ts"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/workspace.ts"

echo ""
echo "Checking API routes..."
echo "---------------------"

# API routes
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/app/api/auth/[...nextauth]/route.ts"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/app/api/auth/signup/route.ts"

echo ""
echo "Checking client utilities..."
echo "---------------------------"

# Client utilities
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/lib/auth-client.ts"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/components/providers/AuthProvider.tsx"

echo ""
echo "Checking middleware..."
echo "---------------------"

# Middleware
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/middleware.ts"

echo ""
echo "Checking documentation..."
echo "------------------------"

# Documentation
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/README.md"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/INTEGRATION.md"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/IMPLEMENTATION_SUMMARY.md"
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/examples.ts"

echo ""
echo "Checking tests..."
echo "----------------"

# Tests
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/server/auth/workspace.test.ts"

echo ""
echo "Checking environment setup..."
echo "----------------------------"

# Environment
check_file "/Users/devarisbrown/Code/projects/merchops.ai/apps/web/.env.example"

echo ""
echo "Checking database schema..."
echo "--------------------------"

# Schema
check_file "/Users/devarisbrown/Code/projects/merchops.ai/prisma/schema.prisma"

# Check for required models in schema
if grep -q "model User" /Users/devarisbrown/Code/projects/merchops.ai/prisma/schema.prisma; then
  echo -e "${GREEN}✓${NC} User model exists in schema"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} User model NOT FOUND in schema"
  ((FAILED++))
fi

if grep -q "model Workspace" /Users/devarisbrown/Code/projects/merchops.ai/prisma/schema.prisma; then
  echo -e "${GREEN}✓${NC} Workspace model exists in schema"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Workspace model NOT FOUND in schema"
  ((FAILED++))
fi

echo ""
echo "==================================="
echo "Verification Results"
echo "==================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Authentication system is ready.${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Copy .env.example to .env.local"
  echo "2. Generate NEXTAUTH_SECRET: openssl rand -base64 32"
  echo "3. Run: npx prisma migrate dev"
  echo "4. Start dev server: npm run dev"
  echo "5. Test signup: curl -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"TestPass123\"}'"
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Please review the missing files.${NC}"
  exit 1
fi
