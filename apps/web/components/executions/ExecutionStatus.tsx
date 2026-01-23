import React from 'react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ExecutionStatus as ExecutionStatusEnum } from '@/server/actions/types';

interface Execution {
  id: string;
  status: ExecutionStatusEnum;
  error_code?: string | null;
  error_message?: string | null;
  provider_response_json?: unknown;
  started_at: Date;
  finished_at?: Date | null;
}

interface ExecutionStatusProps {
  execution: Execution;
}

export function ExecutionStatus({ execution }: ExecutionStatusProps) {
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Execution Status
          </h3>
          <StatusBadge status={execution.status} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Started:</span>
            <span className="text-foreground font-medium">
              {new Date(execution.started_at).toLocaleString()}
            </span>
          </div>

          {execution.finished_at && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Finished:</span>
              <span className="text-foreground font-medium">
                {new Date(execution.finished_at).toLocaleString()}
              </span>
            </div>
          )}

          {execution.error_message && (
            <ErrorDisplay
              errorCode={execution.error_code}
              errorMessage={execution.error_message}
            />
          )}

          {execution.provider_response_json && (
            <ProviderResponsePreview
              response={execution.provider_response_json}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

interface StatusBadgeProps {
  status: ExecutionStatusEnum;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<
    ExecutionStatusEnum,
    { variant: 'success' | 'error' | 'warning' | 'secondary'; label: string }
  > = {
    [ExecutionStatusEnum.PENDING]: {
      variant: 'warning',
      label: 'Pending',
    },
    [ExecutionStatusEnum.RUNNING]: {
      variant: 'warning',
      label: 'Running',
    },
    [ExecutionStatusEnum.SUCCEEDED]: {
      variant: 'success',
      label: 'Succeeded',
    },
    [ExecutionStatusEnum.FAILED]: {
      variant: 'error',
      label: 'Failed',
    },
    [ExecutionStatusEnum.RETRYING]: {
      variant: 'warning',
      label: 'Retrying',
    },
  };

  const config = statusConfig[status] || {
    variant: 'secondary' as const,
    label: status,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

interface ErrorDisplayProps {
  errorCode?: string | null;
  errorMessage: string;
}

function ErrorDisplay({ errorCode, errorMessage }: ErrorDisplayProps) {
  return (
    <div className="p-4 rounded-lg bg-error-light border border-error/20 space-y-2">
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-error flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium text-error">Execution Failed</p>
          {errorCode && (
            <p className="text-xs font-mono text-muted-foreground">
              Code: {errorCode}
            </p>
          )}
          <p className="text-sm text-foreground">{errorMessage}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-error/20">
        <p className="text-xs text-muted-foreground">
          {getErrorGuidance(errorCode)}
        </p>
      </div>
    </div>
  );
}

interface ProviderResponsePreviewProps {
  response: unknown;
}

function ProviderResponsePreview({ response }: ProviderResponsePreviewProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-calm"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        Provider Response
      </button>

      {isExpanded && (
        <div className="p-3 rounded-lg bg-muted border border-border">
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function getErrorGuidance(errorCode?: string | null): string {
  const guidance: Record<string, string> = {
    NETWORK_ERROR: 'Check your internet connection and try again.',
    TIMEOUT: 'The request took too long. This may be a temporary issue.',
    INVALID_TOKEN: 'Your Shopify connection needs to be re-authorized.',
    TOKEN_EXPIRED: 'Your Shopify connection has expired. Please reconnect.',
    INSUFFICIENT_PERMISSIONS:
      'MerchOps needs additional permissions. Please reconnect your store.',
    INVALID_PAYLOAD: 'The action payload is invalid. Please review and edit.',
    PRODUCT_NOT_FOUND: 'The product no longer exists in your store.',
    DISCOUNT_ALREADY_EXISTS:
      'A discount with this code already exists. Use a different code.',
    CUSTOMER_SEGMENT_EMPTY: 'No customers match this segment.',
    RATE_LIMIT_EXCEEDED:
      'Shopify rate limit reached. Will retry automatically.',
    SHOPIFY_API_ERROR: 'An error occurred with Shopify. Check the details above.',
    EMAIL_PROVIDER_ERROR:
      'Email provider error. Check your email provider settings.',
  };

  return (
    guidance[errorCode || ''] ||
    'An unexpected error occurred. Contact support if this persists.'
  );
}
