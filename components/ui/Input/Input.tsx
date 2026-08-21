import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, required, className, id, ...props },
    ref
  ) => {
    const inputId = id || React.useId();
    
    const inputClassNames = [
      styles.input,
      error ? styles.error : '',
      className || '',
    ].filter(Boolean).join(' ');

    return (
      <div className={styles.wrapper}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        <div className={styles.inputContainer}>
          <input
            id={inputId}
            ref={ref}
            className={inputClassNames}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
        </div>
        {error && (
          <span id={`${inputId}-error`} className={styles.errorMessage}>
            {error}
          </span>
        )}
        {helperText && !error && (
          <span id={`${inputId}-helper`} className={styles.helperText}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
