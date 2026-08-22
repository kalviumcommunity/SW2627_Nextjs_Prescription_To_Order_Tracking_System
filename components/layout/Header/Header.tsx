import React from 'react';
import styles from './Header.module.css';

export interface HeaderProps {
  title?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, leftElement, rightElement }) => {
  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        {leftElement}
        {title && <h1 className={styles.title}>{title}</h1>}
      </div>
      <div className={styles.rightSection}>
        {rightElement}
      </div>
    </header>
  );
};
