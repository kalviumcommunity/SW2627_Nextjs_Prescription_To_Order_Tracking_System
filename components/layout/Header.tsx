'use client';

import React from 'react';
import { Button } from '../ui/Button';

export interface HeaderProps {
  title?: string;
  userName?: string;
  onLogout?: () => void;
  onMenuToggle?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'MedEasy',
  userName,
  onLogout,
  onMenuToggle,
  isCollapsed,
  onToggleCollapse,
}) => {
  // Derive user initials for avatar
  const initials = userName
    ? userName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-20 sticky top-0 shadow-xs">
      <div className="flex items-center">
        {/* Mobile menu trigger button */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="mr-3 lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none transition-colors"
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Desktop sidebar collapse / expand toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none transition-colors mr-3"
            title={isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
            aria-label="Toggle sidebar"
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h10M4 18h16"
              />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 bg-clip-text text-transparent tracking-tight">
            {title}
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 tracking-wide uppercase">
            Clinical System
          </span>
        </div>
      </div>

      {/* Right User Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {userName && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-gray-900 leading-tight">
                {userName}
              </span>
              <span className="text-[10px] text-gray-500 font-medium leading-tight">
                Authenticated Session
              </span>
            </div>
          </div>
        )}

        {onLogout && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 hover:border-gray-300 shadow-xs"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="hidden sm:inline">Log out</span>
          </Button>
        )}
      </div>
    </header>
  );
};
