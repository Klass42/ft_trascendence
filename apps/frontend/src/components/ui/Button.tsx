/**
 * Button Component
 * 
 * A versatile button component with multiple variants and sizes.
 * 
 * Usage:
 *   <Button>Default</Button>
 *   <Button variant="primary">Primary</Button>
 *   <Button variant="outline" size="sm">Small Outline</Button>
 *   <Button loading>Loading...</Button>
 *   <Button leftIcon={<PlusIcon />}>Add Item</Button>
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

// =============================================================================
// Types
// =============================================================================

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Show loading spinner and disable interactions */
  loading?: boolean;
  /** Icon to show before the label */
  leftIcon?: ReactNode;
  /** Icon to show after the label */
  rightIcon?: ReactNode;
  /** Make button take full width of container */
  fullWidth?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const classNames = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      loading && styles.loading,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Loader2 className={styles.spinner} aria-hidden="true" />
        ) : leftIcon ? (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}

        {children && <span className={styles.label}>{children}</span>}

        {!loading && rightIcon && (
          <span className={styles.rightIcon} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
