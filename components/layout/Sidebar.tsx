import React from 'react';

export interface SidebarItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  activePath?: string;
  isOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  items, 
  activePath = '',
  isOpen = false 
}) => {
  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-gray-600 bg-opacity-75 lg:hidden transition-opacity" />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 h-0 overflow-y-auto pt-5 pb-4">
          <nav className="mt-5 px-3 space-y-1">
            {items.map((item) => {
              const isActive = activePath === item.href || (activePath.startsWith(item.href) && item.href !== '/');
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.icon && (
                    <span className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`}>
                      {item.icon}
                    </span>
                  )}
                  {item.name}
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};
