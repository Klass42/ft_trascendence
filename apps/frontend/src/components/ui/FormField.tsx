/**
 * FormField Component
 *
 * Generic label + error + hint wrapper for ANY control (custom inputs, radio
 * groups, the native controls that don't ship their own label). Uses a
 * render-prop so the field id + aria wiring land on your control.
 *
 * Usage:
 *   <FormField label="Color" error={err}>
 *     {(field) => <input {...field} value={v} onChange={...} />}
 *   </FormField>
 */
import { type ReactNode, useId } from 'react';
import styles from './FormField.module.css';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export interface FormFieldProps {
  /** Label text shown above the control */
  label?: string;
  /** Error message shown below (takes precedence over hint) */
  error?: string;
  /** Hint text shown below when there is no error */
  hint?: string;
  /** Mark the field as required (adds a visual asterisk) */
  required?: boolean;
  className?: string;
  /** Renders the control; spread the passed props onto it for a11y wiring. */
  children: (field: FieldControlProps) => ReactNode;
}

export function FormField({
  label,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = !!error;
  const showHint = !!hint && !hasError;

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {children({
        id,
        'aria-invalid': hasError || undefined,
        'aria-describedby': hasError ? errorId : showHint ? hintId : undefined,
      })}
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

FormField.displayName = 'FormField';
