import React, { useState } from 'react';
import { Header, HeaderProps } from './Header';
import { Sidebar, SidebarProps } from './Sidebar';

export interface DashboardShellProps {
  children: React.ReactNode;
  sidebarItems: SidebarProps['items'];
  headerProps?: Omit<HeaderProps, 'onMenuToggle'>;
  activePath?: string;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  sidebarItems,
  headerProps,
  activePath
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Sidebar 
        items={sidebarItems} 
        activePath={activePath} 
        isOpen={sidebarOpen} 
      />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header 
          onMenuToggle={toggleSidebar} 
          {...headerProps} 
        />
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
