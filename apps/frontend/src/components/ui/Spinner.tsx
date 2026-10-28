/**
 * Spinner Component
 * 
 * A loading indicator for async operations.
 * 
 * Usage:
 *   <Spinner />              // Default medium size
 *   <Spinner size="sm" />    // Small (for buttons)
 *   <Spinner size="lg" />    // Large (for page loading)
 */

import { forwardRef, type HTMLAttributes } from 'react';
import styles from './Spinner.module.css';

// =============================================================================
// Types
// =============================================================================

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label for screen readers */
  label?: string;
}

// =============================================================================
// Component
// =============================================================================

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', label = 'Cargando…', className, ...props }, ref) => {
    const classNames = [styles.spinner, styles[size], className]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={ref}
        className={classNames}
        role="status"
        aria-label={label}
        {...props}
      >
        <svg
          className={styles.svg}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className={styles.track}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className={styles.arc}
            d="M12 2C6.47715 2 2 6.47715 2 12"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.srOnly}>{label}</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';
