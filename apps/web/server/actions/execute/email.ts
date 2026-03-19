/**
 * MerchOps Email Execution
 * Creates email drafts or sends via email provider
 */

import { Resend } from "resend";

import { prisma } from "../../db/client";
import { WinbackEmailPayload, ExecutionErrorCode, ExecutionError } from "../types";
import { filterSuppressedRecipients } from "../../klaviyo/frequency-caps";

// ============================================================================
// TYPES
// ============================================================================

interface ExecuteEmailInput {
  workspaceId: string;
  payload: WinbackEmailPayload;
}

interface ExecuteEmailResult {
  success: boolean;
  providerResponse: unknown;
  error?: ExecutionError;
}

enum EmailProvider {
  DRAFT_ONLY = "draft_only", // MVP: Just create draft, don't send
  RESEND = "resend",
  SENDGRID = "sendgrid",
}

interface ResendSendResult {
  id: string;
  to: string;
  error?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function executeEmail(input: ExecuteEmailInput): Promise<ExecuteEmailResult> {
  const { workspaceId, payload } = input;

  try {
    // Get email provider configuration
    const provider = await getEmailProvider(workspaceId);

    let result: Record<string, unknown>;

    switch (provider) {
      case EmailProvider.DRAFT_ONLY:
        result = await createEmailDraft(workspaceId, payload);
        break;

      case EmailProvider.RESEND:
        result = await sendViaResend(workspaceId, payload);
        break;

      case EmailProvider.SENDGRID:
        result = await sendViaSendGrid(workspaceId, payload);
        break;

      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }

    return {
      success: true,
      providerResponse: {
        ...result,
        provider,
        executedAt: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const executionError = classifyError(error);
    return {
      success: false,
      providerResponse: null,
      error: executionError,
    };
  }
}

// ============================================================================
// EMAIL PROVIDER SELECTION
// ============================================================================

async function getEmailProvider(_workspaceId: string): Promise<EmailProvider> {
  // Check environment configuration first
  const sandboxMode = process.env.EMAIL_SANDBOX_MODE === "true";

  if (sandboxMode) {
    return EmailProvider.DRAFT_ONLY;
  }

  // Get provider from environment or workspace configuration
  const provider = process.env.EMAIL_PROVIDER || "draft_only";

  switch (provider.toLowerCase()) {
    case "resend":
      return EmailProvider.RESEND;
    case "sendgrid":
      return EmailProvider.SENDGRID;
    default:
      return EmailProvider.DRAFT_ONLY;
  }
}

// ============================================================================
// DRAFT-ONLY MODE (MVP)
// ============================================================================

async function createEmailDraft(
  workspaceId: string,
  payload: WinbackEmailPayload
): Promise<Record<string, unknown>> {
  // Store email as a draft that can be reviewed and sent manually
  // Database integration would go here

  // Get recipient count from the real segment query
  const rawRecipients = await getRecipients(workspaceId, payload.recipient_segment);

  // Filter suppressed profiles — soft integration, proceeds if Klaviyo unavailable
  const { recipients, suppressedCount, checked } = await filterSuppressedRecipients(
    workspaceId,
    rawRecipients
  );
  const recipientCount = recipients.length;

  // eslint-disable-next-line no-console
  console.log("[EXECUTE] Creating email draft:", {
    subject: payload.subject,
    recipientSegment: payload.recipient_segment,
    recipientCount,
    ...(checked && { suppressedFiltered: suppressedCount }),
  });

  // In production, this might create a draft in the email provider
  // For now, we just return draft metadata
  return {
    mode: "draft",
    draftId: `draft_${Date.now()}`,
    subject: payload.subject,
    recipientSegment: payload.recipient_segment,
    estimatedRecipients: recipientCount,
    createdAt: new Date().toISOString(),
    status: "draft_created",
    message: "Email draft created. Manual send required.",
  };
}

// ============================================================================
// RESEND INTEGRATION
// ============================================================================

async function sendViaResend(
  workspaceId: string,
  payload: WinbackEmailPayload
): Promise<Record<string, unknown>> {
  // Validate API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  // Initialize Resend client
  const resend = new Resend(apiKey);

  // Get recipients and filter suppressed profiles (soft integration)
  const rawRecipients = await getRecipients(workspaceId, payload.recipient_segment);

  const { recipients, suppressedCount, checked } = await filterSuppressedRecipients(
    workspaceId,
    rawRecipients
  );

  if (recipients.length === 0) {
    throw new Error("No recipients found for segment");
  }

  // eslint-disable-next-line no-console
  console.log("[EXECUTE] Sending email via Resend:", {
    subject: payload.subject,
    recipientCount: recipients.length,
    ...(checked && { suppressedFiltered: suppressedCount }),
  });

  try {
    // Prepare email messages
    const fromAddress = getFromAddress(payload);
    const replyToAddress = payload.from_email;
    const unsubscribeLink = getUnsubscribeLink(workspaceId);

    // Add unsubscribe link to HTML body
    const htmlBodyWithUnsubscribe = appendUnsubscribeLink(
      payload.body_html,
      unsubscribeLink
    );

    // Send emails individually (Resend doesn't have batch API in the same way)
    // We'll send them in parallel using Promise.all
    const sendPromises = recipients.map(async (recipient) => {
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: recipient.email,
        subject: payload.subject,
        html: htmlBodyWithUnsubscribe,
        text: payload.body_text,
        replyTo: replyToAddress,
        tags: [
          { name: "workspace_id", value: workspaceId },
          { name: "segment", value: payload.recipient_segment },
          { name: "customer_id", value: recipient.id },
        ],
      });

      if (error) {
        return {
          id: "",
          to: recipient.email,
          error: error.message || "Unknown error",
        };
      }

      return {
        id: data?.id || "",
        to: recipient.email,
        error: undefined,
      };
    });

    // Wait for all emails to be sent
    const results: ResendSendResult[] = await Promise.all(sendPromises);

    // Check for any errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("[EXECUTE] Some emails failed:", errors);
    }

    const successCount = results.filter((r) => !r.error).length;

    return {
      provider: "resend",
      messageIds: results.map((r) => r.id),
      recipientCount: recipients.length,
      successCount,
      failureCount: errors.length,
      results,
      status: errors.length === 0 ? "sent" : "partially_sent",
      executedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("[EXECUTE] Resend API error:", error);
    throw error;
  }
}

// ============================================================================
// SENDGRID INTEGRATION
// ============================================================================

async function sendViaSendGrid(
  workspaceId: string,
  payload: WinbackEmailPayload
): Promise<Record<string, unknown>> {
  // TODO: Implement SendGrid integration
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  // Get recipients and filter suppressed profiles (soft integration)
  const rawRecipients = await getRecipients(workspaceId, payload.recipient_segment);

  const { recipients, suppressedCount, checked } = await filterSuppressedRecipients(
    workspaceId,
    rawRecipients
  );

  if (recipients.length === 0) {
    throw new Error("No recipients found for segment");
  }

  // eslint-disable-next-line no-console
  console.log("[EXECUTE] Sending email via SendGrid:", {
    subject: payload.subject,
    recipientCount: recipients.length,
    ...(checked && { suppressedFiltered: suppressedCount }),
  });

  // Mock send
  // const msg = {
  //   personalizations: recipients.map(recipient => ({
  //     to: [{ email: recipient.email }],
  //   })),
  //   from: {
  //     email: payload.from_email,
  //     name: payload.from_name,
  //   },
  //   subject: payload.subject,
  //   html: payload.body_html,
  //   text: payload.body_text,
  // };
  // await sgMail.send(msg);

  return {
    provider: "sendgrid",
    recipientCount: recipients.length,
    status: "sent",
  };
}

// ============================================================================
// ROLLBACK
// ============================================================================

export async function rollbackEmail(params: {
  workspaceId: string;
  providerResponse: unknown;
}): Promise<void> {
  const { providerResponse } = params;

  // Email sends cannot be rolled back
  // We mark them as "sent, no rollback available"
  console.warn("[ROLLBACK] Email has already been sent. Rollback not possible.");
  console.warn("[ROLLBACK] Provider response:", providerResponse);

  // In a real system, you might:
  // 1. Send a follow-up "ignore previous email" message
  // 2. Mark the campaign as cancelled in your system
  // 3. Log the rollback attempt for audit

  throw new Error(
    "Email rollback not supported. Email has already been sent to recipients."
  );
}

// ============================================================================
// RECIPIENT MANAGEMENT
// ============================================================================

interface Recipient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Shape of a Shopify customer payload stored in ShopifyObjectCache.data_json
interface ShopifyCustomerPayload {
  id: number | string;
  email?: string;
  first_name?: string;
  last_name?: string;
  // Shopify stores the last order date here on the customer object (updated via webhooks / sync)
  last_order_id?: number | string | null;
  // email_marketing_consent is present on Shopify customers API response
  email_marketing_consent?: {
    state?: string; // "subscribed" | "unsubscribed" | "not_subscribed" | "pending" | "redacted"
    opt_in_level?: string;
    consent_updated_at?: string | null;
  } | null;
  // Some sync implementations surface last_order_at at the top level
  last_order_at?: string | null;
  // orders_count is cached by the Shopify API
  orders_count?: number;
}

// Shape of a Shopify order payload stored in ShopifyObjectCache.data_json
interface ShopifyOrderPayload {
  id: number | string;
  created_at?: string;
  customer?: {
    id: number | string;
  } | null;
}

/**
 * Valid dormant segment identifiers that can be used in recipient_segment.
 */
const DORMANT_SEGMENTS = ["dormant_30", "dormant_60", "dormant_90"] as const;
type DormantSegment = (typeof DORMANT_SEGMENTS)[number];

function isDormantSegment(segment: string): segment is DormantSegment {
  return (DORMANT_SEGMENTS as readonly string[]).includes(segment);
}

/**
 * Returns the dormancy threshold in days for a given segment string.
 * Returns null for non-dormant segments.
 */
function dormantThresholdDays(segment: DormantSegment): number {
  switch (segment) {
    case "dormant_30":
      return 30;
    case "dormant_60":
      return 60;
    case "dormant_90":
      return 90;
  }
}

/**
 * Queries the ShopifyObjectCache for real customer recipients matching the
 * given segment. Returns an empty array for unknown or empty segments so the
 * caller can surface the appropriate `no_recipients` status.
 *
 * Segment values:
 *   dormant_30  – customers whose last order was >30 days ago
 *   dormant_60  – customers whose last order was >60 days ago
 *   dormant_90  – customers whose last order was >90 days ago
 *   all_customers – all customers with a valid email address
 *
 * Customers without an email address are always excluded.
 *
 * NOTE: email_marketing_consent filtering – if the Shopify customer payload
 * contains `email_marketing_consent.state`, only customers with
 * state === "subscribed" are included. If the field is absent the customer is
 * included (opt-in data not yet available for this store).
 * TODO: enforce consent filtering strictly once all syncs populate this field.
 */
export async function getRecipients(workspaceId: string, segment: string): Promise<Recipient[]> {
  if (!segment) {
    return [];
  }

  // Fetch all cached customers for this workspace
  const customerRows = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id: workspaceId,
      object_type: "customer",
    },
  });

  if (customerRows.length === 0) {
    return [];
  }

  // For dormant segments we need order data to determine last-order date
  let orderRowsByCustomerId: Map<string, Date> | null = null;

  if (isDormantSegment(segment)) {
    const orderRows = await prisma.shopifyObjectCache.findMany({
      where: {
        workspace_id: workspaceId,
        object_type: "order",
      },
    });

    // Build a map of customerId -> most-recent order date
    const latestOrderDate = new Map<string, Date>();

    for (const row of orderRows) {
      const orderData = row.data_json as unknown as ShopifyOrderPayload;
      const customerId = orderData.customer?.id;
      if (!customerId) {
        continue;
      }
      const customerKey = String(customerId);
      const orderDate = orderData.created_at ? new Date(orderData.created_at) : null;
      if (!orderDate || isNaN(orderDate.getTime())) {
        continue;
      }
      const existing = latestOrderDate.get(customerKey);
      if (!existing || orderDate > existing) {
        latestOrderDate.set(customerKey, orderDate);
      }
    }

    orderRowsByCustomerId = latestOrderDate;
  }

  const now = new Date();
  const recipients: Recipient[] = [];

  for (const row of customerRows) {
    const customerData = row.data_json as unknown as ShopifyCustomerPayload;

    // Must have a valid email address
    const email = customerData.email?.trim();
    if (!email) {
      continue;
    }

    // Filter by email_marketing_consent if the field is present in the payload.
    // TODO: Once all Shopify syncs reliably populate email_marketing_consent,
    // change this to exclude customers where the field is absent (treat absence
    // as "not subscribed"). For now we include them to avoid silent data loss.
    if (customerData.email_marketing_consent !== undefined && customerData.email_marketing_consent !== null) {
      const consentState = customerData.email_marketing_consent.state;
      if (consentState && consentState !== "subscribed") {
        continue;
      }
    }

    const firstName = customerData.first_name ?? "";
    const lastName = customerData.last_name ?? "";
    const customerId = String(customerData.id);

    if (segment === "all_customers") {
      recipients.push({ id: customerId, email, firstName, lastName });
      continue;
    }

    if (isDormantSegment(segment)) {
      const thresholdDays = dormantThresholdDays(segment);

      // Resolve last order date: prefer order cache map, fall back to customer
      // payload field if present (some sync implementations write it there).
      let lastOrderDate: Date | null = null;

      if (orderRowsByCustomerId) {
        lastOrderDate = orderRowsByCustomerId.get(customerId) ?? null;
      }

      if (!lastOrderDate && customerData.last_order_at) {
        const parsed = new Date(customerData.last_order_at);
        if (!isNaN(parsed.getTime())) {
          lastOrderDate = parsed;
        }
      }

      // No order on record — skip for dormant segments
      if (!lastOrderDate) {
        continue;
      }

      const daysSinceLastOrder = (now.getTime() - lastOrderDate.getTime()) / (24 * 60 * 60 * 1000);

      if (daysSinceLastOrder > thresholdDays) {
        recipients.push({ id: customerId, email, firstName, lastName });
      }

      continue;
    }

    // Unknown segment — skip this customer (return empty at end)
  }

  // For an unrecognised segment, return empty so caller surfaces no_recipients
  if (segment !== "all_customers" && !isDormantSegment(segment)) {
    return [];
  }

  return recipients;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFromAddress(payload: WinbackEmailPayload): string {
  // Use payload from_email or fall back to environment default
  const email = payload.from_email || process.env.EMAIL_FROM_ADDRESS || "noreply@merchops.com";
  const name = payload.from_name || "MerchOps";
  return `${name} <${email}>`;
}

function getUnsubscribeLink(workspaceId: string): string {
  // Generate unsubscribe link
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/unsubscribe?workspace=${workspaceId}`;
}

function appendUnsubscribeLink(htmlBody: string, unsubscribeUrl: string): string {
  // Add unsubscribe link at the bottom of HTML email
  const unsubscribeHtml = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
      <p>Don't want to receive these emails? <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  `;

  // If body has closing body tag, insert before it. Otherwise, append.
  if (htmlBody.includes("</body>")) {
    return htmlBody.replace("</body>", `${unsubscribeHtml}</body>`);
  }
  return `${htmlBody}${unsubscribeHtml}`;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyError(error: unknown): ExecutionError {
  // Type guard to check if error has expected properties
  const isErrorWithCodeOrStatus = (err: unknown): err is { code?: number | string; message?: string; statusCode?: number } => {
    return typeof err === 'object' && err !== null;
  };

  if (!isErrorWithCodeOrStatus(error)) {
    return {
      code: ExecutionErrorCode.UNKNOWN_ERROR,
      message: 'An unknown error occurred',
      retryable: false,
      details: {},
    };
  }

  // Check for missing API key first (most specific)
  if (typeof error.message === 'string' && error.message.includes("RESEND_API_KEY")) {
    return {
      code: ExecutionErrorCode.INVALID_TOKEN,
      message: "Email provider API key not configured",
      retryable: false,
      details: {},
    };
  }

  // Empty segment
  if (typeof error.message === 'string' && error.message.includes("No recipients")) {
    return {
      code: ExecutionErrorCode.CUSTOMER_SEGMENT_EMPTY,
      message: "No recipients found for the specified segment",
      retryable: false,
      details: {},
    };
  }

  // Resend specific errors (based on status codes) - check this first
  if (typeof error.statusCode === 'number') {
    switch (error.statusCode) {
      case 400:
        return {
          code: ExecutionErrorCode.INVALID_PAYLOAD,
          message: "Invalid email request - check email addresses and content",
          retryable: false,
          details: { resendStatus: error.statusCode, message: error.message },
        };
      case 401:
      case 403:
        return {
          code: ExecutionErrorCode.INVALID_TOKEN,
          message: "Email provider authentication failed",
          retryable: false,
          details: { resendStatus: error.statusCode },
        };
      case 404:
        return {
          code: ExecutionErrorCode.INVALID_PAYLOAD,
          message: "Resource not found",
          retryable: false,
          details: { resendStatus: error.statusCode, message: error.message },
        };
      case 422:
        return {
          code: ExecutionErrorCode.INVALID_PAYLOAD,
          message: "Validation error - invalid email format or data",
          retryable: false,
          details: { resendStatus: error.statusCode, message: error.message },
        };
      case 429:
        return {
          code: ExecutionErrorCode.RATE_LIMIT_EXCEEDED,
          message: "Too many emails sent, rate limit exceeded",
          retryable: true,
          details: { resendStatus: error.statusCode },
        };
      case 500:
      case 503:
        return {
          code: ExecutionErrorCode.NETWORK_ERROR,
          message: "Email provider service unavailable",
          retryable: true,
          details: { resendStatus: error.statusCode },
        };
      default:
        return {
          code: ExecutionErrorCode.EMAIL_PROVIDER_ERROR,
          message: error.message || "Resend API error",
          retryable: false,
          details: { resendStatus: error.statusCode, message: error.message },
        };
    }
  }

  // Network errors (check for string code)
  if (typeof error.code === 'string' && (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT")) {
    return {
      code: ExecutionErrorCode.NETWORK_ERROR,
      message: "Failed to connect to email provider",
      retryable: true,
      details: { originalError: error.message },
    };
  }

  // Default
  return {
    code: ExecutionErrorCode.EMAIL_PROVIDER_ERROR,
    message: typeof error.message === 'string' ? error.message : "Unknown email provider error",
    retryable: false,
    details: { originalError: error },
  };
}
