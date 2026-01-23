# Email Integration - Resend Implementation

## Overview

This document describes the Resend email sending integration for MerchOps win-back email campaigns.

## Features Implemented

### 1. Resend SDK Integration
- Installed `resend@6.8.0` package
- Configured Resend client with API key from environment
- Parallel email sending support

### 2. Email Sending
- HTML and plain text versions
- Configurable From address (per workspace or default)
- Reply-To address support
- Message tracking (opens and link clicks)
- Metadata storage for workspace and customer tracking

### 3. Sandbox Mode
- When `EMAIL_SANDBOX_MODE=true`, emails are logged but not sent
- Draft mode creates execution logs without actual delivery
- Safe for testing and development

### 4. Email Structure
- Subject line from draft payload
- HTML body with automatic unsubscribe link injection
- Plain text fallback
- Recipient email from customer data
- Reply-to address (merchant's email)
- Unsubscribe link automatically appended
- Tags for workspace, segment, and customer tracking

### 5. Execution Logging
- Resend response stored in `Execution.provider_response_json`
- Includes: message_id (id), to, error (if failed)
- Success/failure tracking
- Individual recipient status tracking

### 6. Error Handling
- Resend-specific error codes mapped to execution error taxonomy
- Network errors (retryable)
- Authentication errors (non-retryable)
- Rate limits (retryable)
- Invalid email addresses (non-retryable)
- Service unavailable (retryable)

### 7. Environment Configuration

```env
# Email Provider Selection
EMAIL_PROVIDER="resend"

# Resend API Configuration
RESEND_API_KEY="your-resend-api-key"

# Default From Address
EMAIL_FROM_ADDRESS="noreply@merchops.com"

# Sandbox Mode (for testing)
EMAIL_SANDBOX_MODE="true"
```

## Error Classification

| Resend Status Code | MerchOps Error Code | Retryable |
|---------------------|---------------------|-----------|
| 400 | INVALID_PAYLOAD | No |
| 401, 403 | INVALID_TOKEN | No |
| 404 | INVALID_PAYLOAD | No |
| 422 | INVALID_PAYLOAD | No |
| 429 | RATE_LIMIT_EXCEEDED | Yes |
| 500, 503 | NETWORK_ERROR | Yes |
| ECONNREFUSED | NETWORK_ERROR | Yes |
| ETIMEDOUT | NETWORK_ERROR | Yes |

## Usage Example

```typescript
import { executeEmail } from '@/server/actions/execute/email';

const result = await executeEmail({
  workspaceId: 'workspace-123',
  payload: {
    subject: 'We miss you!',
    preview_text: 'Come back for exclusive offers',
    body_html: '<h1>Welcome Back!</h1><p>Special offer inside.</p>',
    body_text: 'Welcome Back! Special offer inside.',
    from_name: 'MerchOps Store',
    from_email: 'store@example.com',
    recipient_segment: 'dormant_30_days',
  },
});

if (result.success) {
  console.log('Email sent:', result.providerResponse.messageIds);
} else {
  console.error('Email failed:', result.error);
}
```

## Provider Response Structure

### Success Response
```json
{
  "provider": "resend",
  "messageIds": ["abc-123", "def-456"],
  "recipientCount": 2,
  "successCount": 2,
  "failureCount": 0,
  "results": [
    {
      "id": "abc-123",
      "to": "customer1@example.com"
    },
    {
      "id": "def-456",
      "to": "customer2@example.com"
    }
  ],
  "status": "sent",
  "executedAt": "2024-01-15T10:30:00Z"
}
```

### Partial Failure Response
```json
{
  "provider": "resend",
  "messageIds": ["abc-123", ""],
  "recipientCount": 2,
  "successCount": 1,
  "failureCount": 1,
  "results": [
    {
      "id": "abc-123",
      "to": "good@example.com"
    },
    {
      "id": "",
      "to": "invalid@",
      "error": "Invalid email address"
    }
  ],
  "status": "partially_sent",
  "executedAt": "2024-01-15T10:30:00Z"
}
```

## Unsubscribe Link

The system automatically appends an unsubscribe link to all HTML emails:

- Format: `{NEXTAUTH_URL}/unsubscribe?workspace={workspaceId}`
- Styled footer with border and centered text
- Inserted before `</body>` tag if present, otherwise appended to end

## Bounce/Delivery Tracking

### Webhook Setup (Future Enhancement)

To enable bounce and delivery tracking, configure Resend webhooks:

1. Go to Resend > Settings > Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/resend`
3. Enable events:
   - email.sent
   - email.delivered
   - email.bounced
   - email.complained
   - email.opened
   - email.clicked

### Webhook Handler (To Be Implemented)

```typescript
// app/api/webhooks/resend/route.ts
export async function POST(request: Request) {
  const event = await request.json();

  // Verify webhook signature
  // Update execution record with delivery status
  // Record bounces and complaints
  // Track opens and clicks for learning loop
}
```

## Testing

### Unit Tests
- Email construction validation
- Sandbox mode behavior
- Error classification logic
- From address formatting
- Unsubscribe link generation

### Integration Tests
- Full send flow with mocked Postmark API
- Batch email handling
- Mixed success/failure scenarios
- Metadata storage
- Error handling and retry logic

### Running Tests
```bash
pnpm test -- email
```

## Security Considerations

1. API Key Storage
   - Never commit `RESEND_API_KEY` to version control
   - Use environment variables only
   - Rotate keys regularly

2. Email Validation
   - All email addresses validated by Resend
   - Invalid addresses rejected before sending
   - Bounce handling prevents future sends to bad addresses

3. Spam Prevention
   - Unsubscribe link in all emails
   - Respect bounce notifications
   - Track spam complaints

4. Data Privacy
   - Minimal PII in tags
   - Customer IDs only (not names or other details)
   - GDPR compliance considerations

## Performance

- Parallel sending using Promise.all for efficiency
- Async sending doesn't block UI
- Retry logic for transient failures
- Rate limit handling with exponential backoff

## Monitoring

Key metrics to track:
- Send success rate
- Bounce rate
- Spam complaint rate
- Open rate
- Click-through rate
- Delivery time (p50, p95, p99)

## Troubleshooting

### Email Not Sending

1. Check `EMAIL_SANDBOX_MODE` is false in production
2. Verify `RESEND_API_KEY` is set correctly
3. Check Resend account status and limits
4. Review execution logs for error details

### High Bounce Rate

1. Validate email addresses before adding to segment
2. Remove bounced addresses from future sends
3. Verify domain reputation in Resend dashboard

### Rate Limits

1. Resend limits vary by plan (check current limits in dashboard)
2. Implement send throttling if needed
3. Upgrade Resend plan for higher limits

## Future Enhancements

1. Bounce webhook processing
2. Open/click tracking integration
3. Template support (Resend templates via React Email)
4. A/B testing for subject lines
5. Scheduled sending (not immediate)
6. Attachment support
7. Multiple recipient support (To, Cc, Bcc)
8. Email preview generation
