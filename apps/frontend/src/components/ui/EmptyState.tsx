/**
 * EmptyState Component
 *
 * Standard "nothing here yet" block. Use it instead of a bare "No hay datos".
 *
 * Usage:
 *   <EmptyState icon={<Inbox />} title="Sin tareas" description="Crea la primera."
 *     action={<Button>Nueva tarea</Button>} />
 */
import { type ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

EmptyState.displayName = 'EmptyState';
