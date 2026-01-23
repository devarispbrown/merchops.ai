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

## Local Development

### Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm 8+ (`npm install -g pnpm`)
- Docker (for PostgreSQL and Redis)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/merchops.ai.git
   cd merchops.ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration (see Environment Variables below).

4. **Start infrastructure**
   ```bash
   # Start PostgreSQL and Redis via Docker
   docker compose up -d
   ```

5. **Database setup**
   ```bash
   # Run migrations
   pnpm prisma migrate dev

   # Generate Prisma client
   pnpm prisma generate
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:3000`.

7. **Start background workers** (in a separate terminal)
   ```bash
   pnpm workers
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string for BullMQ |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Yes | Base URL of the application |
| `SHOPIFY_CLIENT_ID` | Yes | Shopify app client ID |
| `SHOPIFY_CLIENT_SECRET` | Yes | Shopify app client secret |
| `SHOPIFY_SCOPES` | Yes | OAuth scopes (space-separated) |
| `SHOPIFY_WEBHOOK_SECRET` | Yes | Secret for HMAC webhook verification |
| `ENCRYPTION_KEY` | Yes | 32-byte key for encrypting tokens at rest |
| `EMAIL_PROVIDER_API_KEY` | No | API key for email provider (Postmark/SendGrid) |
| `EMAIL_PROVIDER_SANDBOX` | No | Set to `true` for sandbox mode |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |

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

## Project Structure

```
/apps/web                    # Next.js application
  /app                       # App Router pages and layouts
    /(auth)                  # Authentication routes
    /(dashboard)             # Protected dashboard routes
  /components                # React components
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
