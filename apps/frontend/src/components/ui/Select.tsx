/**
 * Select Component
 *
 * Native <select> styled to match the design system (robust + accessible).
 * Pass `options` or nest <option> children.
 *
 * Usage:
 *   <Select label="Rol" options={[{value:'STUDENT',label:'Alumno'}]} />
 *   <Select label="Curso" placeholder="Elige…" value={id} onChange={...}>
 *     <option value="a">A</option>
 *   </Select>
 */
import { forwardRef, type SelectHTMLAttributes, type ReactNode, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  /** Options to render (alternative to nesting <option> children) */
  options?: SelectOption[];
  /** Placeholder shown as a disabled first option */
  placeholder?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      fullWidth = true,
      options,
      placeholder,
      children,
      disabled,
      className,
      id: providedId,
      value,
      defaultValue,
      ...props
    },
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
        <div
          className={[styles.selectWrapper, hasError && styles.hasError, disabled && styles.disabled]
            .filter(Boolean)
            .join(' ')}
        >
          <select
            ref={ref}
            id={id}
            className={styles.select}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : showHint ? hintId : undefined}
            value={value}
            defaultValue={defaultValue ?? (placeholder && value === undefined ? '' : undefined)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className={styles.icon} aria-hidden="true" size={18} />
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

Select.displayName = 'Select';
