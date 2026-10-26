import type { ReactNode } from 'react';
import { Download, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { apiClient, type LearningResourceDTO } from '@/lib/api';
import { resourceStatusLabel, resourceTypeLabel } from './resource-helpers';

interface ResourceCardProps {
  resource: LearningResourceDTO;
  showStatus?: boolean;
  required?: boolean;
  /** Library-only ⋮ menu (#26). Course tabs do not pass it. */
  actions?: ReactNode;
  /** Library-only selection checkbox, shown in «Seleccionar» mode. */
  selection?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void };
}

/** Read-only resource presentation shared by the library and a course tab. */
export function ResourceCard({ resource, showStatus = false, required = false, actions, selection }: ResourceCardProps) {
  const openExternal = () => {
    if (resource.externalUrl) window.open(resource.externalUrl, '_blank', 'noopener,noreferrer');
  };

  const downloadFile = async () => {
    if (!resource.fileId) return;
    try {
      const { url, originalName } = await apiClient.get<{ url: string; originalName: string }>(
        `/files/${resource.fileId}/url`,
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName || resource.file?.originalName || 'archivo';
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      window.alert('No se pudo descargar el archivo. Comprueba que tienes acceso al recurso.');
    }
  };

  return (
    <article style={{
      border: '1px solid var(--color-border-primary)', borderRadius: 12,
      padding: 16, background: 'var(--color-bg-secondary)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        {selection && (
          <input
            type="checkbox"
            aria-label={`Seleccionar ${resource.title}`}
            checked={selection.checked}
            disabled={selection.disabled}
            title={selection.disabled ? 'No puedes gestionar este recurso' : undefined}
            onChange={(e) => selection.onChange(e.target.checked)}
            style={{ marginTop: 3, alignSelf: 'flex-start' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-primary)' }}>
              {resourceTypeLabel(resource.type)}
            </span>
            {showStatus && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{resourceStatusLabel(resource.status)}</span>}
            {required && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>Obligatorio</span>}
          </div>
          <h3 style={{ margin: '5px 0 4px', fontSize: 16 }}>{resource.title}</h3>
          {resource.authors.length > 0 && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{resource.authors.join(', ')}</div>}
        </div>
        {actions && <div style={{ alignSelf: 'flex-start' }}>{actions}</div>}
      </div>
      {resource.description && <p style={{ margin: '10px 0', fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>{resource.description}</p>}
      {resource.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {resource.tags.map((tag) => <span key={tag} style={{ fontSize: 11, background: 'var(--color-bg-tertiary)', padding: '3px 7px', borderRadius: 6 }}>{tag}</span>)}
        </div>
      )}
      {resource.externalUrl ? (
        <button type="button" onClick={openExternal} style={linkButtonStyle}>
          <LinkIcon size={15} /> Abrir recurso <ExternalLink size={13} />
        </button>
      ) : resource.file ? (
        <button type="button" onClick={() => void downloadFile()} style={linkButtonStyle}>
          <Download size={15} /> Descargar {resource.file.originalName}
        </button>
      ) : null}
    </article>
  );
}

const linkButtonStyle = {
  border: 'none', background: 'none', padding: 0, color: 'var(--color-accent-primary)',
  cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', gap: 5,
} as const;
