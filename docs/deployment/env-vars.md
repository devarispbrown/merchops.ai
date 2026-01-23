# Environment Variables Reference

Complete reference for all environment variables used in MerchOps Beta MVP.

## Quick Reference Table

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `REDIS_URL` | ✅ | - | Redis connection string |
| `NEXTAUTH_SECRET` | ✅ | - | Session encryption secret |
| `NEXTAUTH_URL` | ✅ | - | Application base URL |
| `SHOPIFY_CLIENT_ID` | ✅ | - | Shopify OAuth client ID |
| `SHOPIFY_CLIENT_SECRET` | ✅ | - | Shopify OAuth client secret |
| `SHOPIFY_SCOPES` | ✅ | (see below) | Required Shopify API scopes |
| `SHOPIFY_WEBHOOK_SECRET` | ✅ | - | HMAC verification secret |
| `ENCRYPTION_KEY` | ✅ | - | Token encryption key |
| `AI_PROVIDER` | ✅ | `anthropic` | AI provider: anthropic, openai, ollama |
| `ANTHROPIC_API_KEY` | ⚠️ | - | Claude API key (if using Anthropic) |
| `OPENAI_API_KEY` | ⚠️ | - | GPT API key (if using OpenAI) |
| `EMAIL_PROVIDER_API_KEY` | ✅ | - | Resend/SendGrid API key |
| `NODE_ENV` | ✅ | `development` | Environment: development, production, test |
| `LOG_LEVEL` | ❌ | `info` | Log verbosity level |
| `SENTRY_DSN` | ❌ | - | Sentry error tracking DSN |
| `AI_MODEL_TIER` | ❌ | `balanced` | Model tier: fast, balanced, powerful |
| `AI_MAX_TOKENS` | ❌ | `2000` | Max tokens per AI generation |
| `AI_TEMPERATURE` | ❌ | `0.7` | AI generation temperature |
| `OLLAMA_BASE_URL` | ⚠️ | `http://localhost:11434` | Ollama API URL (if using Ollama) |
| `OLLAMA_MODEL` | ⚠️ | `llama3.2` | Ollama model name |
| `AI_FALLBACK_PROVIDER` | ❌ | - | Fallback AI provider |
| `AI_ENABLE_FALLBACK_TEMPLATES` | ❌ | `true` | Use templates if AI fails |

**Legend:**
- ✅ Required for all deployments
- ⚠️ Required conditionally
- ❌ Optional

---

## Database Configuration

### `DATABASE_URL`

PostgreSQL connection string for Prisma ORM.

**Format:**
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

**Examples:**

```bash
# Local development
DATABASE_URL="postgresql://merchops:password@localhost:5432/merchops_dev?schema=public"

# Render (auto-provided)
DATABASE_URL="postgresql://merchops_user:***@dpg-xxx.oregon-postgres.render.com/merchops"

# Railway (auto-provided)
DATABASE_URL="postgresql://postgres:***@containers-us-west-xxx.railway.app:6543/railway"

# Supabase (with connection pooling)
DATABASE_URL="postgresql://postgres:***@db.xxx.supabase.co:6543/postgres?pgbouncer=true"

# With connection pooling parameters
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

**Production Considerations:**

1. **Connection Pooling:**
   - Add `connection_limit=10` to prevent exhaustion
   - Add `pool_timeout=20` for better reliability
   - Use platform-specific pooler if available (e.g., Supabase port 6543)

2. **SSL/TLS:**
   - Most platforms enforce SSL automatically
   - Add `sslmode=require` if needed

3. **Security:**
   - Never commit to version control
   - Use platform secret management
   - Rotate credentials periodically

---

## Redis Configuration

### `REDIS_URL`

Redis connection string for BullMQ job queue and caching.

**Format:**
```
redis://[USERNAME]:[PASSWORD]@HOST:PORT/DATABASE
```

**Examples:**

```bash
# Local development
REDIS_URL="redis://localhost:6379/0"

# Render (auto-provided)
REDIS_URL="redis://red-xxx:6379"

# Railway (auto-provided)
REDIS_URL="redis://default:***@containers-us-west-xxx.railway.app:6379"

# Upstash (with TLS)
REDIS_URL="rediss://default:***@xxx.upstash.io:6379"

# With password
REDIS_URL="redis://:your_password@localhost:6379/0"
```

**Production Considerations:**

1. **TLS:** Some providers require `rediss://` (note double 's')
2. **Persistence:** Enable AOF or RDB persistence for job durability
3. **Memory Policy:** Set `maxmemory-policy: allkeys-lru`
4. **Max Memory:** Allocate at least 512MB for production

---

## Authentication Configuration

### `NEXTAUTH_SECRET`

Secret key for encrypting NextAuth session tokens.

**Generation:**
```bash
openssl rand -base64 32
```

**Example:**
```bash
NEXTAUTH_SECRET="hX9kL2mN5pQ8rS1tU4vW7yZ0aB3cD6eF"
```

**Security:**
- Must be at least 32 characters
- Use cryptographically random generation
- Rotate periodically (requires re-login)
- Different value per environment

### `NEXTAUTH_URL`

Base URL of your application for OAuth callbacks.

**Examples:**
```bash
# Local development
NEXTAUTH_URL="http://localhost:3000"

# Production (Render)
NEXTAUTH_URL="https://merchops-web.onrender.com"

# Production (custom domain)
NEXTAUTH_URL="https://app.merchops.com"

# Staging
NEXTAUTH_URL="https://staging.merchops.com"
```

**Important:**
- Must match exactly (including protocol and port)
- No trailing slash
- Must be HTTPS in production
- Update when changing domains

---

## Shopify Integration

### `SHOPIFY_CLIENT_ID`

OAuth client ID from Shopify Partner Dashboard.

**Where to find:**
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Navigate to Apps → Your App → App Setup
3. Copy "Client ID"

**Example:**
```bash
SHOPIFY_CLIENT_ID="1a2b3c4d5e6f7g8h9i0j"
```

### `SHOPIFY_CLIENT_SECRET`

OAuth client secret from Shopify Partner Dashboard.

**Where to find:**
1. Same location as Client ID
2. Click "Show" next to Client Secret
3. Copy value

**Example:**
```bash
SHOPIFY_CLIENT_SECRET="your-shopify-client-secret-from-partner-dashboard"
```

**Security:**
- Never expose in client-side code
- Store in platform secrets
- Rotate if compromised

### `SHOPIFY_SCOPES`

Space-separated list of required Shopify API scopes.

**Required scopes for MerchOps MVP:**
```bash
SHOPIFY_SCOPES="read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,write_discounts,read_price_rules,write_price_rules"
```

**Scope breakdown:**

| Scope | Why Needed |
|-------|------------|
| `read_products` | Fetch product data for opportunities |
| `write_products` | Pause products (inventory risk) |
| `read_orders` | Analyze order patterns |
| `read_customers` | Identify dormant customers |
| `read_inventory` | Detect inventory thresholds |
| `write_inventory` | Update inventory levels |
| `write_discounts` | Create discount codes |
| `read_price_rules` | Check existing discounts |
| `write_price_rules` | Create price rules |

**Adding scopes:**
1. Update this variable
2. Re-authenticate Shopify connection
3. Users will be prompted to re-approve

### `SHOPIFY_WEBHOOK_SECRET`

Secret for verifying Shopify webhook HMAC signatures.

**Generation:**
```bash
openssl rand -base64 32
```

**Example:**
```bash
SHOPIFY_WEBHOOK_SECRET="whs_9k2L5mN8pQ1rS4tU7vW0yZ3aB6cD9e"
```

**Important:**
- Must match the secret configured in Shopify webhook settings
- Different secret per environment recommended
- Used to prevent webhook spoofing

**Setting in Shopify:**
1. Admin → Settings → Notifications → Webhooks
2. Create webhook with this secret
3. Or set via API when creating webhooks programmatically

---

## Encryption Configuration

### `ENCRYPTION_KEY`

AES-256 encryption key for encrypting Shopify access tokens at rest.

**Generation:**
```bash
openssl rand -hex 32
```

**Example:**
```bash
ENCRYPTION_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

**Security:**
- Must be exactly 64 hexadecimal characters (32 bytes)
- Never change in production (would invalidate all stored tokens)
- Store in platform secrets, never in code
- Use different key per environment

**Why needed:**
Shopify access tokens are stored encrypted in the database per security best practices. This key is used for AES-256-GCM encryption.

---

## AI Provider Configuration

### `AI_PROVIDER`

Primary AI provider for generating opportunity explanations.

**Options:**
- `anthropic` - Claude (recommended)
- `openai` - GPT-4
- `ollama` - Local LLM

**Default:**
```bash
AI_PROVIDER="anthropic"
```

**Choosing a provider:**

| Provider | Pros | Cons |
|----------|------|------|
| Anthropic | Best reasoning, safe, reliable | Requires API key |
| OpenAI | Fast, widely supported | Higher cost |
| Ollama | Free, private, no API | Requires local setup |

### `ANTHROPIC_API_KEY`

Claude API key from Anthropic Console.

**Where to get:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create account or sign in
3. Navigate to API Keys
4. Create new key

**Example:**
```bash
ANTHROPIC_API_KEY="sk-ant-api03-1234567890abcdef1234567890abcdef"
```

**Required when:** `AI_PROVIDER="anthropic"`

**Models used:**
- Fast: `claude-3-haiku-20240307`
- Balanced: `claude-3-5-sonnet-20241022` (default)
- Powerful: `claude-3-5-sonnet-20241022`

### `OPENAI_API_KEY`

OpenAI API key for GPT models.

**Where to get:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account or sign in
3. Navigate to API Keys
4. Create new key

**Example:**
```bash
OPENAI_API_KEY="sk-proj-1234567890abcdefghijklmnopqrstuvwxyz"
```

**Required when:** `AI_PROVIDER="openai"`

**Models used:**
- Fast: `gpt-4o-mini`
- Balanced: `gpt-4o` (default)
- Powerful: `gpt-4o`

### `OLLAMA_BASE_URL`

Base URL for Ollama API (local LLM).

**Default:**
```bash
OLLAMA_BASE_URL="http://localhost:11434"
```

**Required when:** `AI_PROVIDER="ollama"`

**Setup:**
1. Install Ollama: [ollama.ai](https://ollama.ai)
2. Pull model: `ollama pull llama3.2`
3. Verify: `curl http://localhost:11434/api/tags`

### `OLLAMA_MODEL`

Ollama model name to use.

**Default:**
```bash
OLLAMA_MODEL="llama3.2"
```

**Recommended models:**
- `llama3.2` - Fast, good quality
- `mistral` - Very fast, lighter
- `llama3.1:70b` - Powerful, slower

### `AI_MODEL_TIER`

Model tier selection: controls cost vs quality tradeoff.

**Options:**
- `fast` - Cheapest, fastest, good for high volume
- `balanced` - Default, good quality/cost ratio
- `powerful` - Best quality, higher cost

**Default:**
```bash
AI_MODEL_TIER="balanced"
```

**Model mapping:**

| Tier | Anthropic | OpenAI | Ollama |
|------|-----------|--------|--------|
| fast | claude-3-haiku | gpt-4o-mini | llama3.2 |
| balanced | claude-3.5-sonnet | gpt-4o | llama3.2 |
| powerful | claude-3.5-sonnet | gpt-4o | llama3.1:70b |

### `AI_MAX_TOKENS`

Maximum tokens per AI generation.

**Default:**
```bash
AI_MAX_TOKENS="2000"
```

**Range:** 500-8000

**Cost implications:**
- Higher = more detailed outputs, higher cost
- Lower = more concise, cheaper

### `AI_TEMPERATURE`

AI generation temperature (creativity vs consistency).

**Default:**
```bash
AI_TEMPERATURE="0.7"
```

**Range:** 0.0-1.0

- `0.0-0.3` - Very consistent, deterministic
- `0.4-0.7` - Balanced (recommended)
- `0.8-1.0` - More creative, varied

### `AI_FALLBACK_PROVIDER`

Fallback AI provider if primary fails.

**Optional:**
```bash
AI_FALLBACK_PROVIDER="openai"
```

**Use case:** High availability - if Anthropic is down, fall back to OpenAI.

**Requirements:**
- Must have API key for fallback provider
- Will use same model tier
- Logged separately in `ai_generations` table

### `AI_ENABLE_FALLBACK_TEMPLATES`

Enable deterministic template fallback if AI fails.

**Default:**
```bash
AI_ENABLE_FALLBACK_TEMPLATES="true"
```

**Options:**
- `true` - Use template if AI fails (recommended for production)
- `false` - Throw error if AI fails (useful for testing)

**Templates:**
Predefined templates for each operator intent ensure the system never completely fails even if AI is unavailable.

---

## Email Provider Configuration

### `EMAIL_PROVIDER_API_KEY`

API key for transactional email provider (Resend or SendGrid).

**Recommended: Resend**

**Where to get:**
1. Go to [resend.com](https://resend.com)
2. Create account
3. Navigate to API Keys
4. Create new key

**Example:**
```bash
EMAIL_PROVIDER_API_KEY="re_123456789_abcdefghijklmnopqrstuvwxyz"
```

**Alternative: SendGrid**
```bash
EMAIL_PROVIDER_API_KEY="SG.1234567890abcdefghijklmnopqrstuv"
```

**Testing:**
- Use test mode key in development
- Emails will be captured, not sent
- View in provider dashboard

**Production:**
- Use production key
- Verify domain for better deliverability
- Set up DKIM/SPF records

---

## Application Configuration

### `NODE_ENV`

Application environment.

**Options:**
- `development` - Local development
- `production` - Production deployment
- `test` - Test environment
- `staging` - Staging environment

**Default:**
```bash
NODE_ENV="development"
```

**Effects:**
- Logging verbosity
- Error display
- Performance optimizations
- Caching behavior

### `LOG_LEVEL`

Logging verbosity level.

**Options:**
- `trace` - Everything (very verbose)
- `debug` - Debug information
- `info` - General information (default)
- `warn` - Warnings only
- `error` - Errors only
- `fatal` - Critical errors only

**Default:**
```bash
LOG_LEVEL="info"
```

**Recommendations:**
- Development: `debug`
- Staging: `info`
- Production: `info` or `warn`
- Debugging: `debug` or `trace` (temporary)

---

## Monitoring Configuration

### `SENTRY_DSN`

Sentry Data Source Name for error tracking.

**Where to get:**
1. Go to [sentry.io](https://sentry.io)
2. Create account or sign in
3. Create new project (Next.js)
4. Copy DSN

**Example:**
```bash
SENTRY_DSN="https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/7654321"
```

**Optional but highly recommended for production.**

**What Sentry captures:**
- Application errors
- Unhandled promise rejections
- Performance transactions
- User context (workspace ID, anonymized)
- Breadcrumbs (user actions leading to error)

**Privacy:**
- No PII captured by default
- Shopify tokens are automatically scrubbed
- Customer emails are anonymized

---

## Optional / Advanced Configuration

### Rate Limiting

```bash
# Maximum requests per window
RATE_LIMIT_MAX_REQUESTS="100"

# Window in milliseconds
RATE_LIMIT_WINDOW_MS="60000"
```

**Default:** Unlimited (not recommended for production)

### Session Configuration

```bash
# Session max age in seconds
SESSION_MAX_AGE="2592000"  # 30 days
```

**Default:** 30 days

### Feature Flags

```bash
# Enable/disable email sending (safety)
FEATURE_EMAIL_SENDING="false"

# Enable/disable auto-execution (never enable in MVP)
FEATURE_AUTO_EXECUTION="false"

# Enable/disable learning loop
FEATURE_LEARNING_LOOP="true"
```

**Purpose:** Safely roll out features or disable in emergency.

---

## Platform-Specific Variables

### Render

Render auto-provides these:
- `DATABASE_URL` (from PostgreSQL service)
- `REDIS_URL` (from Redis service)
- `RENDER_SERVICE_NAME`
- `RENDER_INSTANCE_ID`
- `RENDER_GIT_COMMIT`

### Railway

Railway auto-provides:
- `DATABASE_URL`
- `REDIS_URL`
- `RAILWAY_ENVIRONMENT`
- `RAILWAY_SERVICE_NAME`
- `RAILWAY_GIT_COMMIT_SHA`

### Fly.io

Fly.io provides:
- `FLY_APP_NAME`
- `FLY_REGION`
- `DATABASE_URL` (if using Fly Postgres)

### Vercel

Vercel provides:
- `VERCEL_ENV` (production/preview/development)
- `VERCEL_URL` (deployment URL)
- `VERCEL_GIT_COMMIT_SHA`

**Note:** Set `DATABASE_URL` and `REDIS_URL` manually on Vercel.

---

## Security Best Practices

### Secret Management

1. **Never commit secrets to version control**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use platform secret management**
   - Render: Environment variables (encrypted)
   - Railway: Variables (encrypted)
   - Fly.io: Secrets
   - Vercel: Environment variables

3. **Different secrets per environment**
   ```bash
   # Development
   NEXTAUTH_SECRET="dev-secret-123"

   # Staging
   NEXTAUTH_SECRET="staging-secret-456"

   # Production
   NEXTAUTH_SECRET="prod-secret-789"
   ```

4. **Rotate secrets periodically**
   - Quarterly for API keys
   - Annually for encryption keys (requires migration)
   - Immediately if compromised

### Secret Rotation

**Safe rotation process:**

1. **NEXTAUTH_SECRET:**
   - Update value
   - Redeploy
   - All users will be logged out (expected)

2. **ENCRYPTION_KEY:**
   - **CRITICAL:** Do not change in production
   - Requires re-encryption of all Shopify tokens
   - Plan maintenance window

3. **SHOPIFY_CLIENT_SECRET:**
   - Regenerate in Shopify Partner Dashboard
   - Update environment variable
   - Redeploy immediately

4. **AI API Keys:**
   - Create new key
   - Update environment variable
   - Delete old key after verification

---

## Environment Variable Checklist

Use this checklist when setting up a new environment:

### Required for all environments:
- [ ] `DATABASE_URL` - PostgreSQL connection
- [ ] `REDIS_URL` - Redis connection
- [ ] `NEXTAUTH_SECRET` - Generated with `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` - Application URL
- [ ] `SHOPIFY_CLIENT_ID` - From Shopify Partner Dashboard
- [ ] `SHOPIFY_CLIENT_SECRET` - From Shopify Partner Dashboard
- [ ] `SHOPIFY_SCOPES` - All required scopes listed
- [ ] `SHOPIFY_WEBHOOK_SECRET` - Generated with `openssl rand -base64 32`
- [ ] `ENCRYPTION_KEY` - Generated with `openssl rand -hex 32`
- [ ] `EMAIL_PROVIDER_API_KEY` - From Resend/SendGrid
- [ ] `NODE_ENV` - Set to `production`

### Required for AI provider:
- [ ] `AI_PROVIDER` - Set to `anthropic`, `openai`, or `ollama`
- [ ] `ANTHROPIC_API_KEY` - If using Anthropic
- [ ] `OPENAI_API_KEY` - If using OpenAI
- [ ] `OLLAMA_BASE_URL` - If using Ollama

### Optional but recommended:
- [ ] `SENTRY_DSN` - For error tracking
- [ ] `LOG_LEVEL` - Set to `info` or `warn`
- [ ] `AI_MODEL_TIER` - Default is `balanced`

### Verification:
- [ ] All required variables set
- [ ] No placeholder values remaining
- [ ] Secrets generated with cryptographically secure methods
- [ ] Different secrets per environment
- [ ] All secrets stored in platform secret management
- [ ] No secrets in version control

---

## Example .env Files

### Development (.env.example)

See root `.env.example` file - already complete.

### Production (minimal)

```bash
# Auto-provided by platform
DATABASE_URL=<from-platform>
REDIS_URL=<from-platform>

# Generate
NEXTAUTH_SECRET=<openssl rand -base64 32>
SHOPIFY_WEBHOOK_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -hex 32>

# Configure
NEXTAUTH_URL=https://your-app.com
SHOPIFY_CLIENT_ID=<from-shopify>
SHOPIFY_CLIENT_SECRET=<from-shopify>
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,write_discounts,read_price_rules,write_price_rules
ANTHROPIC_API_KEY=<from-anthropic>
EMAIL_PROVIDER_API_KEY=<from-resend>
SENTRY_DSN=<from-sentry>

# Defaults
NODE_ENV=production
AI_PROVIDER=anthropic
AI_MODEL_TIER=balanced
LOG_LEVEL=info
```

---

## Troubleshooting

### Missing Variables

**Error:**
```
Error: Missing environment variable: NEXTAUTH_SECRET
```

**Solution:**
Check that variable is set in platform dashboard and redeploy.

### Invalid Format

**Error:**
```
Error: Invalid DATABASE_URL format
```

**Solution:**
Verify connection string format matches provider requirements.

### Wrong Values

**Error:**
```
Shopify OAuth error: invalid_client
```

**Solution:**
Verify `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` match Shopify Partner Dashboard.

### Verification Script

Run this to verify environment variables:

```typescript
// scripts/verify-env.ts
const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'ENCRYPTION_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing: ${key}`);
  } else {
    console.log(`✓ ${key}`);
  }
}
```

```bash
# Run verification
pnpm tsx scripts/verify-env.ts
```

---

## Additional Resources

- [Deployment Guide](./README.md)
- [Security Documentation](../security.md)
- [Local Development Setup](../local-development.md)
- [Shopify OAuth Setup](../api/shopify-oauth.md)
