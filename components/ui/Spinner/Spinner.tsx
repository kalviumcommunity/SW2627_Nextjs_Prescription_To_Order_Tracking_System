import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  label?: string;
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', fullScreen = false, label, className, ...props }, ref) => {
    const spinnerElement = (
      <div
        ref={ref}
        className={`${styles.wrapper} ${className || ''}`}
        role="status"
        aria-label={label || 'Loading...'}
        {...props}
      >
        <span className={`${styles.spinner} ${styles[size]}`} />
      </div>
    );

    if (fullScreen) {
      return (
        <div className={styles.overlay}>
          {spinnerElement}
          {label && <span className={styles.label}>{label}</span>}
        </div>
      );
    }

    return spinnerElement;
  }
);

Spinner.displayName = 'Spinner';
