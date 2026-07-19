import { Paperclip } from 'lucide-react';
import type { AssignmentFileDTO } from '@/lib/api';
import { openFile } from './helpers';

/**
 * Read-only list of a teacher's prompt attachments, shown to every course
 * member on the assignment detail. Clicking a file opens its signed URL.
 */
export function AssignmentAttachments({ files }: { files: AssignmentFileDTO[] }) {
  if (files.length === 0) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Recursos del profesor
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {files.map((f) => (
          <button
            key={f.fileId}
            type="button"
            onClick={() => openFile(f.fileId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-accent-primary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--text-sm)',
              textAlign: 'left',
            }}
          >
            <Paperclip size={15} />
            {f.file.originalName}
          </button>
        ))}
      </div>
    </div>
  );
}
