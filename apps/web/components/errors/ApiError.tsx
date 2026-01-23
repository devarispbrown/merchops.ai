'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface ApiErrorProps {
  error: {
    message: string;
    code?: string;
    statusCode?: number;
    retryable?: boolean;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ApiError({ error, onRetry, onDismiss }: ApiErrorProps) {
  // Get user-friendly message based on error code
  const getUserMessage = () => {
    if (error.code === 'UNAUTHORIZED') {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.code === 'FORBIDDEN') {
      return 'You do not have permission to perform this action.';
    }
    if (error.code === 'NOT_FOUND') {
      return 'The requested resource could not be found.';
    }
    if (error.code === 'RATE_LIMIT') {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return 'Unable to connect. Please check your internet connection.';
    }
    if (error.statusCode && error.statusCode >= 500) {
      return 'Our service is experiencing issues. We are working to resolve this.';
    }
    return error.message || 'An unexpected error occurred.';
  };

  // Get actionable guidance
  const getGuidance = () => {
    if (error.code === 'UNAUTHORIZED') {
      return 'Sign in to continue using MerchOps.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return 'Verify your connection and try again.';
    }
    if (error.retryable !== false) {
      return 'This is usually temporary. Try again in a moment.';
    }
    return 'If this persists, contact support.';
  };

  const showRetry = error.retryable !== false && onRetry;

  return (
    <Card className="border-error/20 bg-error/5">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-error rounded" />
            <h3 className="text-sm font-medium text-foreground">
              {getUserMessage()}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground pl-3">
            {getGuidance()}
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && error.code && (
          <div className="text-xs text-muted-foreground pl-3">
            Error code: {error.code}
            {error.statusCode && ` (${error.statusCode})`}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {showRetry && (
            <Button onClick={onRetry} variant="primary" size="sm">
              Try again
            </Button>
          )}
          {onDismiss && (
            <Button onClick={onDismiss} variant="ghost" size="sm">
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Inline error for form fields
export interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-error">
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}
