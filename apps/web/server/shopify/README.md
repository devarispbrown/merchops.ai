# Shopify Integration

Complete OAuth and webhook system for MerchOps Shopify integration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Shopify Integration                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  OAuth Flow          Webhooks          Data Sync             │
│  ├── config.ts       ├── webhooks.ts   ├── sync.ts          │
│  ├── oauth.ts        └── handlers/     └── client.ts        │
│  └── client.ts           ├── orders.ts                      │
│                          ├── products.ts                     │
│                          ├── inventory.ts                    │
│                          └── customers.ts                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Files Overview

### Core Configuration
- **config.ts**: Central Shopify configuration including API version, scopes, rate limits
- **oauth.ts**: OAuth flow utilities (token exchange, HMAC verification, encryption)
- **client.ts**: Shopify API client with rate limiting and retry logic
- **webhooks.ts**: Webhook registration, verification, and management
- **sync.ts**: Initial data synchronization for new connections

### Webhook Handlers
- **handlers/orders.ts**: Handle order creation and payment webhooks
- **handlers/products.ts**: Handle product update webhooks
- **handlers/inventory.ts**: Handle inventory level change webhooks
- **handlers/customers.ts**: Handle customer update webhooks

### API Routes
- **/api/shopify/auth**: Initiate OAuth flow
- **/api/shopify/callback**: Handle OAuth callback and token exchange
- **/api/shopify/webhooks**: Receive and process webhooks
- **/api/shopify/revoke**: Handle app uninstallation

## Security Features

### OAuth Security
- CSRF protection with state parameter
- HMAC signature verification on callback
- Timestamp validation (max 24 hours)
- Shop domain validation
- Scope verification

### Webhook Security
- HMAC-SHA256 signature verification
- Timing-safe comparison for HMAC validation
- Quick acknowledgment (< 5 seconds)
- Async processing to prevent blocking

### Token Security
- AES-256-GCM encryption at rest
- Random IV per encryption
- Authentication tags for integrity
- Secure key management via environment variables

## OAuth Flow

```
User                    MerchOps                   Shopify
  │                         │                         │
  │   Install App           │                         │
  ├────────────────────────>│                         │
  │                         │                         │
  │                         │   Redirect to OAuth     │
  │                         ├────────────────────────>│
  │                         │                         │
  │   Authorize App         │                         │
  │<────────────────────────┼─────────────────────────┤
  ├────────────────────────>│                         │
  │                         │                         │
  │                         │   Callback with code    │
  │                         │<────────────────────────┤
  │                         │                         │
  │                         │   Exchange for token    │
  │                         ├────────────────────────>│
  │                         │                         │
  │                         │   Access token          │
  │                         │<────────────────────────┤
  │                         │                         │
  │                         │   Register webhooks     │
  │                         ├────────────────────────>│
  │                         │                         │
  │   Redirect to dashboard │                         │
  │<────────────────────────┤                         │
  │                         │                         │
```

## Webhook Topics

| Topic | Handler | Events Created |
|-------|---------|----------------|
| orders/create | orders.ts | velocity_spike (if applicable) |
| orders/paid | orders.ts | Learning loop outcomes |
| products/update | products.ts | product_back_in_stock |
| inventory_levels/update | inventory.ts | inventory_threshold_crossed, product_out_of_stock |
| customers/update | customers.ts | customer_inactivity_threshold |

## Rate Limiting

### Shopify REST Admin API
- **Limit**: 2 requests per second
- **Strategy**: Request queue with exponential backoff
- **Retry**: Up to 5 retries with jitter
- **Backoff**: 1s → 2s → 4s → 8s → 16s (max 32s)

### Implementation
```typescript
// Automatic rate limiting in ShopifyClient
const client = new ShopifyClient(shop, encryptedToken);
const products = await client.getProducts(); // Rate limited automatically
```

## Error Handling

### OAuth Errors
- Invalid shop domain → 400 Bad Request
- HMAC verification failed → 401 Unauthorized
- Missing state/code → 400 Bad Request
- Expired timestamp → 400 Bad Request
- Insufficient scopes → 400 Bad Request

### Webhook Errors
- Invalid HMAC → 401 Unauthorized (but logged for investigation)
- Missing headers → 400 Bad Request
- Processing errors → Always return 200 (prevent Shopify retries)

### API Client Errors
- Rate limit (429) → Automatic retry with backoff
- Server errors (5xx) → Automatic retry up to 5 times
- Client errors (4xx) → Throw ShopifyApiError
- Network errors → Throw with timeout

## Environment Variables

Required environment variables:

```bash
# Shopify App Credentials
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app.com
SHOPIFY_SCOPES=read_products,write_products,read_inventory,read_orders,read_customers,write_price_rules,write_discounts

# Token Encryption (64 hex characters / 32 bytes)
SHOPIFY_TOKEN_ENCRYPTION_KEY=your_64_char_hex_key

# Database
DATABASE_URL=postgresql://...
```

## Initial Sync

When a shop connects, an initial sync job is queued:

```typescript
await performInitialSync({
  workspaceId,
  shop,
  encryptedToken,
  correlationId,
  limits: {
    products: 1000,  // Optional limit for testing
    orders: 1000,
    customers: 1000,
  },
});
```

### Sync Process
1. **Products**: Paginated fetch (50 per page)
2. **Orders**: Paginated fetch (50 per page)
3. **Customers**: Paginated fetch (50 per page)
4. **Inventory Levels**: Bulk fetch (250 max)

All data is stored in `shopify_objects_cache` table with versioning.

## Correlation IDs

Every request, webhook, and sync operation has a correlation ID for tracing:

```
[Shopify Auth] Initiating OAuth
  correlationId: "550e8400-e29b-41d4-a716-446655440000"

[Shopify Callback] Token exchange successful
  correlationId: "550e8400-e29b-41d4-a716-446655440000"

[Webhook Receiver] orders/create processed
  correlationId: "550e8400-e29b-41d4-a716-446655440000"
```

## Testing

### Manual OAuth Testing
1. Start development server
2. Visit: `http://localhost:3000/api/shopify/auth?shop=your-store.myshopify.com`
3. Authorize in Shopify
4. Verify callback completes successfully
5. Check webhooks registered in Shopify admin

### Webhook Testing
Use Shopify CLI to send test webhooks:
```bash
shopify webhook trigger --topic orders/create --address https://your-app.com/api/shopify/webhooks
```

### HMAC Testing
```typescript
import { verifyHmac } from '@/server/shopify/oauth';

const query = {
  code: 'abc123',
  shop: 'store.myshopify.com',
  timestamp: '1234567890',
  hmac: 'calculated_hmac',
};

const isValid = verifyHmac(query);
```

## Database Schema

### ShopifyConnection
```prisma
model ShopifyConnection {
  id                     String   @id @default(uuid())
  workspace_id           String   @unique
  store_domain           String
  access_token_encrypted String
  scopes                 String
  status                 ShopifyConnectionStatus @default(active)
  installed_at           DateTime @default(now())
  revoked_at             DateTime?
}
```

### ShopifyObjectCache
```prisma
model ShopifyObjectCache {
  id           String   @id @default(uuid())
  workspace_id String
  object_type  String
  shopify_id   String
  data_json    Json
  version      Int      @default(1)
  synced_at    DateTime @default(now())

  @@unique([workspace_id, object_type, shopify_id])
}
```

## Best Practices

### 1. Always Use Correlation IDs
```typescript
const correlationId = crypto.randomUUID();
console.log('[Operation]', { correlationId, ...data });
```

### 2. Handle Rate Limits Gracefully
```typescript
// Client handles automatically, but respect limits
const client = new ShopifyClient(shop, token);
```

### 3. Verify Webhooks
```typescript
if (!verifyWebhookHmac(body, hmac)) {
  return NextResponse.json({ error: 'Invalid' }, { status: 401 });
}
```

### 4. Acknowledge Webhooks Fast
```typescript
// Return 200 within 5 seconds
processWebhookAsync(data).catch(console.error);
return NextResponse.json({ received: true });
```

### 5. Store Tokens Encrypted
```typescript
const encryptedToken = encryptToken(plainToken);
// Store encryptedToken in database
```

## Troubleshooting

### OAuth fails at callback
- Check SHOPIFY_API_SECRET is correct
- Verify SHOPIFY_APP_URL matches redirect URI
- Check state cookie is set and valid
- Verify HMAC calculation

### Webhooks not receiving
- Check webhook URL is publicly accessible
- Verify HMAC secret matches SHOPIFY_API_SECRET
- Check Shopify admin for webhook status
- Look for delivery failures in Shopify

### Rate limiting issues
- Check request frequency in logs
- Verify rate limiter queue is processing
- Increase backoff times if needed
- Consider implementing request batching

### Token decryption fails
- Verify SHOPIFY_TOKEN_ENCRYPTION_KEY is 64 hex chars
- Check key hasn't changed since encryption
- Ensure IV and auth tag are intact

## Future Enhancements

- [ ] Implement offline access tokens for long-term access
- [ ] Add GraphQL API support for better performance
- [ ] Implement webhook retry queue with DLQ
- [ ] Add webhook signature caching
- [ ] Implement incremental sync (not just initial)
- [ ] Add webhook delivery status monitoring
- [ ] Implement automatic token refresh
- [ ] Add webhook event replay capability
- [ ] Create admin UI for connection status
- [ ] Add metrics and monitoring dashboards
