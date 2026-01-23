# MerchOps Local Development Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-23
**Audience:** Developers onboarding to MerchOps

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Development Workflow](#development-workflow)
6. [Environment Configuration](#environment-configuration)
7. [Database Management](#database-management)
8. [Running Services](#running-services)
9. [Testing Locally](#testing-locally)
10. [Troubleshooting](#troubleshooting)
11. [Resetting Your Environment](#resetting-your-environment)
12. [IDE Setup](#ide-setup)

---

## Overview

MerchOps is a monorepo built with:

- **Next.js 14** (App Router) for the web application
- **TypeScript** for type safety
- **Prisma** for database ORM
- **PostgreSQL** for data persistence
- **Redis** for job queues and caching
- **BullMQ** for background job processing
- **Turborepo** for monorepo management
- **pnpm** for package management

### Repository Structure

```
merchops.ai/
├── apps/
│   └── web/                    # Next.js web application
│       ├── app/                # App Router pages and layouts
│       ├── components/         # React components
│       ├── lib/                # Client-side utilities
│       ├── server/             # Server-side code
│       │   ├── auth/           # Authentication logic
│       │   ├── db/             # Database client
│       │   ├── shopify/        # Shopify integration
│       │   ├── events/         # Event computation
│       │   ├── opportunities/  # Opportunity engine
│       │   ├── actions/        # Action drafts and execution
│       │   ├── jobs/           # Background job definitions
│       │   ├── learning/       # Outcome resolution
│       │   └── observability/  # Logging and metrics
│       └── tests/              # Test files
├── packages/
│   └── shared/                 # Shared code across apps
│       ├── schemas/            # Zod validation schemas
│       ├── prompts/            # AI prompt templates
│       └── types/              # TypeScript type definitions
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
├── docs/                       # Documentation
└── .github/
    └── workflows/              # CI/CD workflows
```

---

## Prerequisites

Before setting up your local environment, ensure you have the following installed:

### Required Software

| Software | Minimum Version | Recommended | Installation |
|----------|-----------------|-------------|--------------|
| Node.js | 20.0.0 | 20.x LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 8.0.0 | 8.15.x | `npm install -g pnpm` |
| PostgreSQL | 14.0 | 16.x | See [Database Setup](#postgresql-installation) |
| Redis | 7.0 | 7.2.x | See [Redis Setup](#redis-installation) |
| Git | 2.40 | Latest | [git-scm.com](https://git-scm.com) |

### Optional but Recommended

| Software | Purpose | Installation |
|----------|---------|--------------|
| Docker | Run services in containers | [docker.com](https://docker.com) |
| VS Code | Recommended IDE | [code.visualstudio.com](https://code.visualstudio.com) |
| Postman/Insomnia | API testing | [postman.com](https://postman.com) |

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Expected: v20.x.x or higher

# Check pnpm version
pnpm --version
# Expected: 8.x.x or higher

# Check PostgreSQL
psql --version
# Expected: psql (PostgreSQL) 14.x or higher

# Check Redis
redis-server --version
# Expected: Redis server v=7.x.x or higher

# Check Git
git --version
# Expected: git version 2.40 or higher
```

---

## Quick Start

For experienced developers, here is the fastest path to a running local environment:

```bash
# Clone repository
git clone <repository-url>
cd merchops.ai

# Install dependencies
pnpm install

# Start services (Docker method - recommended)
docker-compose up -d postgres redis

# Setup environment
cp .env.example .env
# Edit .env with your values (see Environment Configuration)

# Setup database
pnpm prisma:generate
pnpm prisma:migrate:dev

# Start development server
pnpm dev

# Open in browser
open http://localhost:3000
```

---

## Detailed Setup

### Step 1: Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/your-org/merchops.ai.git

# Or clone via SSH
git clone git@github.com:your-org/merchops.ai.git

# Navigate to project directory
cd merchops.ai
```

### Step 2: Install Dependencies

```bash
# Install all dependencies with pnpm
pnpm install

# This will:
# - Install root dependencies
# - Install dependencies for apps/web
# - Install dependencies for packages/shared
# - Link workspace packages
```

**Troubleshooting pnpm install:**

```bash
# If you encounter peer dependency issues
pnpm install --shamefully-hoist

# If you need to clear cache
pnpm store prune
rm -rf node_modules
pnpm install
```

### Step 3: Setup Local Services

#### Option A: Docker Compose (Recommended)

The easiest way to run PostgreSQL and Redis locally:

```bash
# Start services in background
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps

# Expected output:
# NAME                  STATUS
# merchops-postgres     running (healthy)
# merchops-redis        running

# View logs if needed
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop services
docker-compose down

# Stop and remove volumes (reset data)
docker-compose down -v
```

**docker-compose.yml configuration:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: merchops-postgres
    environment:
      POSTGRES_USER: merchops
      POSTGRES_PASSWORD: password
      POSTGRES_DB: merchops_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U merchops"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: merchops-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Option B: Local Installation

##### PostgreSQL Installation

**macOS (Homebrew):**
```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create database user
createuser -s merchops

# Create database
createdb -O merchops merchops_dev

# Set password (in psql)
psql -d merchops_dev
ALTER USER merchops PASSWORD 'password';
\q
```

**Ubuntu/Debian:**
```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update

# Install PostgreSQL 16
sudo apt-get install postgresql-16

# Start service
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
CREATE USER merchops WITH PASSWORD 'password';
CREATE DATABASE merchops_dev OWNER merchops;
\q
```

##### Redis Installation

**macOS (Homebrew):**
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Expected: PONG
```

**Ubuntu/Debian:**
```bash
# Install Redis
sudo apt-get install redis-server

# Start service
sudo systemctl start redis-server

# Enable on boot
sudo systemctl enable redis-server

# Verify
redis-cli ping
# Expected: PONG
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Open .env in your editor
code .env  # or vim .env, nano .env, etc.
```

**Minimum required configuration:**

```bash
# Database (matches Docker Compose or local setup)
DATABASE_URL="postgresql://merchops:password@localhost:5432/merchops_dev?schema=public"

# Redis
REDIS_URL="redis://localhost:6379/0"

# NextAuth (generate a secure secret)
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
LOG_LEVEL="debug"
```

**Generate NEXTAUTH_SECRET:**
```bash
# Generate a random secret
openssl rand -base64 32
# Copy the output to your .env file
```

### Step 5: Setup Database

```bash
# Generate Prisma Client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate:dev

# (Optional) Seed with test data
pnpm db:seed

# Verify database setup
pnpm prisma:validate

# Open Prisma Studio to browse data
pnpm prisma:studio
```

### Step 6: Start Development Server

```bash
# Start the development server
pnpm dev

# This starts:
# - Next.js dev server on http://localhost:3000
# - Hot Module Replacement (HMR)
# - TypeScript watch mode
```

### Step 7: Verify Setup

```bash
# In a new terminal, run quality checks
pnpm lint        # Check for linting errors
pnpm typecheck   # Check TypeScript types
pnpm test        # Run test suite
```

**Expected outcome:**
- All checks pass without errors
- Application accessible at http://localhost:3000

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Run any new migrations
pnpm prisma:migrate:dev

# 4. Start development server
pnpm dev

# 5. Make changes, test locally

# 6. Before committing
pnpm lint
pnpm typecheck
pnpm test

# 7. Commit and push
git add .
git commit -m "Your message"
git push origin your-branch
```

### Available Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server

# Quality Checks
pnpm lint                   # Run ESLint
pnpm lint:fix               # Fix linting issues
pnpm typecheck              # TypeScript type checking
pnpm format                 # Format code with Prettier
pnpm format:check           # Check code formatting

# Testing
pnpm test                   # Run all tests (unit + integration)
pnpm test:unit              # Run unit tests only
pnpm test:integration       # Run integration tests only
pnpm test:e2e               # Run E2E tests (Playwright)
pnpm test:watch             # Run tests in watch mode
pnpm test:coverage          # Generate coverage report

# Database
pnpm prisma:generate        # Generate Prisma Client
pnpm prisma:migrate:dev     # Create and apply migrations
pnpm prisma:migrate:create  # Create migration without applying
pnpm prisma:migrate         # Apply migrations (production)
pnpm prisma:validate        # Validate schema
pnpm prisma:format          # Format schema file
pnpm prisma:studio          # Open Prisma Studio
pnpm prisma:reset           # Reset database (DESTRUCTIVE)
pnpm db:seed                # Seed database
pnpm db:push                # Push schema without migration
```

### Git Workflow

We follow a trunk-based development model:

1. **Main branch** (`main`): Production-ready code
2. **Feature branches**: `feature/description` or `fix/description`
3. **Pull Requests**: All changes via PR with CI checks

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add -A
git commit -m "Add feature description"

# Push branch
git push origin feature/my-feature

# Create PR via GitHub
gh pr create --title "Add feature" --body "Description"
```

---

## Environment Configuration

### Environment Variables Reference

See `.env.example` for the complete list. Key variables:

#### Required for Local Development

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `NEXTAUTH_SECRET` | Session encryption key | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging verbosity | `debug` |

#### Optional for Local Development

| Variable | Description | Default |
|----------|-------------|---------|
| `SHOPIFY_CLIENT_ID` | Shopify OAuth client ID | Required for Shopify features |
| `SHOPIFY_CLIENT_SECRET` | Shopify OAuth secret | Required for Shopify features |
| `SENTRY_DSN` | Sentry error tracking | Empty (disabled) |
| `EMAIL_PROVIDER_API_KEY` | Email service API key | Required for email features |

### Testing with Shopify

To test Shopify integration locally:

1. **Create a Shopify Partner account** at [partners.shopify.com](https://partners.shopify.com)
2. **Create a development store** for testing
3. **Create a custom app** in the Shopify Partner Dashboard
4. **Configure OAuth credentials** in your `.env`:

```bash
SHOPIFY_CLIENT_ID="your-client-id"
SHOPIFY_CLIENT_SECRET="your-client-secret"
SHOPIFY_SCOPES="read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,write_discounts,read_price_rules,write_price_rules"
```

5. **Setup ngrok** for webhook testing:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Start tunnel
ngrok http 3000

# Update NEXTAUTH_URL with ngrok URL
NEXTAUTH_URL="https://your-subdomain.ngrok.io"
```

---

## Database Management

### Prisma Commands

```bash
# Generate client after schema changes
pnpm prisma:generate

# Create a new migration
pnpm prisma:migrate:create --name description_of_change

# Apply migrations in development
pnpm prisma:migrate:dev

# Apply migrations in production
pnpm prisma:migrate

# Validate schema syntax
pnpm prisma:validate

# Format schema file
pnpm prisma:format

# Open database browser
pnpm prisma:studio
```

### Schema Changes Workflow

1. **Edit schema**: Modify `prisma/schema.prisma`
2. **Create migration**: `pnpm prisma:migrate:create --name add_new_field`
3. **Review migration**: Check `prisma/migrations/` for generated SQL
4. **Apply migration**: `pnpm prisma:migrate:dev`
5. **Update code**: Update TypeScript code to use new schema

### Viewing Data

```bash
# Open Prisma Studio (web-based GUI)
pnpm prisma:studio
# Opens at http://localhost:5555

# Or use psql directly
psql $DATABASE_URL
\dt                    # List tables
SELECT * FROM users;   # Query data
\q                     # Exit
```

### Reset Database

```bash
# Full reset (drops all data and applies migrations fresh)
pnpm prisma:reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Apply all migrations
# 4. Run seed script (if configured)
```

---

## Running Services

### Background Workers

MerchOps uses BullMQ for background job processing. Workers must be running for jobs to process.

```bash
# Start workers (in a separate terminal)
pnpm run workers

# Or run specific worker
pnpm run worker:shopify-sync
pnpm run worker:event-compute
pnpm run worker:opportunity-generate
pnpm run worker:execution
pnpm run worker:outcome-compute
```

**Note:** In development, jobs are often processed in-band for simplicity. For production-like testing, run workers explicitly.

### Redis Monitoring

```bash
# Connect to Redis CLI
redis-cli

# Monitor all commands
MONITOR

# Check queue status
KEYS bull:*
LLEN bull:shopify-sync:waiting
LLEN bull:execution:waiting

# Exit
quit
```

### Full Development Stack

To run the complete development environment:

```bash
# Terminal 1: Start services
docker-compose up -d postgres redis

# Terminal 2: Start Next.js
pnpm dev

# Terminal 3: Start workers (if needed)
pnpm run workers

# Terminal 4: Watch tests
pnpm test:watch
```

---

## Testing Locally

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run specific test file
pnpm test tests/unit/opportunities/prioritization.test.ts

# Run tests matching pattern
pnpm test --grep "opportunity"

# Run with coverage
pnpm test:coverage

# Watch mode (re-run on changes)
pnpm test:watch
```

### E2E Tests with Playwright

```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e --ui

# Run specific test file
pnpm test:e2e tests/e2e/auth/signup.spec.ts

# Debug mode
pnpm test:e2e --debug

# Generate tests (record mode)
npx playwright codegen http://localhost:3000
```

### Test Configuration

- **Unit/Integration tests**: Vitest (`apps/web/vitest.config.ts`)
- **E2E tests**: Playwright (`apps/web/playwright.config.ts`)
- **Test setup**: `apps/web/tests/setup.ts`

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: `pnpm install` fails

**Symptoms:**
- Dependency resolution errors
- Peer dependency warnings

**Solutions:**
```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install

# If peer dependency issues persist
pnpm install --shamefully-hoist
```

---

#### Issue: Database connection refused

**Symptoms:**
- `Error: connect ECONNREFUSED 127.0.0.1:5432`
- Prisma commands fail

**Solutions:**
```bash
# Check if PostgreSQL is running
# Docker:
docker-compose ps
docker-compose up -d postgres

# Local installation (macOS):
brew services list
brew services start postgresql@16

# Local installation (Linux):
sudo systemctl status postgresql
sudo systemctl start postgresql

# Verify connection
psql $DATABASE_URL -c "SELECT 1;"
```

---

#### Issue: Redis connection refused

**Symptoms:**
- `Error: connect ECONNREFUSED 127.0.0.1:6379`
- Job queue errors

**Solutions:**
```bash
# Check if Redis is running
# Docker:
docker-compose ps
docker-compose up -d redis

# Local installation (macOS):
brew services list
brew services start redis

# Local installation (Linux):
sudo systemctl status redis-server
sudo systemctl start redis-server

# Verify connection
redis-cli ping
# Expected: PONG
```

---

#### Issue: Prisma Client not generated

**Symptoms:**
- `Cannot find module '@prisma/client'`
- Type errors for Prisma models

**Solutions:**
```bash
# Generate Prisma Client
pnpm prisma:generate

# If schema changed, run migrations
pnpm prisma:migrate:dev

# Restart TypeScript server in VS Code
# Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

---

#### Issue: Port 3000 already in use

**Symptoms:**
- `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm dev
```

---

#### Issue: TypeScript errors after pulling changes

**Symptoms:**
- Red squiggles in VS Code
- `Type 'X' is not assignable to type 'Y'`

**Solutions:**
```bash
# Regenerate Prisma types
pnpm prisma:generate

# Install any new dependencies
pnpm install

# Clear TypeScript cache
rm -rf .next
rm -rf node_modules/.cache

# Restart TS server
# VS Code: Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

---

#### Issue: Tests failing after schema change

**Symptoms:**
- Tests pass locally but fail in CI
- Database-related test failures

**Solutions:**
```bash
# Reset test database
NODE_ENV=test pnpm prisma:reset

# Regenerate Prisma Client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev
```

---

#### Issue: Hot reload not working

**Symptoms:**
- Changes not reflected in browser
- Need to manually refresh

**Solutions:**
```bash
# Clear Next.js cache
rm -rf .next

# Restart development server
pnpm dev

# Check for file watcher limits (Linux)
cat /proc/sys/fs/inotify/max_user_watches
# Increase if needed:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

#### Issue: Shopify OAuth failing locally

**Symptoms:**
- OAuth redirect fails
- "Invalid redirect URI" error

**Solutions:**
```bash
# Ensure NEXTAUTH_URL matches OAuth redirect URI
# For local development with ngrok:
ngrok http 3000

# Update .env with ngrok URL
NEXTAUTH_URL="https://your-subdomain.ngrok.io"

# Update Shopify app settings with ngrok URL as redirect URI
```

---

## Resetting Your Environment

### Soft Reset (Keep Data)

```bash
# Clear build artifacts
rm -rf .next
rm -rf apps/web/.next
rm -rf node_modules/.cache

# Regenerate code
pnpm prisma:generate
pnpm dev
```

### Medium Reset (Reset Dependencies)

```bash
# Remove node_modules
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules

# Clear pnpm cache
pnpm store prune

# Reinstall
pnpm install
pnpm prisma:generate
```

### Hard Reset (Complete Reset)

```bash
# Stop all services
docker-compose down -v

# Remove all generated files
rm -rf .next
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -rf coverage
rm -rf test-results
rm -rf playwright-report

# Clear caches
pnpm store prune

# Start fresh
docker-compose up -d postgres redis
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm dev
```

### Reset Database Only

```bash
# Reset database (drops all data)
pnpm prisma:reset

# Or manually:
psql -c "DROP DATABASE merchops_dev;"
psql -c "CREATE DATABASE merchops_dev OWNER merchops;"
pnpm prisma:migrate:dev
```

---

## IDE Setup

### VS Code (Recommended)

**Recommended Extensions:**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "Prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "ZixuanChen.vitest-explorer"
  ]
}
```

**Workspace Settings (`.vscode/settings.json`):**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

**Launch Configuration (`.vscode/launch.json`):**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Debug Vitest Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test", "--", "--run"],
      "console": "integratedTerminal"
    }
  ]
}
```

### WebStorm / IntelliJ IDEA

1. **Import Project**: Open the project root directory
2. **Configure Node.js**: Settings > Languages > Node.js
3. **Enable ESLint**: Settings > Languages > JavaScript > Code Quality Tools > ESLint
4. **Enable Prettier**: Settings > Languages > JavaScript > Prettier
5. **Install Prisma Plugin**: Plugins > Marketplace > Search "Prisma"

---

## Getting Help

### Documentation

- [CLAUDE.md](/CLAUDE.md) - Project requirements and architecture
- [docs/README.md](/docs/README.md) - Documentation index
- [docs/workers.md](/docs/workers.md) - Background job documentation
- [docs/testing.md](/docs/testing.md) - Testing guide
- [docs/deployment.md](/docs/deployment.md) - Deployment guide

### Support Channels

- **Team Chat**: [Link to Slack/Discord]
- **Issue Tracker**: [Link to GitHub Issues]
- **Documentation**: [Link to Notion/Confluence]

### Common Questions

**Q: How do I run just the web app without workers?**
A: Just run `pnpm dev`. Workers are optional for basic development.

**Q: How do I test Shopify integration without a real store?**
A: Use the mock Shopify server in tests, or create a free development store at partners.shopify.com.

**Q: Why are my changes not showing up?**
A: Clear `.next` folder and restart dev server: `rm -rf .next && pnpm dev`

**Q: How do I debug a failing test?**
A: Run with verbose output: `pnpm test --reporter=verbose tests/path/to/test.ts`

---

**End of Local Development Guide**
