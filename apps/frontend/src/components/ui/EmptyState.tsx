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
  /** Element for the title; use a heading when the empty state is the page's main content. */
  titleAs?: 'p' | 'h1' | 'h2' | 'h3';
}

export function EmptyState({ icon, title, description, action, className, titleAs: Title = 'p' }: EmptyStateProps) {
  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <Title className={styles.title}>{title}</Title>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

EmptyState.displayName = 'EmptyState';
