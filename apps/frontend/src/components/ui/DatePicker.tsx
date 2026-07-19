/**
 * DatePicker Component
 *
 * Thin wrapper over the native date/time input (robust + accessible). Use
 * `mode` to switch between date, datetime and time. Value is the native string
 * (e.g. "2026-07-19T23:59" for datetime-local).
 *
 * Usage:
 *   <DatePicker label="Fecha límite" mode="datetime" value={v} onChange={...} />
 */
import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import styles from './DatePicker.module.css';

const TYPE_BY_MODE = {
  date: 'date',
  datetime: 'datetime-local',
  time: 'time',
} as const;

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  /** Which native picker to use */
  mode?: keyof typeof TYPE_BY_MODE;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    { label, error, hint, fullWidth = true, mode = 'date', disabled, className, id: providedId, ...props },
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
        <input
          ref={ref}
          id={id}
          type={TYPE_BY_MODE[mode]}
          className={[styles.input, hasError && styles.hasError, disabled && styles.disabled]
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

DatePicker.displayName = 'DatePicker';
