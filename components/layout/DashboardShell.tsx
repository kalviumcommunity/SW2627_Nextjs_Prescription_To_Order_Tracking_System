'use client';

import React, { useState, useEffect } from 'react';
import { Header, HeaderProps } from './Header';
import { Sidebar, SidebarProps } from './Sidebar';

export interface DashboardShellProps {
  children: React.ReactNode;
  sidebarItems: SidebarProps['items'];
  headerProps?: Omit<HeaderProps, 'onMenuToggle' | 'isCollapsed' | 'onToggleCollapse'>;
  activePath?: string;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  sidebarItems,
  headerProps,
  activePath,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Safely restore collapse state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('medeasy_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // Ignored for SSR / private browsing
    }
  }, []);

  const toggleSidebarMobile = () => setSidebarOpen((prev) => !prev);
  const closeSidebarMobile = () => setSidebarOpen(false);

  const toggleCollapseDesktop = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('medeasy_sidebar_collapsed', String(next));
      } catch {
        // Ignored
      }
      return next;
    });
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50/75">
      <Sidebar
        items={sidebarItems}
        activePath={activePath}
        isOpen={sidebarOpen}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapseDesktop}
        onClose={closeSidebarMobile}
      />
      <div className="flex flex-col w-0 flex-1 overflow-hidden transition-all duration-300">
        <Header
          onMenuToggle={toggleSidebarMobile}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapseDesktop}
          {...headerProps}
        />
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
