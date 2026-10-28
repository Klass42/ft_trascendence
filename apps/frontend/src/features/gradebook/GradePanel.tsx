import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Badge, Button, Input, Modal, Spinner, Textarea } from '@/components/ui';
import { apiClient, useGradeAttempt } from '@/lib/api';
import type { ActivityDTO, AnswerDTO, AttemptDTO, GradeAttemptInput, QuestionDTO } from '@/lib/api';
import {
  formatAnswer,
  formatSolution,
  isAnswered,
  isSubjective,
  KIND_LABELS,
  pointsLabel,
} from '../activities/helpers';
import styles from './GradePanel.module.css';

/** Mirrors the backend `GRADE_FEEDBACK_MAX` (per-question comment length). */
const GRADE_FEEDBACK_MAX = 2000;

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
  const [comments, setComments] = useState<Record<string, string>>({});
  const [initialComments, setInitialComments] = useState<Record<string, string>>({});
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
        if (!found) {
          setLoadError('No se encontró la entrega. Puede que ya no exista.');
          return;
        }
        setActivity(act);
        setAttempt(found);
        setFeedback(found?.feedback ?? '');
        const initial: Record<string, string> = {};
        const initialNotes: Record<string, string> = {};
        for (const q of act.questions ?? []) {
          const ans = found?.answers?.find((a) => a.questionId === q.id);
          initialNotes[q.id] = ans?.feedback ?? '';
          if (!isSubjective(q.kind, q.content)) continue;
          initial[q.id] = ans?.awarded != null ? String(ans.awarded) : '';
        }
        setAwarded(initial);
        setComments(initialNotes);
        setInitialComments(initialNotes);
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

  const questions = useMemo(
    () => [...(activity?.questions ?? [])].sort((a, b) => a.order - b.order),
    [activity],
  );
  const subjective = useMemo(
    () => questions.filter((q) => isSubjective(q.kind, q.content)),
    [questions],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const answers: GradeAttemptInput['answers'] = [];
    for (const q of questions) {
      const item: GradeAttemptInput['answers'][number] = { questionId: q.id };
      const raw = awarded[q.id];
      if (raw !== undefined && raw !== '') {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > q.points) {
          setError(`La nota de «${q.prompt.slice(0, 40)}» debe estar entre 0 y ${q.points}.`);
          return;
        }
        item.awarded = value;
      }
      const comment = (comments[q.id] ?? '').trim();
      if (comment.length > GRADE_FEEDBACK_MAX) {
        setError(`El comentario de «${q.prompt.slice(0, 40)}» no puede superar ${GRADE_FEEDBACK_MAX} caracteres.`);
        return;
      }
      // An emptied comment is sent too so the backend clears the stored one.
      if (comment || comment !== (initialComments[q.id] ?? '').trim()) item.feedback = comment;
      if (item.awarded !== undefined || item.feedback !== undefined) answers.push(item);
    }
    if (subjective.length > 0 && answers.length === 0) {
      setError('Indica al menos una nota o un comentario.');
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
      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        <div className={styles.context}>
          {[attempt?.user?.name ?? target.studentName, target.title].filter(Boolean).join(' · ')}
        </div>

        {!activity && !loadError && <Spinner size="md" label="Cargando intento…" />}
        {loadError && <p className={styles.error}>{loadError}</p>}

        {activity && subjective.length === 0 && (
          <p className={styles.muted}>Esta tarea no tiene preguntas de corrección manual.</p>
        )}

        {activity && (
          <ol className={styles.questions}>
            {questions.map((q, index) => (
              <GradeQuestion
                key={q.id}
                question={q}
                number={index + 1}
                answer={attempt?.answers?.find((a) => a.questionId === q.id)}
                awarded={awarded[q.id] ?? ''}
                onAwardedChange={(v) => setAwarded((prev) => ({ ...prev, [q.id]: v }))}
                comment={comments[q.id] ?? ''}
                onCommentChange={(v) => setComments((prev) => ({ ...prev, [q.id]: v }))}
              />
            ))}
          </ol>
        )}

        <Textarea
          label="Comentario general (opcional)"
          value={feedback}
          maxLength={GRADE_FEEDBACK_MAX}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          placeholder="Valoración global del intento…"
        />

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
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
    <div className={styles.fileItem}>
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
      {error && <span role="alert" className={styles.fileError}>{error}</span>}
    </div>
  );
}

function GradeQuestion({
  question,
  number,
  answer,
  awarded,
  onAwardedChange,
  comment,
  onCommentChange,
}: {
  question: QuestionDTO;
  number: number;
  answer?: AnswerDTO;
  awarded: string;
  onAwardedChange: (v: string) => void;
  comment: string;
  onCommentChange: (v: string) => void;
}) {
  const manual = isSubjective(question.kind, question.content);
  const answered = isAnswered(question.kind, answer?.response);
  const fileIds = Array.isArray(answer?.response?.fileIds)
    ? answer.response.fileIds.filter((id): id is string => typeof id === 'string')
    : [];
  const files = question.kind === 'FILE_UPLOAD'
    ? (answer?.files ?? []).filter((file) => fileIds.includes(file.id))
    : [];
  const verdict = !manual && answered && typeof answer?.correct === 'boolean' ? answer.correct : null;
  return (
    <li className={styles.question}>
      <div className={styles.questionHead}>
        <span>Pregunta {number}</span>
        <span className={styles.headMeta}>
          {KIND_LABELS[question.kind]} · {pointsLabel(question.points)}
          {verdict !== null && (
            <Badge variant={verdict ? 'success' : 'error'}>{verdict ? 'Correcta' : 'Incorrecta'}</Badge>
          )}
        </span>
      </div>
      <p className={styles.prompt}>{question.prompt}</p>
      <div className={styles.answerBox}>
        <span className={styles.answerLabel}>Respuesta del alumno</span>
        {files.length > 0 ? (
          <div className={styles.files}>
            {files.map((file) => (
              <SubmissionFile key={file.id} file={file} />
            ))}
          </div>
        ) : (
          <p className={[styles.answer, answered ? '' : styles.unanswered].filter(Boolean).join(' ')}>
            {formatAnswer(question, answer?.response)}
          </p>
        )}
      </div>
      {!manual && (
        <p className={styles.solution}>
          <strong>Respuesta correcta:</strong> {formatSolution(question, question.content)}
          {typeof answer?.awarded === 'number' && ` · Obtenido: ${answer.awarded}/${question.points}`}
        </p>
      )}
      {manual && (
        <Input
          label={`Puntos de la pregunta ${number} (0 – ${question.points})`}
          type="number"
          min={0}
          max={question.points}
          step="any"
          value={awarded}
          onChange={(e) => onAwardedChange(e.target.value)}
        />
      )}
      <Textarea
        label="Comentario para el alumno (opcional)"
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        rows={2}
        maxLength={GRADE_FEEDBACK_MAX}
        hint={`${comment.length}/${GRADE_FEEDBACK_MAX}`}
        error={comment.length > GRADE_FEEDBACK_MAX ? `Máximo ${GRADE_FEEDBACK_MAX} caracteres.` : undefined}
      />
    </li>
  );
}
