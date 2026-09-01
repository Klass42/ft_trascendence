import { useState } from 'react';
import {
  Button,
  DatePicker,
  FileUpload,
  Input,
  Textarea,
  useToast,
  type FileValue,
} from '@/components/ui';
import {
  useAuth,
  useCreateAssignment,
  useUpdateAssignment,
} from '@/lib/api';
import type {
  AssignmentDTO,
  AssignmentFileDTO,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from '@/lib/api';
import { openFile, toDatetimeLocal, toIso } from './helpers';

interface AssignmentFormProps {
  courseId: string;
  /** When set, the form edits this assignment (PATCH); otherwise it creates. */
  initial?: AssignmentDTO;
  onSaved: (assignment: AssignmentDTO) => void;
  onCancel: () => void;
  /** Rendered inside a Modal (edit) vs inline (create) — affects the wrapper. */
  inModal?: boolean;
}

/**
 * Create/edit an assignment, composing the design system. Handles the full
 * submission window (openAt/dueAt/closeAt via DatePicker) and the teacher's
 * prompt attachments (FileUpload → /files, linked by id). Validates client-side
 * (title, score, window ordering); the backend re-validates everything.
 */
export function AssignmentForm({
  courseId,
  initial,
  onSaved,
  onCancel,
  inModal = false,
}: AssignmentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { create, isLoading: creating } = useCreateAssignment();
  const { update, isLoading: updating } = useUpdateAssignment();
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [openAt, setOpenAt] = useState(toDatetimeLocal(initial?.openAt));
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt));
  const [closeAt, setCloseAt] = useState(toDatetimeLocal(initial?.closeAt));
  const [maxScore, setMaxScore] = useState(String(initial?.maxScore ?? 100));
  // Existing attachments the teacher keeps (edit mode).
  const [keptFiles, setKeptFiles] = useState<AssignmentFileDTO[]>(
    initial?.files ?? [],
  );
  // Files uploaded in this editing session.
  const [fileValues, setFileValues] = useState<FileValue[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isLoading = creating || updating;
  const uploading = fileValues.some(
    (f) => f.status === 'uploading' || f.status === 'pending',
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    const score = Number(maxScore);
    if (!Number.isFinite(score) || score < 1) {
      setError('La puntuación máxima debe ser un número ≥ 1.');
      return;
    }
    if (uploading) {
      setError('Espera a que terminen de subirse los archivos.');
      return;
    }
    // Client-side window ordering (backend re-checks).
    const o = openAt ? new Date(openAt).getTime() : null;
    const d = dueAt ? new Date(dueAt).getTime() : null;
    const c = closeAt ? new Date(closeAt).getTime() : null;
    if (o !== null && d !== null && o > d) {
      setError('La apertura no puede ser posterior a la entrega.');
      return;
    }
    if (d !== null && c !== null && d > c) {
      setError('La entrega no puede ser posterior al cierre.');
      return;
    }
    if (o !== null && c !== null && o > c) {
      setError('La apertura no puede ser posterior al cierre.');
      return;
    }

    const newDoneIds = fileValues
      .filter((f) => f.status === 'done')
      .map((f) => f.id);
    const fileIds = [...keptFiles.map((k) => k.fileId), ...newDoneIds];

    try {
      let saved: AssignmentDTO;
      if (isEdit) {
        // Send explicit nulls so cleared bounds are persisted.
        const payload: UpdateAssignmentInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          openAt: toIso(openAt),
          dueAt: toIso(dueAt),
          closeAt: toIso(closeAt),
          maxScore: score,
          fileIds,
        };
        saved = await update(initial.id, payload);
        toast({ variant: 'success', message: 'Tarea actualizada.' });
      } else {
        const payload: CreateAssignmentInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          openAt: toIso(openAt) ?? undefined,
          dueAt: toIso(dueAt) ?? undefined,
          closeAt: toIso(closeAt) ?? undefined,
          maxScore: score,
          fileIds: fileIds.length ? fileIds : undefined,
        };
        saved = await create(courseId, payload);
        toast({ variant: 'success', message: 'Tarea creada.' });
      }
      onSaved(saved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la tarea.',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        ...(inModal
          ? {}
          : {
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-3)',
            }),
      }}
    >
      {!inModal && (
        <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-md)' }}>
          Nueva tarea
        </div>
      )}

      <Input
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="p. ej. Práctica 2 — CSS Flexbox"
        required
      />

      <Textarea
        label="Descripción"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Enunciado de la tarea…"
      />

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <DatePicker
            label="Apertura"
            mode="datetime"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            hint="Vacío = abierta ya"
          />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <DatePicker
            label="Entrega (fecha límite)"
            mode="datetime"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            hint="Tras esto: entrega tardía"
          />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <DatePicker
            label="Cierre"
            mode="datetime"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            hint="Vacío = sin cierre"
          />
        </div>
      </div>

      <div style={{ maxWidth: 200 }}>
        <Input
          label="Puntuación máx."
          type="number"
          min={1}
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
        />
      </div>

      {/* Existing attachments (edit mode) */}
      {keptFiles.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              marginBottom: 'var(--space-1)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Recursos adjuntos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {keptFiles.map((f) => (
              <div
                key={f.fileId}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
              >
                <button
                  type="button"
                  onClick={() => openFile(f.fileId)}
                  style={{
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
                  {f.file.originalName}
                </button>
                <button
                  type="button"
                  aria-label={`Quitar ${f.file.originalName}`}
                  onClick={() =>
                    setKeptFiles((prev) =>
                      prev.filter((k) => k.fileId !== f.fileId),
                    )
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {user?.organizationId && (
        <FileUpload
          organizationId={user.organizationId}
          uploaderId={user.userId}
          multiple
          maxFiles={5}
          value={fileValues}
          onChange={setFileValues}
          hint="Adjunta recursos del enunciado (máx. 5 archivos)."
        />
      )}

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isLoading} disabled={uploading}>
          {isEdit ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
      </div>
    </form>
  );
}
