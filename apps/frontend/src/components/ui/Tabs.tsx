/**
 * Tabs Component
 *
 * Accessible tabs (tablist / tab / tabpanel). Controlled (pass `value`+`onChange`)
 * or uncontrolled (pass `defaultTab`).
 *
 * Usage:
 *   <Tabs tabs={[
 *     { id: 'content', label: 'Contenido', content: <Content/> },
 *     { id: 'students', label: 'Alumnos', content: <Roster/> },
 *   ]} />
 */
import { useId, useState, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, defaultTab, value, onChange, className }: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultTab ?? tabs[0]?.id);
  const active = value ?? internal;

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <div className={styles.tablist} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`${baseId}-panel-${tab.id}`}
            className={[styles.tab, tab.id === active && styles.active].filter(Boolean).join(' ')}
            disabled={tab.disabled}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          className={styles.panel}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

Tabs.displayName = 'Tabs';
