/**
 * Input Component
 * 
 * A text input with label, error messages, and icon support.
 * 
 * Usage:
 *   <Input label="Email" type="email" />
 *   <Input label="Search" leftIcon={<SearchIcon />} />
 *   <Input error="This field is required" />
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react';
import styles from './Input.module.css';

// =============================================================================
// Types
// =============================================================================

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Hint text displayed below the input (hidden when error is shown) */
  hint?: string;
  /** Icon displayed on the left side of the input */
  leftIcon?: ReactNode;
  /** Icon displayed on the right side of the input */
  rightIcon?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Make input take full width of container */
  fullWidth?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      size = 'md',
      fullWidth = true,
      disabled,
      className,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const hasError = !!error;
    const showHint = hint && !hasError;

    const wrapperClassNames = [
      styles.wrapper,
      fullWidth && styles.fullWidth,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inputWrapperClassNames = [
      styles.inputWrapper,
      styles[size],
      hasError && styles.hasError,
      disabled && styles.disabled,
      leftIcon && styles.hasLeftIcon,
      rightIcon && styles.hasRightIcon,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClassNames}>
        {label && (
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
        )}

        <div className={inputWrapperClassNames}>
          {leftIcon && (
            <span className={styles.leftIcon} aria-hidden="true">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            className={styles.input}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? errorId : showHint ? hintId : undefined
            }
            {...props}
          />

          {rightIcon && (
            <span className={styles.rightIcon} aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>

        {hasError && (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}

        {showHint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
