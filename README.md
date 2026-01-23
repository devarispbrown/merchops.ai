# MerchOps

## What is MerchOps?

MerchOps is a calm operator console for Shopify merchants. It monitors your store for meaningful signals, surfaces prioritized opportunities, and drafts safe actions you can review and approve. Built for DTC operators managing $1M-$50M GMV stores who want leverage without losing control.

The core philosophy is simple: detect what matters, explain why it matters now, and execute only with your explicit approval. No autonomous sending, no hidden side effects, no black-box automation. Every opportunity shows its reasoning, every action shows its payload, and every execution is logged immutably.

## Architecture

```
+------------------+     +------------------+     +------------------+
|     Shopify      |     |    Webhooks      |     |     Events       |
|   (Your Store)   |---->|  orders/create   |---->| (Immutable Store)|
|                  |     |  products/update |     |  - dedupe_key    |
|                  |     |  inventory_levels|     |  - occurred_at   |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
+------------------+     +------------------+     +------------------+
|    Outcomes      |     |   Executions     |     | Opportunities    |
| helped/neutral/  |<----|  (Immutable Log) |<----|  - why_now       |
| hurt + evidence  |     |  - idempotency   |     |  - counterfactual|
+------------------+     |  - retries       |     |  - priority      |
         ^               +------------------+     |  - decay_at      |
         |                        ^               +------------------+
         |                        |                       |
         |               +------------------+             v
         |               |    Approval      |     +------------------+
         +---------------|   (Human in      |<----| Action Drafts    |
                         |    the Loop)     |     |  - payload       |
                         +------------------+     |  - editable      |
                                                  +------------------+

Flow: Shopify --> Webhooks --> Events --> Opportunities --> Drafts --> Approval --> Execution --> Outcomes
                                                                           ^
                                                                           |
                                                              Nothing executes without this
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 14+ (App Router) | Full-stack React with server components |
| Language | TypeScript | Type safety across client and server |
| Database | PostgreSQL + Prisma | Relational data with type-safe ORM |
| Queue | BullMQ + Redis | Background job processing |
| Auth | NextAuth (Auth.js) | Session management and authentication |
| Data Fetching | TanStack Query | Client-side cache and optimistic updates |
| Styling | Tailwind CSS | Utility-first CSS |
| Validation | Zod | Runtime type validation (shared client/server) |
| Testing | Playwright + Vitest | E2E and unit testing |
| Observability | Pino + Sentry | Structured logging and error tracking |

## Quick Start

### Local Development

**Prerequisites:**
- Node.js 20+ (LTS recommended)
- pnpm 8+ (`npm install -g pnpm`)
- Docker (for PostgreSQL and Redis)

**Setup:**

```bash
# Clone and install
git clone https://github.com/your-org/merchops.ai.git
cd merchops.ai
pnpm install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your configuration

# Start infrastructure
docker compose up -d

# Database setup
pnpm prisma migrate dev
pnpm prisma generate

# Start app and workers
pnpm dev                    # Terminal 1
pnpm workers                # Terminal 2
```

Visit `http://localhost:3000` to access the application.

**Full guide:** [Local Development Documentation](./docs/local-development.md)

### Production Deployment

Deploy MerchOps to production using any of these platforms:

| Platform | Setup Time | Complexity | Free Tier | Docs |
|----------|------------|------------|-----------|------|
| **Render** (Recommended) | 15 min | Low | ✅ | [Guide](./docs/deployment/README.md#render-recommended) |
| Railway.app | 20 min | Low | ✅ | [Guide](./docs/deployment/README.md#railwayapp) |
| Fly.io | 30 min | Medium | ✅ | [Guide](./docs/deployment/README.md#flyio) |
| Vercel + External | 45 min | Medium | ⚠️ Partial | [Guide](./docs/deployment/README.md#vercel--external-services) |

**Quick Deploy with Render:**

1. Push code to GitHub
2. [Deploy with Render Blueprint](https://render.com/deploy) - `render.yaml` included
3. Set required environment variables
4. Run database migrations
5. Verify health check: `https://your-app.onrender.com/api/health`

**Complete deployment guide:** [Deployment Documentation](./docs/deployment/README.md)

**Environment variables:** [Environment Variables Reference](./docs/deployment/env-vars.md)

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string for BullMQ
- `NEXTAUTH_SECRET` - Session encryption key (generate: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Application base URL
- `SHOPIFY_CLIENT_ID` - Shopify OAuth client ID
- `SHOPIFY_CLIENT_SECRET` - Shopify OAuth client secret
- `SHOPIFY_SCOPES` - OAuth scopes (see `.env.example`)
- `SHOPIFY_WEBHOOK_SECRET` - HMAC verification secret
- `ENCRYPTION_KEY` - Token encryption key (generate: `openssl rand -hex 32`)
- `AI_PROVIDER` - AI provider: `anthropic`, `openai`, or `ollama`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - AI provider credentials
- `EMAIL_PROVIDER_API_KEY` - Resend/SendGrid API key

**Optional:**
- `SENTRY_DSN` - Sentry error tracking
- `LOG_LEVEL` - Logging verbosity (default: `info`)
- `AI_MODEL_TIER` - Model tier: `fast`, `balanced`, `powerful` (default: `balanced`)

**Complete reference:** [Environment Variables Documentation](./docs/deployment/env-vars.md)

## API Documentation

MerchOps provides interactive API documentation via Swagger UI.

### Accessing API Docs

- **Swagger UI:** Visit `/api-docs` in your browser
- **OpenAPI Spec:** Download at `/openapi.yaml`

### API Overview

| Category | Description |
|----------|-------------|
| **Health** | System status and diagnostics |
| **Auth** | User registration and authentication |
| **Opportunities** | Ranked suggestions from store signals |
| **Drafts** | Editable action templates |
| **Executions** | Approved action results and tracking |
| **Outcomes** | Learning loop and execution outcomes |
| **Confidence** | Confidence scores per operator intent |
| **Shopify** | Store integration and webhooks |
| **Admin** | Administrative diagnostics |

### Authentication

All API endpoints (except `/api/health`) require session authentication. Login at `/login` to obtain a session cookie.

### Correlation IDs

Every request includes an `X-Correlation-ID` header for tracing and debugging across services.

## Running Tests

```bash
# Unit tests
pnpm test

# Unit tests in watch mode
pnpm test:watch

# E2E tests (requires running dev server)
pnpm test:e2e

# E2E tests with UI
pnpm test:e2e:ui

# Test coverage report
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# All quality checks (CI pipeline)
pnpm validate
```

## Running Workers

Background workers process queued jobs for webhook ingestion, event computation, opportunity generation, and action execution.

```bash
# Start all workers
pnpm workers

# Start specific worker (if available)
pnpm worker:events
pnpm worker:opportunities
pnpm worker:executions
```

### Available Queues

| Queue | Purpose | Processing |
|-------|---------|------------|
| `shopify-webhooks` | Incoming webhook events | Real-time |
| `shopify-sync` | Initial data sync jobs | Background |
| `event-computation` | Transform raw data to events | Near real-time |
| `opportunity-generation` | Create opportunities from events | Within 5 minutes |
| `action-execution` | Execute approved actions | On approval |
| `outcome-resolution` | Compute helped/neutral/hurt | Async |

## Marketing Site

The root route (`/`) serves the MerchOps landing page for unauthenticated users. Authenticated users are automatically redirected to `/queue`.

### Key Details

| Aspect | Description |
|--------|-------------|
| Route | `/` (root) |
| Component | `apps/web/components/marketing/pages/LandingPage.tsx` |
| Source of Truth | Magic Patterns design tool |

### Conversion CTAs

All primary conversion buttons route to `/signup?returnTo=/app`:
- "Join the beta" (navigation, hero, final CTA)
- "Start your free trial" (final CTA)

After signup and login, users are redirected to the `returnTo` destination (defaults to `/queue`).

### Editing Guidelines

**Copy and Tailwind classnames are contractually fixed to the Magic Patterns source.** Do not modify styling or copy directly in the codebase.

To make changes:
1. Update the design in Magic Patterns
2. Export the updated code
3. Replace files in `apps/web/components/marketing/`
4. Preserve routing logic and event handlers

See `apps/web/components/marketing/README.md` for detailed component documentation.

---

## Project Structure

```
/apps/web                    # Next.js application
  /app                       # App Router pages and layouts
    /(auth)                  # Authentication routes
    /(dashboard)             # Protected dashboard routes
  /components                # React components
    /marketing               # Landing page components (Magic Patterns source)
  /lib                       # Client utilities
  /server                    # Server-side code
    /auth                    # NextAuth configuration
    /db                      # Prisma client and queries
    /shopify                 # Shopify API integration
    /events                  # Event computation logic
    /opportunities           # Opportunity engine
    /actions                 # Draft and execution logic
    /jobs                    # BullMQ worker definitions
    /observability           # Logging and metrics
  /tests                     # Test files
    /unit                    # Unit tests (Vitest)
    /integration             # Integration tests
    /e2e                     # E2E tests (Playwright)

/packages/shared             # Shared code between apps
  /types                     # TypeScript type definitions
  /schemas                   # Zod validation schemas
  /prompts                   # AI prompt templates

/prisma                      # Database schema and migrations
  schema.prisma              # Prisma schema definition
  /migrations                # Migration files

/docs                        # Documentation
  /architecture              # System design documents
  /api                       # API documentation
  /security                  # Security documentation
  /verification              # Beta verification checklists
```

## Beta Status

> **This is beta software.** MerchOps is currently in active development and should not be used in production without thorough review.

### Current Limitations

- Single workspace per user (no multi-store support)
- Limited to supported event types and action types
- Email actions may require sandbox mode verification
- Performance under high load is not yet validated

### Reporting Issues

If you encounter bugs or have feature requests:

1. Check existing issues in the repository
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs (sanitized of secrets)

### Security Concerns

For security vulnerabilities, please do not open a public issue. Contact the team directly at security@merchops.ai.

---

## License

Proprietary. All rights reserved.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.
