import React from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export function ErrorState({ message, onRetry, title = 'Something went wrong', className = '' }: ErrorStateProps) {
  return (
    <div className={`space-y-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center ${className}`} role="alert">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600" aria-hidden="true">
        <span className="text-lg font-bold">!</span>
      </div>
      <h2 className="text-lg font-semibold text-red-900">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-red-700">{message}</p>
      {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
