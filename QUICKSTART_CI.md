# CI/CD Quick Start Guide

## Running Quality Gates Locally

Before pushing to GitHub, run these commands to catch issues early:

```bash
# 1. Lint (catches code style issues)
pnpm lint

# 2. Type check (catches type errors)
pnpm typecheck

# 3. Prisma validation (catches schema errors)
pnpm prisma:validate

# 4. Run tests (requires PostgreSQL + Redis)
pnpm test

# 5. E2E tests (requires PostgreSQL + Redis)
pnpm test:e2e

# 6. Build verification
pnpm build
```

## Full Local CI Simulation

```bash
# Run all gates in sequence (what CI does)
pnpm lint && \
pnpm typecheck && \
pnpm prisma:validate && \
pnpm test && \
pnpm test:e2e && \
pnpm build
```

## Environment Setup

```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Start required services
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  --name merchops-postgres \
  postgres:16-alpine

docker run -d -p 6379:6379 \
  --name merchops-redis \
  redis:7-alpine

# 3. Configure .env.local with your values
# DATABASE_URL=postgresql://postgres:password@localhost:5432/merchops_dev
# REDIS_URL=redis://localhost:6379
# NEXTAUTH_SECRET=your-secret-here

# 4. Generate Prisma client
pnpm prisma:generate

# 5. Run migrations
pnpm prisma:migrate:dev
```

## CI Workflow

### When does CI run?
- Every push to `main` branch
- Every pull request to `main` branch

### What does CI check?
1. Code style (lint)
2. Type safety (typecheck)
3. Database schema (prisma validate)
4. Business logic (unit tests)
5. Integration (integration tests)
6. User flows (E2E tests)
7. Production build (build)

### How to view CI results?
- Go to GitHub Actions tab
- Click on your commit/PR
- View logs for each job

## Common Issues

### Lint failures
```bash
# Auto-fix most issues
pnpm lint:fix
```

### Type errors
```bash
# Regenerate Prisma client
pnpm prisma:generate

# Check types
pnpm typecheck
```

### Test failures
```bash
# Run specific test file
pnpm test path/to/test.test.ts

# Run with watch mode
pnpm test:watch

# Check if services are running
docker ps | grep -E 'postgres|redis'
```

### Build failures
```bash
# Clear Next.js cache
rm -rf apps/web/.next

# Rebuild
pnpm build
```

## CI Performance

| Phase | Time (cached) | Time (cold) |
|-------|---------------|-------------|
| Lint | 1-2 min | 2-3 min |
| Type Check | 2-3 min | 3-4 min |
| Prisma Validate | 30 sec | 1 min |
| Unit Tests | 3-5 min | 5-7 min |
| E2E Tests | 5-10 min | 10-15 min |
| Build | 3-5 min | 5-7 min |
| **Total** | **10-12 min** | **15-20 min** |

## Required Environment Variables (CI)

CI uses these test values:
```yaml
DATABASE_URL: postgresql://merchops_test:test_password@localhost:5432/merchops_test
REDIS_URL: redis://localhost:6379
NODE_ENV: test
NEXTAUTH_SECRET: test-secret-for-ci-only
NEXTAUTH_URL: http://localhost:3000
```

## Tips for Fast Development

1. **Run lint/typecheck frequently** (fast feedback)
2. **Use watch mode for tests** during development
3. **Run full CI before pushing** to main/PR
4. **Check GitHub Actions early** if CI fails
5. **Use cache effectively** (don't clear unless needed)

## Getting Help

- **CI logs:** GitHub Actions tab
- **Local debugging:** Use `pnpm test:watch`
- **Documentation:** See CI_CD_VERIFICATION.md for details
- **Questions:** Ask in team channel

---

**Created:** 2026-01-23
**Agent:** RELEASE (DevOps)
**Status:** Ready for use ✅
