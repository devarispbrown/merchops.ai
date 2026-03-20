/**
 * Billing History Route
 *
 * GET /api/billing/history
 * Returns billing events filtered to invoice-related events
 */

import { NextRequest, NextResponse } from 'next/server';

import { getWorkspaceId } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

export async function GET(_request: NextRequest) {
  const workspaceId = await getWorkspaceId();

  // Get subscription for workspace
  const subscription = await prisma.subscription.findUnique({
    where: { workspace_id: workspaceId },
  });

  if (!subscription) {
    return NextResponse.json({ events: [] });
  }

  // Query billing events filtered to invoice-related types
  const billingEvents = await prisma.billingEvent.findMany({
    where: {
      subscription_id: subscription.id,
      event_type: {
        in: [
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'invoice.created',
          'invoice.finalized',
        ],
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 50,
  });

  // Format events for the frontend
  const events = billingEvents.map((event) => {
    const payload = event.payload as Record<string, any>;
    const invoice = payload || {};

    return {
      id: event.id,
      date: event.created_at.toISOString(),
      description: formatEventDescription(event.event_type),
      amount: invoice.amount_paid || invoice.amount_due || 0,
      status: mapEventStatus(event.event_type),
      invoice_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
    };
  });

  return NextResponse.json({ events });
}

function formatEventDescription(eventType: string): string {
  switch (eventType) {
    case 'invoice.payment_succeeded':
      return 'Payment successful';
    case 'invoice.payment_failed':
      return 'Payment failed';
    case 'invoice.created':
      return 'Invoice created';
    case 'invoice.finalized':
      return 'Invoice finalized';
    default:
      return eventType;
  }
}

function mapEventStatus(eventType: string): 'paid' | 'pending' | 'failed' {
  switch (eventType) {
    case 'invoice.payment_succeeded':
      return 'paid';
    case 'invoice.payment_failed':
      return 'failed';
    default:
      return 'pending';
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
