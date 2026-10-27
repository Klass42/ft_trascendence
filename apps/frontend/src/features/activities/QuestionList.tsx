import { useState } from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  useToast,
} from '@/components/ui';
import { useActivityMutations } from '@/lib/api';
import type { ActivityDTO, QuestionDTO } from '@/lib/api';
import { QuestionForm } from './QuestionForm';
import { KIND_LABELS } from './helpers';

/**
 * Staff list of an activity's questions with add / edit / delete / reorder.
 * Reordering sends the full id list to the backend (which validates the set),
 * so the on-screen order is the source of truth.
 */
interface Props {
  activity: ActivityDTO;
  onChanged: () => void;
}

export function QuestionList({ activity, onChanged }: Props) {
  const { toast } = useToast();
  const { createQuestion, deleteQuestion, reorderQuestions, isLoading } = useActivityMutations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<QuestionDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionDTO | null>(null);

  const questions = [...(activity.questions ?? [])].sort((a, b) => a.order - b.order);

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const ids = questions.map((q) => q.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await reorderQuestions(activity.id, ids);
      onChanged();
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo reordenar.',
      });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteQuestion(confirmDelete.id);
      toast({ variant: 'success', message: 'Pregunta eliminada.' });
      setConfirmDelete(null);
      onChanged();
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo eliminar.',
      });
    }
  }

  async function duplicate(question: QuestionDTO) {
    try {
      await createQuestion(activity.id, {
        kind: question.kind,
        prompt: question.prompt,
        points: question.points,
        order: questions.length,
        content: { ...question.content },
      });
      toast({ variant: 'success', message: 'Pregunta duplicada.' });
      onChanged();
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo duplicar la pregunta.',
      });
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
          Preguntas ({questions.length})
        </h3>
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          + Añadir pregunta
        </Button>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          title="Sin preguntas todavía"
          description="Añade la primera pregunta para que la actividad sea realizable."
        />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.map((q, i) => (
            <li
              key={q.id}
              style={{
                border: '1px solid var(--color-border-primary)',
                borderRadius: 10,
                padding: '12px 14px',
                background: 'var(--color-bg-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Badge variant="neutral">{KIND_LABELS[q.kind]}</Badge>
                    <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                      {q.points} {q.points === 1 ? 'punto' : 'puntos'}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {i + 1}. {q.prompt}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flex: '1 1 auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" aria-label={`Subir pregunta ${i + 1}`} disabled={i === 0 || isLoading} onClick={() => move(i, -1)}>↑</Button>
                  <Button variant="ghost" size="sm" aria-label={`Bajar pregunta ${i + 1}`} disabled={i === questions.length - 1 || isLoading} onClick={() => move(i, 1)}>↓</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(q)}>Editar</Button>
                  <Button variant="outline" size="sm" aria-label={`Duplicar pregunta ${i + 1}`} disabled={isLoading} onClick={() => void duplicate(q)}>Duplicar</Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(q)}>Borrar</Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Add */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Nueva pregunta" size="lg">
        <QuestionForm
          activityId={activity.id}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      {/* Edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar pregunta" size="lg">
        {editing && (
          <QuestionForm
            activityId={activity.id}
            initial={editing}
            onSaved={() => {
              setEditing(null);
              onChanged();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Borrar pregunta"
        message="¿Seguro que quieres borrar esta pregunta? Esta acción no se puede deshacer."
        confirmLabel="Borrar"
        variant="danger"
        loading={isLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
