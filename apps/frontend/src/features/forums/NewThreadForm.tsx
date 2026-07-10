import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useCreateThread } from '@/lib/api';
import type { ForumThreadListItemDTO } from '@/lib/api';

interface NewThreadFormProps {
  courseId: string;
  onCreated: (thread: ForumThreadListItemDTO) => void;
  onCancel: () => void;
}

/** Inline form to open a new forum thread with an optional opening message. */
export function NewThreadForm({
  courseId,
  onCreated,
  onCancel,
}: NewThreadFormProps) {
  const { create, isLoading } = useCreateThread();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = title.trim();
    if (!trimmed) {
      setError('El título es obligatorio.');
      return;
    }
    if (trimmed.length > 200) {
      setError('El título no puede superar los 200 caracteres.');
      return;
    }

    try {
      const thread = await create(courseId, {
        title: trimmed,
        body: body.trim() || undefined,
      });
      onCreated(thread);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear el hilo.',
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
        marginBottom: 16,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15 }}>Nuevo hilo</div>

      <Input
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="p. ej. Duda sobre el ejercicio 3"
        maxLength={200}
        required
      />

      <div>
        <label
          htmlFor="new-thread-body"
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 6,
            color: 'var(--color-text-secondary)',
          }}
        >
          Mensaje inicial (opcional)
        </label>
        <textarea
          id="new-thread-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Describe tu pregunta o tema…"
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

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="submit" variant="primary" loading={isLoading}>
          Crear hilo
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
