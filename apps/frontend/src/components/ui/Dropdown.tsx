/**
 * Dropdown (menu) Component
 *
 * A trigger that opens a small menu of actions. Closes on outside click / Esc.
 *
 * `trigger` is CONTENT (icon/text) — Dropdown renders the <button> itself, so
 * do NOT pass a <Button> (that nests buttons).
 *
 * Usage:
 *   <Dropdown trigger={<MoreVertical size={18} />} items={[
 *     { label: 'Editar', icon: <Pencil/>, onClick: edit },
 *     { label: 'Eliminar', icon: <Trash/>, danger: true, onClick: del },
 *   ]} />
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Dropdown.module.css';

export interface DropdownItem {
  label: ReactNode;
  onClick?: () => void;
  /** In-app route: renders a real link (menuitem) instead of a button. */
  to?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  /** Accessible name for the trigger button (required when `trigger` is an icon) */
  triggerLabel?: string;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, triggerLabel, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div className={[styles.menu, styles[align]].join(' ')} role="menu">
          {items.map((item, i) => {
            const className = [styles.item, item.danger && styles.danger].filter(Boolean).join(' ');
            const content = (
              <>
                {item.icon && (
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </>
            );
            if (item.to && !item.disabled) {
              return (
                <Link
                  key={i}
                  to={item.to}
                  role="menuitem"
                  className={className}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={className}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

Dropdown.displayName = 'Dropdown';
