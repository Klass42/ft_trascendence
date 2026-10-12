import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Spinner, Textarea } from '@/components/ui';
import { apiClient, useGradeAttempt } from '@/lib/api';
import type { ActivityDTO, AttemptDTO, QuestionDTO } from '@/lib/api';
import { isSubjective } from '../activities/helpers';

export interface GradeTarget {
  attemptId: string;
  activityId: string;
  studentName: string;
  title: string;
}

interface GradePanelProps {
  target: GradeTarget;
  onClose: () => void;
  onGraded: () => void;
}

/**
 * Grade subjective blocks of an attempt. Loads the activity questions and the
 * attempt so awarded points go to ESSAY / FILE_UPLOAD (and manual SHORT_ANSWER).
 */
export function GradePanel({ target, onClose, onGraded }: GradePanelProps) {
  const { grade, isLoading } = useGradeAttempt();
  const [activity, setActivity] = useState<ActivityDTO | null>(null);
  const [attempt, setAttempt] = useState<AttemptDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [awarded, setAwarded] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    Promise.all([
      apiClient.get<ActivityDTO>(`/activities/${target.activityId}`),
      apiClient.get<AttemptDTO[]>(`/activities/${target.activityId}/attempts`),
    ])
      .then(([act, attempts]) => {
        if (cancelled) return;
        const found = attempts.find((a) => a.id === target.attemptId) ?? null;
        setActivity(act);
        setAttempt(found);
        setFeedback(found?.feedback ?? '');
        const initial: Record<string, string> = {};
        for (const q of act.questions ?? []) {
          if (!isSubjective(q.kind, q.content)) continue;
          const ans = found?.answers?.find((a) => a.questionId === q.id);
          initial[q.id] = ans?.awarded != null ? String(ans.awarded) : '';
        }
        setAwarded(initial);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el intento.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [target.activityId, target.attemptId]);

  const subjective = useMemo(
    () => (activity?.questions ?? []).filter((q) => isSubjective(q.kind, q.content)),
    [activity],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const answers: { questionId: string; awarded: number }[] = [];
    for (const q of subjective) {
      const raw = awarded[q.id];
      if (raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > q.points) {
        setError(`La nota de «${q.prompt.slice(0, 40)}» debe estar entre 0 y ${q.points}.`);
        return;
      }
      answers.push({ questionId: q.id, awarded: value });
    }
    if (answers.length === 0) {
      setError('Indica al menos una nota en un bloque subjetivo.');
      return;
    }

    try {
      await grade(target.attemptId, {
        answers,
        feedback: feedback.trim() || undefined,
      });
      onGraded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la nota.');
    }
  }

  return (
    <Modal open onClose={onClose} title="Calificar" size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          {target.studentName} · {target.title}
        </div>

        {!activity && !loadError && <Spinner size="md" label="Cargando intento…" />}
        {loadError && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>{loadError}</p>
        )}

        {activity && subjective.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
            Esta tarea no tiene bloques de corrección manual.
          </p>
        )}

        {subjective.map((q) => (
          <SubjectiveRow
            key={q.id}
            question={q}
            value={awarded[q.id] ?? ''}
            onChange={(v) => setAwarded((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}

        {attempt?.answers && attempt.answers.some((a) => typeof a.response?.text === 'string' && a.response.text) && (
          <div>
            {subjective.map((q) => {
              const text = attempt.answers?.find((a) => a.questionId === q.id)?.response?.text;
              if (typeof text !== 'string' || !text) return null;
              return (
                <p
                  key={q.id}
                  style={{
                    fontSize: 13.5,
                    whiteSpace: 'pre-wrap',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 9,
                    padding: '10px 12px',
                  }}
                >
                  <strong>Respuesta:</strong> {text}
                </p>
              );
            })}
          </div>
        )}

        <Textarea
          label="Feedback (opcional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          placeholder="Comentarios para el alumno…"
        />

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={isLoading} disabled={!activity}>
            Guardar nota
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SubjectiveRow({
  question,
  value,
  onChange,
}: {
  question: QuestionDTO;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      label={`${question.prompt.slice(0, 80) || 'Bloque'} (0 – ${question.points})`}
      type="number"
      min={0}
      max={question.points}
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
