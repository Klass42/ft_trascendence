/**
 * Badge Component
 *
 * Small status pill. Use for statuses, counts, roles.
 *
 * Usage:
 *   <Badge variant="success">Publicado</Badge>
 *   <Badge variant="warning" dot>Pendiente</Badge>
 */
import { type HTMLAttributes, type ReactNode } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';
  /** Show a leading status dot */
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ variant = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[variant], className].filter(Boolean).join(' ')}
      {...props}
    >
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

Badge.displayName = 'Badge';
