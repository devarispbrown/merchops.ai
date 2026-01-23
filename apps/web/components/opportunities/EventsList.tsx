import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EventType, EventPayload } from '@/server/events/types';

interface Event {
  id: string;
  type: EventType;
  occurred_at: Date | string;
  payload_json?: Record<string, unknown> | EventPayload;
  payload?: Record<string, unknown> | EventPayload;
}

interface EventsListProps {
  events: Event[];
}

export function EventsList({ events }: EventsListProps) {
  if (events.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground text-center py-4">
          No triggering events found
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Triggering Events
        </h3>
        <div className="space-y-3">
          {events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </div>
      </div>
    </Card>
  );
}

interface EventItemProps {
  event: Event;
}

function EventItem({ event }: EventItemProps) {
  const eventTypeLabel = getEventTypeLabel(event.type);
  const eventTypeBadgeVariant = getEventTypeBadgeVariant(event.type);
  const timeAgo = formatTimeAgo(new Date(event.occurred_at));

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 transition-calm hover:bg-muted/50">
      <EventTypeIcon type={event.type} />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={eventTypeBadgeVariant}>{eventTypeLabel}</Badge>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <EventDescription event={event} />
      </div>
    </div>
  );
}

function EventTypeIcon({ type }: { type: EventType }) {
  const iconClasses = 'w-5 h-5';

  switch (type) {
    case 'inventory_threshold_crossed':
    case 'product_out_of_stock':
      return (
        <svg
          className={`${iconClasses} text-error`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      );
    case 'product_back_in_stock':
      return (
        <svg
          className={`${iconClasses} text-success`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    case 'velocity_spike':
      return (
        <svg
          className={`${iconClasses} text-warning`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      );
    case 'customer_inactivity_threshold':
      return (
        <svg
          className={`${iconClasses} text-muted-foreground`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={`${iconClasses} text-muted-foreground`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

function EventDescription({ event }: { event: Event }) {
  const payload = (event.payload_json || event.payload || {}) as Record<string, unknown>;

  // Helper to safely render unknown values as strings
  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  switch (event.type) {
    case 'inventory_threshold_crossed':
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{renderValue(payload.product_title)}</span> inventory
          dropped to {renderValue(payload.current_inventory)} units (threshold:{' '}
          {renderValue(payload.threshold)})
        </p>
      );
    case 'product_out_of_stock':
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{renderValue(payload.product_title)}</span> is now
          out of stock
        </p>
      );
    case 'product_back_in_stock':
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{renderValue(payload.product_title)}</span> restocked
          with {renderValue(payload.new_inventory)} units
        </p>
      );
    case 'velocity_spike':
      return (
        <p className="text-sm text-foreground">
          <span className="font-medium">{renderValue(payload.product_title)}</span> selling at{' '}
          {renderValue(payload.spike_multiplier)}x normal rate ({renderValue(payload.current_units_per_day)}{' '}
          units/day)
        </p>
      );
    case 'customer_inactivity_threshold':
      return (
        <p className="text-sm text-foreground">
          Customer {renderValue(payload.customer_email)} inactive for {renderValue(payload.days_inactive)}{' '}
          days (LTV: ${renderValue(payload.total_lifetime_value)})
        </p>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Event details not available
        </p>
      );
  }
}

function getEventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    inventory_threshold_crossed: 'Low Inventory',
    product_out_of_stock: 'Out of Stock',
    product_back_in_stock: 'Back in Stock',
    velocity_spike: 'Sales Spike',
    customer_inactivity_threshold: 'Customer Inactive',
    order_created: 'Order Created',
    order_paid: 'Order Paid',
    product_created: 'Product Created',
    product_updated: 'Product Updated',
  };
  return labels[type] || type;
}

function getEventTypeBadgeVariant(
  type: EventType
): 'error' | 'success' | 'warning' | 'secondary' {
  const variants: Record<EventType, 'error' | 'success' | 'warning' | 'secondary'> = {
    inventory_threshold_crossed: 'warning',
    product_out_of_stock: 'error',
    product_back_in_stock: 'success',
    velocity_spike: 'warning',
    customer_inactivity_threshold: 'secondary',
    order_created: 'success',
    order_paid: 'success',
    product_created: 'secondary',
    product_updated: 'secondary',
  };
  return variants[type] || 'secondary';
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
}
