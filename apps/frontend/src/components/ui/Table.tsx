/**
 * Table Component
 *
 * Data-driven, styled table with a built-in empty state. Great for rosters,
 * gradebooks, admin lists.
 *
 * Usage:
 *   <Table
 *     columns={[
 *       { key: 'name', header: 'Alumno' },
 *       { key: 'role', header: 'Rol', render: (r) => <Badge>{r.role}</Badge> },
 *     ]}
 *     data={rows}
 *     rowKey={(r) => r.id}
 *     empty={<EmptyState title="Sin alumnos" />}
 *   />
 */
import { type ReactNode } from 'react';
import styles from './Table.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Extra class for this column's header and body cells (e.g. to highlight it). */
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  /** Shown (spanning all columns) when data is empty */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  empty,
  onRowClick,
  className,
}: TableProps<T>) {
  return (
    <div className={[styles.scroll, className].filter(Boolean).join(' ')}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={[styles.th, col.className].filter(Boolean).join(' ')}
                style={{ textAlign: col.align, width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className={styles.emptyCell} colSpan={columns.length}>
                {empty ?? 'No hay datos.'}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className={onRowClick ? styles.clickable : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={[styles.td, col.className].filter(Boolean).join(' ')} style={{ textAlign: col.align }}>
                    {col.render ? col.render(row) : ((row as Record<string, ReactNode>)[col.key] ?? null)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

Table.displayName = 'Table';
