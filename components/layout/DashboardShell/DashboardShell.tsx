import React from 'react';
import styles from './DashboardShell.module.css';

export interface DashboardShellProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  sidebar,
  header,
  children,
}) => {
  return (
    <div className={styles.layout}>
      {sidebar}
      <div className={styles.mainWrapper}>
        {header}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
};
