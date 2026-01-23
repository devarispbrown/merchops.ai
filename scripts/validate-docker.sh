#!/bin/bash
# ============================================================================
# MerchOps - Docker Setup Validation Script
# Validates that all Docker-related files are properly configured
# ============================================================================

set -e

echo "🔍 Validating MerchOps Docker Setup..."
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# Check Docker installation
echo "📦 Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    check_pass "Docker installed: $DOCKER_VERSION"
else
    check_fail "Docker not installed"
fi

if command -v docker compose &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    check_pass "Docker Compose installed: $COMPOSE_VERSION"
else
    check_fail "Docker Compose not installed"
fi
echo ""

# Check required files
echo "📄 Checking required files..."
FILES=(
    "Dockerfile"
    ".dockerignore"
    "docker-compose.prod.yml"
    "docker-compose.override.yml"
    ".env.docker"
    "prisma/init-db.sh"
    "k8s/namespace.yaml"
    "k8s/deployment.yaml"
    "k8s/service.yaml"
    ".github/workflows/docker.yml"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "Found: $file"
    else
        check_fail "Missing: $file"
    fi
done
echo ""

# Check Dockerfile configuration
echo "🐳 Validating Dockerfile..."
if grep -q "output: 'standalone'" apps/web/next.config.mjs; then
    check_pass "Next.js standalone output enabled"
else
    check_fail "Next.js standalone output not enabled"
fi

if grep -q "FROM node:20-alpine" Dockerfile; then
    check_pass "Using Node.js 20 Alpine base image"
else
    check_warn "Not using Node.js 20 Alpine (different base image)"
fi

if grep -q "USER nextjs" Dockerfile; then
    check_pass "Running as non-root user"
else
    check_fail "Not running as non-root user"
fi

if grep -q "HEALTHCHECK" Dockerfile; then
    check_pass "Health check configured"
else
    check_warn "No health check in Dockerfile"
fi
echo ""

# Check package.json scripts
echo "📝 Validating package.json scripts..."
SCRIPTS=(
    "docker:build"
    "docker:run"
    "docker:stop"
    "docker:logs"
    "docker:migrate"
)

for script in "${SCRIPTS[@]}"; do
    if grep -q "\"$script\":" package.json; then
        check_pass "Script exists: $script"
    else
        check_fail "Missing script: $script"
    fi
done
echo ""

# Check environment template
echo "🔐 Validating environment template..."
ENV_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "NEXTAUTH_SECRET"
    "ENCRYPTION_KEY"
    "SHOPIFY_CLIENT_ID"
    "SHOPIFY_CLIENT_SECRET"
)

for var in "${ENV_VARS[@]}"; do
    if grep -q "$var" .env.docker; then
        check_pass "Environment variable documented: $var"
    else
        check_fail "Missing environment variable: $var"
    fi
done
echo ""

# Check Kubernetes manifests
echo "☸️  Validating Kubernetes manifests..."
K8S_FILES=(
    "k8s/namespace.yaml"
    "k8s/deployment.yaml"
    "k8s/service.yaml"
    "k8s/ingress.yaml"
    "k8s/hpa.yaml"
)

for file in "${K8S_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Basic YAML syntax check
        if grep -q "apiVersion:" "$file"; then
            check_pass "Valid K8s manifest: $file"
        else
            check_warn "Possibly invalid K8s manifest: $file"
        fi
    else
        check_warn "Optional K8s file missing: $file"
    fi
done
echo ""

# Check documentation
echo "📚 Checking documentation..."
DOCS=(
    "DOCKER_DEPLOYMENT.md"
    "QUICK_START_DOCKER.md"
    "k8s/README.md"
    "CONTAINER_DEPLOYMENT_SUMMARY.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "Documentation exists: $doc"
    else
        check_warn "Documentation missing: $doc"
    fi
done
echo ""

# Check .dockerignore
echo "🚫 Validating .dockerignore..."
IGNORE_PATTERNS=(
    "node_modules"
    ".env"
    ".git"
    "*.md"
)

for pattern in "${IGNORE_PATTERNS[@]}"; do
    if grep -q "$pattern" .dockerignore; then
        check_pass "Ignoring: $pattern"
    else
        check_warn "Not ignoring: $pattern"
    fi
done
echo ""

# Security checks
echo "🔒 Security validation..."
if ! grep -r "password" Dockerfile docker-compose.prod.yml .env.docker | grep -v "PASSWORD" | grep -v "your-" | grep -v "CHANGE_ME" | grep -v "#"; then
    check_pass "No hardcoded passwords found"
else
    check_fail "Potential hardcoded passwords detected"
fi

if grep -q "runAsNonRoot: true" k8s/deployment.yaml 2>/dev/null; then
    check_pass "Kubernetes security context configured"
else
    check_warn "Kubernetes security context not fully configured"
fi
echo ""

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Docker setup validation passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Copy .env.docker to .env.production"
    echo "  2. Update environment variables with production values"
    echo "  3. Build image: pnpm docker:build"
    echo "  4. Deploy: pnpm docker:run"
    echo "  5. Run migrations: pnpm docker:migrate"
    exit 0
else
    echo -e "${RED}❌ Docker setup validation failed with $FAILED errors${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
fi
