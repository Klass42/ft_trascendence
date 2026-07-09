import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useCreateAssignment } from '@/lib/api';

interface CreateAssignmentFormProps {
  courseId: string;
  onCreated: () => void;
  onCancel: () => void;
}

/** Inline form for a teacher to create a new assignment in the current course. */
export function CreateAssignmentForm({
  courseId,
  onCreated,
  onCancel,
}: CreateAssignmentFormProps) {
  const { create, isLoading } = useCreateAssignment();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [error, setError] = useState<string | null>(null);

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

    try {
      await create(courseId, {
        title: title.trim(),
        description: description.trim() || undefined,
        // datetime-local yields "YYYY-MM-DDTHH:mm"; make it a full ISO string.
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        maxScore: score,
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear la tarea.',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15 }}>Nueva tarea</div>

      <Input
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="p. ej. Práctica 2 — CSS Flexbox"
        required
      />

      <div>
        <label
          htmlFor="new-assignment-desc"
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: 'var(--color-text-secondary)',
          }}
        >
          Descripción
        </label>
        <textarea
          id="new-assignment-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            borderRadius: 10,
            border: '1px solid var(--color-border-primary)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <Input
            label="Fecha límite"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <Input
            label="Puntuación máx."
            type="number"
            min={1}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="submit" variant="primary" loading={isLoading}>
          Crear tarea
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
