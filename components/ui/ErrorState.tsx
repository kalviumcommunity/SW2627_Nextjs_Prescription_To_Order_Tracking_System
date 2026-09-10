import React from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string | { code?: string; message?: string };
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
  action,
  className = '',
}: ErrorStateProps) {
  const displayMessage =
    typeof message === 'string'
      ? message
      : message?.code === 'UNAUTHENTICATED'
        ? 'Your session has expired. Please sign in again.'
        : message?.code === 'FORBIDDEN'
          ? 'You do not have permission to perform this action.'
          : message?.message || 'We could not complete that request. Please try again.';

  return (
    <div
      className={`space-y-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm ${className}`}
      role="alert"
    >
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner"
        aria-hidden="true"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-red-900">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-red-700">{displayMessage}</p>
      {onRetry && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
