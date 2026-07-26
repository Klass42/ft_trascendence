import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      className={[styles.track, checked && styles.on, disabled && styles.disabled]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} aria-hidden="true" />
    </button>
  );
}

Toggle.displayName = 'Toggle';
