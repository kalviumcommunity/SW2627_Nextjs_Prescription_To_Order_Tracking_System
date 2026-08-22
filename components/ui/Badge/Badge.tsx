import React from 'react';
import styles from './Badge.module.css';

type PrescriptionStatus = 'pending' | 'filled' | 'cannotFill' | 'processing';
type GenericVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PrescriptionStatus | GenericVariant;
  size?: 'sm' | 'md';
  showDot?: boolean;
  pulsing?: boolean;
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { variant = 'neutral', size = 'md', showDot = false, pulsing = false, className, children, ...props },
    ref
  ) => {
    // Note: Map 'error' to 'errorBadge' in CSS to avoid conflicts
    const styleVariant = variant === 'error' ? 'errorBadge' : variant;

    const classNames = [
      styles.badge,
      styles[styleVariant],
      styles[size],
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={classNames} {...props}>
        {showDot && (
          <span className={`${styles.dot} ${pulsing ? styles.pulsingDot : ''}`} />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
