import React from 'react';
import Link from 'next/link';
import styles from './Sidebar.module.css';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  isActive?: boolean;
}

export interface SidebarProps {
  brandName?: string;
  navItems: NavItem[];
  footerElement?: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  brandName = 'MedEasy', 
  navItems, 
  footerElement 
}) => {
  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        <div className={styles.brandIcon}>+</div>
        <span>{brandName}</span>
      </Link>
      
      <nav className={styles.nav}>
        {navItems.map((item, index) => (
          <Link 
            key={index} 
            href={item.href}
            className={`${styles.navItem} ${item.isActive ? styles.active : ''}`}
          >
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {footerElement && (
        <div className={styles.footer}>
          {footerElement}
        </div>
      )}
    </aside>
  );
};
