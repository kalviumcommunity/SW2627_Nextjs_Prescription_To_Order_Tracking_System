import React from 'react';
import { Spinner } from './Spinner';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex min-h-[12rem] flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <Spinner size="lg" />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}
