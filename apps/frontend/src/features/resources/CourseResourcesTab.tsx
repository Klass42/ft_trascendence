import { useState } from 'react';
import { Search } from 'lucide-react';
import { useCourseResources, type LearningResourceType } from '@/lib/api';
import { RESOURCE_TYPES } from './resource-helpers';
import { ResourceCard } from './ResourceCard';

export function CourseResourcesTab({ courseId, showStaffStatus = false }: { courseId: string; showStaffStatus?: boolean }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<LearningResourceType | ''>('');
  const { data, isLoading, error } = useCourseResources(courseId, { search, type: type || undefined });

  return (
    <section style={{ padding: '26px 40px', maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Recursos</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Material publicado para este curso.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={fieldStyle}><Search size={15} /><input aria-label="Buscar recursos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" style={inputStyle} /></label>
          <select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value as LearningResourceType | '')} style={selectStyle}>
            <option value="">Todos los tipos</option>
            {RESOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>
      {isLoading && <p style={messageStyle}>Cargando recursos…</p>}
      {error && <p style={messageStyle}>No se pudieron cargar los recursos.</p>}
      {!isLoading && !error && data?.length === 0 && <p style={messageStyle}>Aún no hay recursos que coincidan.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {data?.map((item) => <ResourceCard key={item.resourceId} resource={item.resource} required={item.required} showStatus={showStaffStatus} />)}
      </div>
    </section>
  );
}

const fieldStyle = { display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--color-border-primary)', borderRadius: 8, padding: '0 8px', color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)' } as const;
const inputStyle = { border: 'none', outline: 'none', padding: '8px 0', width: 130, color: 'inherit', background: 'transparent', font: 'inherit', fontSize: 13 } as const;
const selectStyle = { border: '1px solid var(--color-border-primary)', borderRadius: 8, padding: '8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 13 } as const;
const messageStyle = { color: 'var(--color-text-secondary)', fontSize: 14 } as const;
