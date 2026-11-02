import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './UserLink.module.css';

export interface UserLinkProps {
  userId: string;
  children: ReactNode;
  className?: string;
}

/** Link to another member's public profile (`/users/:id`). */
export function UserLink({ userId, children, className }: UserLinkProps) {
  return (
    <Link to={`/users/${encodeURIComponent(userId)}`} className={[styles.link, className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  );
}
