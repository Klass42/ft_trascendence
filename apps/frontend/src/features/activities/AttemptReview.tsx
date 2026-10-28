import { Badge, Button, Spinner } from '@/components/ui';
import { useMyAttempt } from '@/lib/api';
import type { AnswerDTO, AttemptDTO, QuestionDTO } from '@/lib/api';
import { openFile } from '../assignments/helpers';
import { formatDateTime, plural } from '@/lib/format';
import {
  ATTEMPT_STATUS_BADGE,
  formatAnswer,
  formatSolution,
  isAnswered,
  isSubjective,
} from './helpers';
import styles from './AttemptReview.module.css';

interface HistoryProps {
  attempts: AttemptDTO[];
  maxScore: number;
  selectedId: string | null;
  onSelect: (attemptId: string | null) => void;
  /** Result message shown right after the learner submits. */
  notice?: string | null;
}

/** Every attempt the learner has made, with an expandable per-attempt review. */
export function AttemptHistory({ attempts, maxScore, selectedId, onSelect, notice }: HistoryProps) {
  if (!attempts.length) return null;
  return (
    <section className={styles.history} aria-label="Intentos anteriores">
      <h3 className={styles.historyTitle}>Intentos anteriores</h3>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <ul className={styles.attemptList}>
        {attempts.map((attempt) => {
          const badge = ATTEMPT_STATUS_BADGE[attempt.status];
          const completed = attempt.status !== 'IN_PROGRESS';
          const open = selectedId === attempt.id;
          return (
            <li key={attempt.id} className={styles.attemptRow}>
              <span className={styles.attemptMeta}>
                <strong>Intento {attempt.attemptNo}</strong>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {attempt.submittedAt && <span className={styles.muted}>{formatDateTime(attempt.submittedAt)}</span>}
              </span>
              <span className={styles.attemptActions}>
                <strong>
                  {attempt.status === 'GRADED' ? `${attempt.score ?? 0}/${maxScore}` : completed ? 'Enviado' : 'Sin enviar'}
                </strong>
                {completed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-expanded={open}
                    aria-label={`${open ? 'Ocultar' : 'Ver'} detalle del intento ${attempt.attemptNo}`}
                    onClick={() => onSelect(open ? null : attempt.id)}
                  >
                    {open ? 'Ocultar detalle' : 'Ver detalle'}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {selectedId && <AttemptReview attemptId={selectedId} maxScore={maxScore} />}
    </section>
  );
}

function AttemptReview({ attemptId, maxScore }: { attemptId: string; maxScore: number }) {
  const { attempt, isLoading, error } = useMyAttempt(attemptId);
  if (isLoading) return <div className={styles.review}><Spinner size="sm" label="Cargando intento…" /></div>;
  if (error || !attempt) {
    return <div className={styles.review}><p role="alert" className={styles.error}>No se pudo cargar el detalle de este intento.</p></div>;
  }
  const badge = ATTEMPT_STATUS_BADGE[attempt.status];
  const questions = attempt.activity?.questions ?? [];
  const answers = new Map((attempt.answers ?? []).map((answer) => [answer.questionId, answer]));
  const graded = attempt.status === 'GRADED';
  const hasBreakdown = (attempt.answers ?? []).some((answer) => answer.awarded !== undefined);
  return (
    <div className={styles.review} aria-label={`Detalle del intento ${attempt.attemptNo}`} role="region">
      <div className={styles.reviewHeader}>
        <h4 className={styles.reviewTitle}>Intento {attempt.attemptNo}</h4>
        <span className={styles.attemptMeta}>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {graded && <strong>{attempt.score ?? 0}/{maxScore} {maxScore === 1 ? 'punto' : 'puntos'}</strong>}
        </span>
      </div>
      {attempt.status === 'SUBMITTED' && (
        <p className={styles.muted}>Pendiente de corrección. Verás la nota cuando el profesor la publique.</p>
      )}
      {graded && attempt.feedback && (
        <p className={styles.feedback}><strong>Comentario del profesor:</strong> {attempt.feedback}</p>
      )}
      {graded && !hasBreakdown && (
        <p className={styles.muted}>Esta tarea no muestra el detalle de aciertos por pregunta.</p>
      )}
      {questions.map((question, index) => (
        <ReviewQuestion key={question.id} question={question} number={index + 1} answer={answers.get(question.id)} />
      ))}
    </div>
  );
}

function ReviewQuestion({ question, number, answer }: { question: QuestionDTO; number: number; answer?: AnswerDTO }) {
  const hasVerdict = answer?.correct !== undefined;
  const subjective = isSubjective(question.kind, question.content);
  const awarded = answer?.awarded;
  const fileIds = Array.isArray(answer?.response?.fileIds)
    ? answer.response.fileIds.filter((id): id is string => typeof id === 'string')
    : [];
  const files = (answer?.files ?? []).filter((file) => fileIds.includes(file.id));
  return (
    <div className={styles.question}>
      <div className={styles.questionHead}>
        <span>Pregunta {number}</span>
        {hasVerdict && !subjective && typeof answer?.correct === 'boolean' && (
          !isAnswered(question.kind, answer.response)
            ? <Badge variant="neutral">Sin responder</Badge>
            : <Badge variant={answer.correct ? 'success' : 'error'}>{answer.correct ? 'Correcta' : 'Incorrecta'}</Badge>
        )}
      </div>
      <p className={styles.prompt}>{question.prompt}</p>
      <p className={styles.answer}>
        <strong>Tu respuesta:</strong>{' '}
        {question.kind === 'FILE_UPLOAD'
          ? (fileIds.length === 0 ? 'Sin respuesta' : files.length === 0 ? plural(fileIds.length, 'archivo entregado', 'archivos entregados') : '')
          : formatAnswer(question, answer?.response)}
      </p>
      {files.length > 0 && (
        <div className={styles.files}>
          {files.map((file) => (
            <Button key={file.id} type="button" variant="outline" size="sm" onClick={() => void openFile(file.id)}>
              {file.originalName}
            </Button>
          ))}
        </div>
      )}
      {typeof awarded === 'number' && (
        <span className={styles.points}>{awarded}/{question.points} {question.points === 1 ? 'punto' : 'puntos'}</span>
      )}
      {answer?.feedback && (
        <p className={styles.questionFeedback}>
          <strong>Comentario del profesor:</strong> {answer.feedback}
        </p>
      )}
      {hasVerdict && !subjective && (
        <p className={styles.solution}>
          <strong>Respuesta correcta:</strong> {formatSolution(question, question.content)}
        </p>
      )}
    </div>
  );
}
