import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Library } from 'lucide-react';
import type { ResourceFolderDTO } from '@/lib/api';
import styles from './ResourcesPage.module.css';

/**
 * Drive-style folder tree for the library sidebar (#22). Clicking a node
 * navigates; the chevron only expands/collapses. Ancestors of the active
 * folder are always expanded so the current location stays visible.
 */
export function FolderTree({ folders, activeId, onOpen }: {
  folders: ResourceFolderDTO[];
  activeId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const children = useMemo(() => {
    const map = new Map<string | null, ResourceFolderDTO[]>();
    for (const f of folders) {
      const list = map.get(f.parentId) ?? [];
      list.push(f);
      map.set(f.parentId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);
  const ancestors = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const out = new Set<string>();
    let cur = activeId ? byId.get(activeId) : undefined;
    while (cur?.parentId && !out.has(cur.parentId)) { out.add(cur.parentId); cur = byId.get(cur.parentId); }
    return out;
  }, [folders, activeId]);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
    const list = children.get(parentId);
    if (!list?.length) return null;
    return (
      <ul role={depth === 0 ? undefined : 'group'} className={styles.treeList}>
        {list.map((f) => {
          const hasKids = !!children.get(f.id)?.length;
          const open = expanded.has(f.id) || ancestors.has(f.id);
          const active = f.id === activeId;
          return (
            <li key={f.id} role="treeitem" aria-expanded={hasKids ? open : undefined} aria-selected={active}>
              <div className={`${styles.treeRow} ${active ? styles.treeRowActive : ''}`} style={{ paddingLeft: 6 + depth * 14 }}>
                {hasKids ? (
                  <button type="button" className={styles.treeChevron} onClick={() => toggle(f.id)} aria-label={`${open ? 'Contraer' : 'Expandir'} ${f.name}`}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : <span className={styles.treeChevron} aria-hidden="true" />}
                <button type="button" className={styles.treeLabel} onClick={() => onOpen(f.id)} aria-current={active ? 'page' : undefined} title={f.name}>
                  {active || open ? <FolderOpen size={16} aria-hidden="true" /> : <Folder size={16} aria-hidden="true" />}
                  <span>{f.name}</span>
                </button>
              </div>
              {hasKids && open && renderLevel(f.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <nav aria-label="Carpetas de la biblioteca">
      <div role="tree" aria-label="Árbol de carpetas">
        <div className={`${styles.treeRow} ${activeId === null ? styles.treeRowActive : ''}`} style={{ paddingLeft: 6 }}>
          <span className={styles.treeChevron} aria-hidden="true" />
          <button type="button" className={styles.treeLabel} onClick={() => onOpen(null)} aria-current={activeId === null ? 'page' : undefined}>
            <Library size={16} aria-hidden="true" /><span>Biblioteca</span>
          </button>
        </div>
        {renderLevel(null, 1)}
        {folders.length === 0 && <p className={styles.treeEmpty}>Aún no hay carpetas.</p>}
      </div>
    </nav>
  );
}
