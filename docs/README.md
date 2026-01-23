# MerchOps Documentation

> Technical documentation for the MerchOps Beta MVP - A calm operator console for Shopify merchants

**Last Updated:** 2026-01-23
**Documentation Version:** 1.0.0

This directory contains comprehensive documentation for developers, architects, operators, and QA engineers working with MerchOps.

---

## Quick Start

| I want to... | Go to... |
|--------------|----------|
| Set up my local development environment | [Local Development Guide](./local-development.md) |
| Run tests | [Testing Guide](./testing.md) |
| Deploy to production | [Deployment Guide](./deployment.md) |
| Understand background jobs | [Workers Guide](./workers.md) |
| Verify beta readiness | [Beta Verification Report](./verification/beta-report.md) |
| See all requirements | [CLAUDE.md](/CLAUDE.md) |

---

## Documentation Index

### Getting Started

| Document | Description | Audience |
|----------|-------------|----------|
| [Local Development](./local-development.md) | Complete setup guide for local development environment | Developers |
| [CLAUDE.md](/CLAUDE.md) | Project operating system - requirements, architecture, acceptance criteria | All |
| [README.md](/README.md) | Project overview and quick start | All |

### Development

| Document | Description | Audience |
|----------|-------------|----------|
| [Testing Guide](./testing.md) | Test strategy, running tests, writing tests | Developers, QA |
| [Workers Guide](./workers.md) | Background jobs, queues, monitoring | Developers, DevOps |

### Operations

| Document | Description | Audience |
|----------|-------------|----------|
| [Deployment Guide](./deployment.md) | Environment setup, deployment steps, rollback procedures | DevOps, Developers |
| [Deploy Runbook](./deploy-runbook.md) | Detailed deployment procedures and checklists | DevOps |

### Verification

| Document | Description | Audience |
|----------|-------------|----------|
| [Beta Verification Report](./verification/beta-report.md) | Template for final beta verification with all 10 sections | QA, Product |
| [Beta Checklist](./verification/beta-checklist.md) | Scored verification checklist for beta readiness | QA, Product |
| [Test Matrix](./verification/test-matrix.md) | JTBD to test coverage mapping | QA, Developers |

### Architecture (Planned)

| Document | Status | Description |
|----------|--------|-------------|
| System Overview | Planned | High-level architecture, boundaries, and data flow |
| Data Model | Planned | Database schema design and relationships |
| Event System | Planned | Event ingestion, computation, and deduplication |
| Opportunity Engine | Planned | Prioritization, scoring, and decay logic |
| Execution Engine | Planned | Idempotency, retries, and rollback behavior |

### Security (Planned)

| Document | Status | Description |
|----------|--------|-------------|
| Security Model | Planned | Authentication, authorization, and data protection |
| Shopify Integration Security | Planned | OAuth scopes, webhook HMAC, token encryption |
| Multi-Tenant Isolation | Planned | Workspace boundaries and query scoping |

### API (Planned)

| Document | Status | Description |
|----------|--------|-------------|
| API Overview | Planned | API design principles and authentication |
| Opportunities API | Planned | Opportunity endpoints and payloads |
| Actions API | Planned | Draft, approval, and execution endpoints |

---

## Core Concepts

### Jobs to be Done (JTBD)

MerchOps is built around four core jobs that merchants need to accomplish:

| JTBD | Description |
|------|-------------|
| **JTBD-1** | Detect opportunities from store signals without constant dashboard babysitting |
| **JTBD-2** | Understand why an opportunity surfaced now and what happens if nothing is done |
| **JTBD-3** | Review and edit drafts safely, approve intentionally, and execute deterministically |
| **JTBD-4** | Track outcomes and build confidence that MerchOps is learning for this store |

### Product Guardrails

All development must respect these guardrails (violating them is a bug):

| Guardrail | Meaning |
|-----------|---------|
| **Calm over clever** | The interface should reduce cognitive load, not add to it |
| **Control over automation** | Nothing executes without explicit human approval |
| **Explainability over opacity** | Every suggestion must explain its reasoning |
| **Trust compounds faster than features** | Reliability matters more than feature count |

### Data Flow

```
Shopify Webhooks / API Sync
           |
           v
    ┌──────────────┐
    │    Events    │  Immutable, deduped by dedupe_key
    └──────┬───────┘
           |
           v
    ┌──────────────┐
    │ Opportunities│  Includes why_now, counterfactual, decay_at
    └──────┬───────┘
           |
           v
    ┌──────────────┐
    │Action Drafts │  Editable payload, requires approval
    └──────┬───────┘
           |
           v (on approval)
    ┌──────────────┐
    │  Executions  │  Immutable log, idempotent via idempotency_key
    └──────┬───────┘
           |
           v (async)
    ┌──────────────┐
    │   Outcomes   │  helped / neutral / hurt with evidence
    └──────────────┘
```

---

## Technical Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Frontend** | Next.js 14 (App Router) | React framework with SSR |
| | TypeScript | Type safety |
| | Tailwind CSS | Styling |
| | TanStack Query | Client-side data fetching |
| | Zod | Runtime validation |
| **Backend** | Next.js API Routes | API endpoints |
| | Prisma | Database ORM |
| | BullMQ | Background job processing |
| **Database** | PostgreSQL | Primary data store |
| | Redis | Job queues and caching |
| **Auth** | NextAuth.js | Authentication |
| **Integrations** | Shopify API | E-commerce integration |
| **Observability** | Pino | Structured logging |
| | Sentry | Error tracking |

---

## Repository Structure

```
merchops.ai/
├── apps/
│   └── web/                    # Next.js web application
│       ├── app/                # App Router pages
│       ├── components/         # React components
│       ├── lib/                # Client utilities
│       ├── server/             # Server-side code
│       │   ├── auth/           # Authentication
│       │   ├── db/             # Database client
│       │   ├── shopify/        # Shopify integration
│       │   ├── events/         # Event computation
│       │   ├── opportunities/  # Opportunity engine
│       │   ├── actions/        # Action drafts/execution
│       │   ├── jobs/           # Background workers
│       │   └── learning/       # Outcome resolution
│       └── tests/              # Test files
│
├── packages/
│   └── shared/                 # Shared code
│       ├── schemas/            # Zod validation schemas
│       ├── prompts/            # AI prompt templates
│       └── types/              # TypeScript types
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
│
├── docs/                       # Documentation (you are here)
│
└── .github/
    └── workflows/              # CI/CD workflows
```

---

## Quality Gates

All code must pass these checks before merging:

| Check | Command | Description |
|-------|---------|-------------|
| Lint | `pnpm lint` | ESLint rules |
| Type Check | `pnpm typecheck` | TypeScript compilation |
| Unit Tests | `pnpm test:unit` | Isolated logic tests |
| Integration Tests | `pnpm test:integration` | Component interaction tests |
| E2E Tests | `pnpm test:e2e` | Browser-based flow tests |
| Schema Validation | `pnpm prisma:validate` | Database schema validity |

### Coverage Targets

| Metric | Target |
|--------|--------|
| Lines | 80% |
| Statements | 80% |
| Branches | 75% |
| Functions | 75% |

---

## Beta Readiness

### Target Score: >= 9.5 / 10

Beta readiness is verified through the [Beta Verification Report](./verification/beta-report.md), which scores across 10 sections:

1. First-Run Experience
2. Opportunity Quality
3. Determinism and Repeatability
4. Approval Safety
5. Execution Correctness
6. Learning Loop Visibility
7. UI Clarity and Calm
8. Observability and Debuggability
9. Security and Isolation
10. Performance and Resilience

### Definition of Done

Beta MVP is done when:
- Real store can connect, generate opportunity, approve action, execute safely, see outcome
- Nothing executes without approval
- Full auditability: event -> opportunity -> draft -> execution -> outcome
- CI gates are green and release runbook exists
- Beta readiness score > 9.5/10

---

## Common Tasks

### Set Up Local Environment

```bash
git clone <repository-url>
cd merchops.ai
pnpm install
cp .env.example .env
# Edit .env with your values
docker-compose up -d postgres redis
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm dev
```

See [Local Development Guide](./local-development.md) for complete instructions.

### Run Tests

```bash
# All tests
pnpm test

# Specific test types
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# With coverage
pnpm test:coverage
```

See [Testing Guide](./testing.md) for complete instructions.

### Deploy to Production

```bash
# Verify CI passes
pnpm lint && pnpm typecheck && pnpm test

# Apply database migrations
pnpm prisma:migrate

# Deploy (platform-specific)
vercel --prod        # Vercel
railway up           # Railway
```

See [Deployment Guide](./deployment.md) for complete instructions.

### Run Background Workers

```bash
# Run all workers
pnpm run workers

# Run specific worker
pnpm run worker:execution
```

See [Workers Guide](./workers.md) for complete instructions.

---

## Document Status Legend

| Status | Meaning |
|--------|---------|
| **Active** | Document exists and is maintained |
| **Planned** | Document is planned but not yet written |
| **Draft** | Document exists but is incomplete |
| **Archived** | Document is outdated and kept for reference |

---

## Contributing to Documentation

When adding or updating documentation:

1. **Follow existing structure** - Use the established file organization
2. **Update this index** - Add new documents to the appropriate section
3. **Use relative links** - Reference other documents with relative paths
4. **Include metadata** - Add version, date, and audience at the top
5. **Keep technical accuracy** - Verify all commands and code examples
6. **Review before merging** - Documentation changes require PR review

---

## Related Resources

### Code References

- [Prisma Schema](/prisma/schema.prisma) - Database schema definition
- [Shared Schemas](/packages/shared/schemas/) - Zod validation schemas
- [Prompt Templates](/packages/shared/prompts/) - AI prompt definitions
- [Job Configuration](/apps/web/server/jobs/config.ts) - Queue configuration

### External Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Shopify API Reference](https://shopify.dev/docs/api)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Vitest Documentation](https://vitest.dev/guide/)

---

## Support

### Team Resources

- **Issue Tracker:** GitHub Issues
- **Team Chat:** [Link to Slack/Discord]
- **On-Call:** [Rotation schedule]

### Common Questions

**Q: Where do I start as a new developer?**
A: Read [CLAUDE.md](/CLAUDE.md) first, then follow the [Local Development Guide](./local-development.md).

**Q: How do I know if my feature is complete?**
A: Check the acceptance criteria in CLAUDE.md and ensure all quality gates pass.

**Q: How do I debug a production issue?**
A: Use correlation IDs to trace requests through logs. See [Deployment Guide](./deployment.md#monitoring-setup).

**Q: Where are the test fixtures?**
A: See [tests/setup.ts](/apps/web/tests/setup.ts) for factory functions and mocks.

---

**End of Documentation Index**
