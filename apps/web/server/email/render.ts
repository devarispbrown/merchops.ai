/**
 * Email Template Renderer
 *
 * Selects template by execution type and renders to HTML + plain text.
 */

import { render } from '@react-email/render';
import { createElement } from 'react';

import { logger } from '@/server/observability/logger';

import { DiscountEmail } from './templates/DiscountEmail';
import { WinbackEmail } from './templates/WinbackEmail';

export interface EmailRenderProps {
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  ctaUrl: string;
  storeName: string;
  unsubscribeUrl: string;
  products?: Array<{ name: string; price: string; url?: string }>;
  discountCode?: string;
  expiryDate?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/**
 * Renders an email template to HTML and plain text strings.
 * Falls back to minimal safe HTML on any rendering error.
 *
 * @param type - Execution type to select template
 * @param props - Template props
 * @returns Object with html and text strings
 */
export async function renderEmail(
  type: string,
  props: EmailRenderProps
): Promise<RenderedEmail> {
  try {
    const { html, text } = await renderTemplate(type, props);
    return { html, text };
  } catch (error) {
    logger.error(
      {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Email template rendering failed, using fallback'
    );

    // Fallback to minimal safe HTML
    return renderFallback(props);
  }
}

async function renderTemplate(
  type: string,
  props: EmailRenderProps
): Promise<RenderedEmail> {
  let element: React.ReactElement;

  switch (type) {
    case 'winback_email_draft':
    case 'shopify_email_draft':
      element = createElement(WinbackEmail, props);
      break;

    case 'discount_draft':
      element = createElement(DiscountEmail, props);
      break;

    default:
      // Default to winback template for unknown types
      element = createElement(WinbackEmail, props);
      break;
  }

  const html = await render(element);
  const text = await render(element, { plainText: true });

  return { html, text };
}

function renderFallback(props: EmailRenderProps): RenderedEmail {
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${props.body.replace(/\n/g, '</p><p>')}</p>
        <a href="${props.ctaUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          ${props.cta}
        </a>
        <p style="color: #6B7280; font-size: 14px;">
          — ${props.storeName}<br/>
          If you'd prefer not to receive these emails, you can <a href="${props.unsubscribeUrl}">unsubscribe</a>.
        </p>
      </body>
    </html>
  `.trim();

  const text = `${props.body}\n\n${props.cta}: ${props.ctaUrl}\n\nTo unsubscribe: ${props.unsubscribeUrl}`;

  return { html, text };
}
