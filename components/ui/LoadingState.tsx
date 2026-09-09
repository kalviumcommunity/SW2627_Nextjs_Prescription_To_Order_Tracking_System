import React from 'react';
import { Spinner } from './Spinner';

export interface LoadingStateProps {
  label?: string;
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  label,
  message,
  className = '',
  size = 'lg',
}: LoadingStateProps) {
  const text = message || label || 'Loading...';
  return (
    <div
      className={`flex min-h-[12rem] flex-col items-center justify-center gap-3 p-6 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner size={size} />
      <span className="text-sm font-medium text-gray-600">{text}</span>
    </div>
  );
}
