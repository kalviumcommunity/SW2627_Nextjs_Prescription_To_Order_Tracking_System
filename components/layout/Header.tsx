import React from 'react';
import { Button } from '../ui/Button';

export interface HeaderProps {
  title?: string;
  userName?: string;
  onLogout?: () => void;
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  title = 'MedEasy', 
  userName,
  onLogout,
  onMenuToggle
}) => {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 sticky top-0">
      <div className="flex items-center">
        {onMenuToggle && (
          <button 
            onClick={onMenuToggle}
            className="mr-4 lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
          >
            <span className="sr-only">Open sidebar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <h1 className="text-xl font-bold text-blue-700 tracking-tight">{title}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {userName}
          </span>
        )}
        {onLogout && (
          <Button variant="secondary" size="sm" onClick={onLogout}>
            Log out
          </Button>
        )}
      </div>
    </header>
  );
};
