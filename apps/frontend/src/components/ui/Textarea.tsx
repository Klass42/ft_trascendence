/**
 * Textarea Component
 *
 * Multi-line text input with label, error and hint — mirrors <Input>.
 *
 * Usage:
 *   <Textarea label="Descripción" rows={4} />
 *   <Textarea label="Bio" error="Demasiado largo" />
 */
import { forwardRef, type TextareaHTMLAttributes, useId } from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, hint, fullWidth = true, disabled, className, id: providedId, rows = 4, ...props },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const hasError = !!error;
    const showHint = !!hint && !hasError;

    return (
      <div
        className={[styles.wrapper, fullWidth && styles.fullWidth, className]
          .filter(Boolean)
          .join(' ')}
      >
        {label && (
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={[styles.textarea, hasError && styles.hasError, disabled && styles.disabled]
            .filter(Boolean)
            .join(' ')}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : showHint ? hintId : undefined}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
