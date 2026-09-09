'use client';

import React, { useEffect } from 'react';

export type ModalMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

export interface ModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: ModalMaxWidth;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeDisabled?: boolean;
}

const MAX_WIDTH_MAP: Record<ModalMaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  isOpen,
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  size = 'md',
  closeDisabled = false,
}: ModalProps) {
  const showModal = isOpen ?? open ?? false;

  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  if (!showModal) return null;

  const maxWidthClass = maxWidth
    ? MAX_WIDTH_MAP[maxWidth] || 'max-w-md'
    : SIZE_MAP[size] || 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        className={`bg-white rounded-2xl shadow-2xl ${maxWidthClass} w-full border border-gray-200 transition-all transform duration-200 overflow-hidden max-h-[90vh] flex flex-col`}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            disabled={closeDisabled}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              &times;
            </span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
