import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
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

        {attempt?.answers && (
          <div>
            {subjective.map((q) => {
              const answer = attempt.answers?.find((a) => a.questionId === q.id);
              const text = answer?.response?.text;
              const responseFileIds = Array.isArray(answer?.response?.fileIds)
                ? answer.response.fileIds.filter((id): id is string => typeof id === 'string')
                : [];
              const files = q.kind === 'FILE_UPLOAD'
                ? (answer?.files ?? []).filter((file) => responseFileIds.includes(file.id))
                : [];
              if ((typeof text !== 'string' || !text) && files.length === 0) return null;
              return (
                <div
                  key={q.id}
                  style={{
                    marginTop: 8,
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 9,
                    padding: '10px 12px',
                  }}
                >
                  {typeof text === 'string' && text && (
                    <p style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                      <strong>Respuesta:</strong> {text}
                    </p>
                  )}
                  {files.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <strong style={{ fontSize: 13.5 }}>Archivos entregados:</strong>
                      {files.map((file) => (
                        <SubmissionFile key={file.id} file={file} />
                      ))}
                    </div>
                  )}
                </div>
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

function SubmissionFile({ file }: { file: { id: string; originalName: string } }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadFile() {
    setIsLoading(true);
    setError(null);
    try {
      const { url, originalName } = await apiClient.get<{
        url: string;
        originalName: string;
      }>(`/files/${encodeURIComponent(file.id)}/url`);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName || file.originalName;
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el archivo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={<Download size={15} />}
        loading={isLoading}
        onClick={downloadFile}
      >
        {file.originalName}
      </Button>
      {error && <span role="alert" style={{ color: 'var(--color-error)', fontSize: 12 }}>{error}</span>}
    </div>
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
