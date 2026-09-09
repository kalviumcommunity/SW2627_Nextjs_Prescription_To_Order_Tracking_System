import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-[12rem] flex-col items-center justify-center gap-3 p-6 text-center ${className}`}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400" aria-hidden="true">
          {icon}
        </div>
      ) : (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="max-w-md text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
