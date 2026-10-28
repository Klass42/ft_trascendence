import { useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { useCreateThread } from '@/lib/api';
import type { ForumThreadListItemDTO } from '@/lib/api';
import { CharCounter } from './CharCounter';
import { FORUM_BODY_MAX, FORUM_TITLE_MAX, titleError } from './helpers';

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
  const [titleTouched, setTitleTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidTitle = titleError(title);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTitleTouched(true);
    if (invalidTitle) return;

    try {
      const thread = await create(courseId, {
        title: title.trim(),
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
      noValidate
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
        onChange={(e) => {
          setTitle(e.target.value);
          setTitleTouched(true);
          setError(null);
        }}
        placeholder="p. ej. Duda sobre el ejercicio 3"
        maxLength={FORUM_TITLE_MAX}
        error={titleTouched ? invalidTitle ?? undefined : undefined}
        required
      />
      <CharCounter length={title.length} max={FORUM_TITLE_MAX} />

      <Textarea
        label="Mensaje inicial (opcional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={FORUM_BODY_MAX}
        placeholder="Describe tu pregunta o tema…"
      />
      <CharCounter length={body.length} max={FORUM_BODY_MAX} />

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          disabled={invalidTitle !== null}
        >
          Crear hilo
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
