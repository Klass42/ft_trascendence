import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { FileUpload, type FileValue } from '@/components/ui/FileUpload';
import { useActivity, useActivityAttempts, useAuth } from '@/lib/api';
import type {
  ActivityDTO,
  AttemptDTO,
  PreviewGradeResponse,
  PreviewGradeResult,
  QuestionDTO,
  SaveAnswersInput,
} from '@/lib/api';
import { formatDate, windowState, WINDOW_BADGE } from '../assignments/helpers';
import { AttemptHistory } from './AttemptReview';
import {
  attemptsAllowedLabel,
  attemptsRemainingLabel,
  countUnanswered,
  formatSolution,
  isSubjective,
  KIND_LABELS,
} from './helpers';

type ResponseMap = Record<string, Record<string, unknown>>;

interface Props {
  activityId?: string;
  onAttemptChanged?: () => void;
  mode?: 'student' | 'preview';
  previewActivity?: ActivityDTO;
  previewGrade?: PreviewGradeResponse | null;
  previewResponses?: ResponseMap;
  previewBusy?: boolean;
  onPreviewGrade?: (answers: SaveAnswersInput['answers']) => Promise<void>;
  onPreviewResultClear?: () => void;
  onPreviewResponsesChange?: (responses: ResponseMap) => void;
}

/** Student attempt player plus staff preview; preview content is injected so
 * it never needs to start or autosave an attempt. */
export function ActivityPlayer({
  activityId,
  onAttemptChanged,
  mode = 'student',
  previewActivity,
  previewGrade,
  previewResponses,
  previewBusy = false,
  onPreviewGrade,
  onPreviewResultClear,
  onPreviewResponsesChange,
}: Props) {
  const { toast } = useToast();
  const isPreview = mode === 'preview';
  const { data: loadedActivity, isLoading: activityLoading, error: activityError } = useActivity(isPreview ? null : activityId ?? null);
  const activity = isPreview ? previewActivity ?? null : loadedActivity;
  const {
    attempts,
    isLoading: attemptsLoading,
    error: attemptsError,
    start,
    save,
    submit,
    refetch,
  } = useActivityAttempts(isPreview ? null : activityId ?? null);
  const [activeAttempt, setActiveAttempt] = useState<AttemptDTO | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const responsesRef = useRef<ResponseMap>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [resultNotice, setResultNotice] = useState<string | null>(null);

  const latestAttempt = useMemo(
    () => attempts?.[attempts.length - 1] ?? null,
    [attempts],
  );
  const displayActivity = activeAttempt?.activity ?? activity;
  const state = activity ? windowState(activity.openAt, activity.closeAt) : 'open';
  const attemptsRemaining = activity
    ? activity.attemptsAllowed === 0
      ? null
      : Math.max(0, activity.attemptsAllowed - (attempts?.length ?? 0))
    : null;

  const setAllResponses = useCallback((next: ResponseMap) => {
    responsesRef.current = next;
    setResponses(next);
  }, []);

  const populateAttempt = useCallback((attempt: AttemptDTO) => {
    const initial: ResponseMap = {};
    for (const answer of attempt.answers ?? []) initial[answer.questionId] = answer.response;
    setAllResponses(initial);
    setActiveAttempt(attempt);
    setSaveState('idle');
  }, [setAllResponses]);

  const saveCurrent = useCallback(async (attempt = activeAttempt, values = responsesRef.current) => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return attempt;
    const answers: SaveAnswersInput['answers'] = Object.entries(values).map(([questionId, response]) => ({ questionId, response }));
    if (answers.length === 0) return attempt;
    setSaveState('saving');
    try {
      const updated = await save(attempt.id, { answers });
      setActiveAttempt(updated);
      setSaveState('saved');
      return updated;
    } catch (err) {
      setSaveState('error');
      throw err;
    }
  }, [activeAttempt, save]);

  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS' || Object.keys(responses).length === 0) return;
    const timeout = window.setTimeout(() => {
      void saveCurrent().catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [activeAttempt, responses, saveCurrent]);

  async function beginOrResume() {
    setIsStarting(true);
    try {
      const attempt = await start();
      populateAttempt(attempt);
      refetch();
      onAttemptChanged?.();
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo iniciar la tarea.' });
    } finally {
      setIsStarting(false);
    }
  }

  function updateResponse(questionId: string, response: Record<string, unknown>) {
    const next = { ...(previewResponses ?? responsesRef.current), [questionId]: response };
    setAllResponses(next);
    if (isPreview) {
      onPreviewResponsesChange?.(next);
      onPreviewResultClear?.();
      return;
    }
    // A saved indicator only describes the last server state. As soon as the
    // learner changes an answer again, make the pending autosave explicit.
    setSaveState('idle');
  }

  async function submitAttempt() {
    if (!activeAttempt) return;
    setIsSubmitting(true);
    try {
      await saveCurrent(activeAttempt);
      const completed = await submit(activeAttempt.id);
      setActiveAttempt(null);
      setAllResponses({});
      refetch();
      onAttemptChanged?.();
      setReviewId(completed.id);
      if (completed.status === 'GRADED') {
        // The grading notification already raises a toast; show the result in
        // the page instead of a second one.
        setResultNotice(`Tarea corregida: ${completed.score ?? 0}/${completed.activity?.maxScore ?? activity?.maxScore ?? 0}`);
      } else {
        setResultNotice(null);
        toast({ variant: 'success', message: 'Tarea enviada. Está pendiente de corrección.' });
      }
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo enviar la tarea.' });
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (!isPreview && (activityLoading || attemptsLoading)) return <Spinner size="md" label="Cargando actividad…" />;
  if (!activity || (!isPreview && (activityError || attemptsError))) {
    return <p style={{ color: 'var(--color-error)' }}>No se pudo cargar esta tarea. Puede que ya no esté disponible.</p>;
  }

  const resumable = attempts?.find((attempt) => attempt.status === 'IN_PROGRESS');
  const exhausted = attemptsRemaining === 0 && !resumable;
  // "Abierta" is misleading once the learner can no longer act: surface what
  // happened to their work instead.
  const winBadge = exhausted && latestAttempt
    ? latestAttempt.status === 'GRADED'
      ? { variant: 'success' as const, label: 'Corregida' }
      : { variant: 'info' as const, label: 'Entregada' }
    : resumable
      ? { variant: 'warning' as const, label: 'En curso' }
      : WINDOW_BADGE[state];
  const questionsToAnswer = displayActivity?.questions ?? [];
  const unanswered = countUnanswered(questionsToAnswer, responses);
  const confirmMessage = [
    unanswered > 0
      ? `Tienes ${unanswered} ${unanswered === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}.`
      : 'Has respondido todas las preguntas.',
    'Una vez enviada no podrás cambiar tus respuestas.',
    attemptsRemaining === null
      ? ''
      : attemptsRemaining === 0
        ? 'Este es tu último intento.'
        : `Después de enviarla ${attemptsRemaining === 1 ? 'te quedará 1 intento' : `te quedarán ${attemptsRemaining} intentos`}.`,
  ].filter(Boolean).join(' ');

  if (isPreview) {
    const currentResponses = previewResponses ?? responses;
    const checkPreview = () => {
      const answers = Object.entries(currentResponses).map(([questionId, response]) => ({ questionId, response }));
      void onPreviewGrade?.(answers);
    };
    return (
      <section aria-label={`Vista previa de la tarea: ${activity.title}`}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{activity.title}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Badge variant={winBadge.variant}>{winBadge.label}</Badge>
              <Badge variant="neutral">{activity.maxScore} pts</Badge>
              <Badge variant="neutral">{attemptsAllowedLabel(activity.attemptsAllowed)}</Badge>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '12px 0' }}>
          {activity.openAt ? `Abre ${formatDate(activity.openAt)} · ` : ''}
          {activity.dueAt ? `Entrega ${formatDate(activity.dueAt)}` : 'Sin fecha límite'}
          {activity.closeAt ? ` · Cierra ${formatDate(activity.closeAt)}` : ''}
          {activity.timeLimitSec ? ` · Tiempo recomendado: ${Math.ceil(activity.timeLimitSec / 60)} min` : ''}
        </p>
        {activity.description && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{activity.description}</p>}

        <AttemptForm
          activity={activity}
          responses={currentResponses}
          onChange={updateResponse}
          onSave={() => undefined}
          onSubmit={checkPreview}
          saving={false}
          submitting={previewBusy}
          previewGrade={previewGrade}
          preview
        />
        {previewGrade && (
          <p role="status" style={{ fontWeight: 700, marginBottom: 0 }}>
            Resultado simulado: {previewGrade.score}/{previewGrade.maxScore} puntos
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label={`Tarea: ${activity.title}`}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{activity.title}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <Badge variant={winBadge.variant}>{winBadge.label}</Badge>
            {exhausted && <Badge variant="neutral">Intentos agotados</Badge>}
            <Badge variant="neutral">{activity.maxScore} pts</Badge>
            <Badge variant="neutral">{attemptsAllowedLabel(activity.attemptsAllowed)}</Badge>
            {attemptsRemaining !== null && !exhausted && (
              <Badge variant="neutral">{attemptsRemaining === 0 ? 'Último intento en curso' : attemptsRemainingLabel(attemptsRemaining)}</Badge>
            )}
          </div>
        </div>
        {activeAttempt?.status === 'IN_PROGRESS' && (
          <span aria-live="polite" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'Error al guardar' : 'Borrador'}
          </span>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '12px 0' }}>
        {activity.openAt ? `Abre ${formatDate(activity.openAt)} · ` : ''}
        {activity.dueAt ? `Entrega ${formatDate(activity.dueAt)}` : 'Sin fecha límite'}
        {activity.closeAt ? ` · Cierra ${formatDate(activity.closeAt)}` : ''}
        {activity.timeLimitSec ? ` · Tiempo recomendado: ${Math.ceil(activity.timeLimitSec / 60)} min` : ''}
      </p>
      {activity.description && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{activity.description}</p>}

      {activeAttempt?.status === 'IN_PROGRESS' && displayActivity ? (
        <AttemptForm
          activity={displayActivity}
          responses={responses}
          onChange={updateResponse}
          onSave={() => void saveCurrent().catch((err) => toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo guardar.' }))}
          onSubmit={() => setConfirmOpen(true)}
          saving={saveState === 'saving'}
          submitting={isSubmitting}
        />
      ) : (
        <>
          <AttemptHistory
            attempts={attempts ?? []}
            maxScore={activity.maxScore}
            selectedId={reviewId}
            onSelect={(id) => { setReviewId(id); setResultNotice(null); }}
            notice={resultNotice}
          />
          <div style={{ marginTop: 18 }}>
            {state !== 'open' ? (
              <p style={{ color: 'var(--color-text-muted)' }}>{state === 'not-open' ? 'Esta tarea todavía no está abierta.' : 'El plazo de esta tarea ha terminado.'}</p>
            ) : resumable || attemptsRemaining === null || attemptsRemaining > 0 ? (
              <Button variant="primary" onClick={() => void beginOrResume()} loading={isStarting}>
                {resumable ? 'Reanudar intento' : latestAttempt ? 'Nuevo intento' : 'Empezar tarea'}
              </Button>
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>Has utilizado todos los intentos disponibles ({attemptsAllowedLabel(activity.attemptsAllowed)}).</p>
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="¿Enviar la tarea?"
        message={confirmMessage}
        confirmLabel="Sí, enviar"
        cancelLabel="Seguir editando"
        loading={isSubmitting}
        onConfirm={() => void submitAttempt()}
        onCancel={() => { if (!isSubmitting) setConfirmOpen(false); }}
      />
    </section>
  );
}

function AttemptForm({ activity, responses, onChange, onSave, onSubmit, saving, submitting, preview = false, previewGrade }: {
  activity: NonNullable<AttemptDTO['activity']>;
  responses: ResponseMap;
  onChange: (questionId: string, response: Record<string, unknown>) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  preview?: boolean;
  previewGrade?: PreviewGradeResponse | null;
}) {
  const questions = activity.questions ?? [];
  const results = new Map((previewGrade?.results ?? []).map((result) => [result.questionId, result]));
  const solutions = new Map((previewGrade?.solutions ?? []).map((solution) => [solution.questionId, solution.content]));
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ marginTop: 20, borderTop: '1px solid var(--color-border-primary)', paddingTop: 18 }}>
      {questions.length === 0 ? <p>No hay preguntas publicadas para esta tarea.</p> : questions.map((question, index) => (
        <QuestionInput
          key={question.id}
          question={question}
          number={index + 1}
          response={responses[question.id] ?? {}}
          onChange={(response) => onChange(question.id, response)}
          preview={preview}
          previewResult={results.get(question.id)}
          solution={solutions.get(question.id)}
        />
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        {preview ? (
          <Button type="submit" variant="primary" loading={submitting}>Comprobar respuestas</Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onSave} loading={saving}>Guardar borrador</Button>
            <Button type="submit" variant="primary" loading={submitting}>Enviar tarea</Button>
          </>
        )}
      </div>
    </form>
  );
}

function QuestionInput({ question, number, response, onChange, preview = false, previewResult, solution }: {
  question: QuestionDTO;
  number: number;
  response: Record<string, unknown>;
  onChange: (response: Record<string, unknown>) => void;
  preview?: boolean;
  previewResult?: PreviewGradeResult;
  solution?: Record<string, unknown>;
}) {
  const { user } = useAuth();
  const content = question.content;
  const fieldsetStyle = { border: '1px solid var(--color-border-primary)', borderRadius: 10, margin: '0 0 14px', padding: '14px 16px' };
  const labelStyle = { display: 'block', margin: '8px 0', cursor: 'pointer', lineHeight: 1.45 };
  const inputStyle = { width: '100%', maxWidth: 480, padding: '9px 10px', border: '1px solid var(--color-border-primary)', borderRadius: 7, background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', font: 'inherit' };
  const optionText = (value: unknown) => typeof value === 'string' ? value : value && typeof value === 'object' && 'text' in value && typeof value.text === 'string' ? value.text : String(value ?? '');

  return (
    <fieldset style={fieldsetStyle}>
      <legend style={{ fontWeight: 700, padding: '0 4px' }}>Pregunta {number} · {question.points} pts</legend>
      <p style={{ margin: '4px 0 5px', whiteSpace: 'pre-wrap' }}>{question.prompt}</p>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{KIND_LABELS[question.kind]}</span>
      {preview && isSubjective(question.kind, content) && (
        <div style={{ marginTop: 6 }}><Badge variant="warning">Se corrige a mano</Badge></div>
      )}
      {question.kind === 'MULTIPLE_CHOICE' && (
        <div role="group" aria-label={`Respuestas para pregunta ${number}`}>
          {(Array.isArray(content.options) ? content.options : []).map((option, index) => {
            const selected = Array.isArray(response.selected) && response.selected.includes(index);
            return <label key={index} style={labelStyle}><input type="checkbox" checked={selected} onChange={() => {
              const current = Array.isArray(response.selected) ? response.selected.filter((value): value is number => typeof value === 'number') : [];
              onChange({ selected: selected ? current.filter((value) => value !== index) : [...current, index] });
            }} /> {' '}{optionText(option)}</label>;
          })}
        </div>
      )}
      {question.kind === 'TRUE_FALSE' && (
        <div role="radiogroup" aria-label={`Respuesta para pregunta ${number}`}>
          {[true, false].map((value) => <label key={String(value)} style={labelStyle}><input type="radio" name={question.id} checked={response.value === value} onChange={() => onChange({ value })} /> {value ? 'Verdadero' : 'Falso'}</label>)}
        </div>
      )}
      {question.kind === 'FILL_BLANK' && (
        <div>{(Array.isArray(content.blanks) ? content.blanks : []).map((_, index) => {
          const values = Array.isArray(response.values) ? response.values.filter((value): value is string => typeof value === 'string') : [];
          return <label key={index} style={labelStyle}>Hueco {index + 1}<input aria-label={`Hueco ${index + 1} de pregunta ${number}`} style={inputStyle} value={values[index] ?? ''} onChange={(event) => { const next = [...values]; next[index] = event.target.value; onChange({ values: next }); }} /></label>;
        })}</div>
      )}
      {question.kind === 'MATCHING' && (
        <div>{(Array.isArray(content.left) ? content.left : []).map((left, index) => {
          const pairs = Array.isArray(response.pairs) ? response.pairs.filter((pair): pair is number[] => Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') : [];
          const selected = pairs.find((pair) => pair[0] === index)?.[1];
          return <label key={index} style={labelStyle}>{optionText(left)}<select aria-label={`Relacionar ${optionText(left)}`} style={inputStyle} value={selected ?? ''} onChange={(event) => { const right = Number(event.target.value); const next = pairs.filter((pair) => pair[0] !== index); if (Number.isInteger(right)) next.push([index, right]); onChange({ pairs: next }); }}><option value="">Selecciona una opción</option>{(Array.isArray(content.right) ? content.right : []).map((right, rightIndex) => <option key={rightIndex} value={rightIndex}>{optionText(right)}</option>)}</select></label>;
        })}</div>
      )}
      {question.kind === 'ORDERING' && (() => {
        const items = Array.isArray(content.items) ? content.items : [];
        const order = Array.isArray(response.order) && response.order.every((value) => typeof value === 'number') ? response.order as number[] : items.map((_, index) => index);
        const move = (from: number, delta: number) => { const to = from + delta; if (to < 0 || to >= order.length) return; const next = [...order]; [next[from], next[to]] = [next[to], next[from]]; onChange({ order: next }); };
        return <ol style={{ paddingLeft: 24 }}>{order.map((itemIndex, index) => <li key={itemIndex} style={{ margin: '8px 0' }}>{optionText(items[itemIndex])} <Button type="button" variant="ghost" size="sm" aria-label={`Subir elemento ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</Button><Button type="button" variant="ghost" size="sm" aria-label={`Bajar elemento ${index + 1}`} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</Button></li>)}</ol>;
      })()}
      {question.kind === 'SHORT_ANSWER' && <textarea aria-label={`Respuesta para pregunta ${number}`} style={{ ...inputStyle, minHeight: 88 }} value={typeof response.text === 'string' ? response.text : ''} onChange={(event) => onChange({ text: event.target.value })} />}
      {question.kind === 'ESSAY' && (
        <Textarea
          aria-label={`Respuesta para pregunta ${number}`}
          rows={6}
          value={typeof response.text === 'string' ? response.text : ''}
          onChange={(event) => onChange({ text: event.target.value })}
          hint={
            typeof content.minChars === 'number' || typeof content.maxChars === 'number'
              ? [
                  typeof content.minChars === 'number' ? `mín. ${content.minChars}` : null,
                  typeof content.maxChars === 'number' ? `máx. ${content.maxChars}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
        />
      )}
      {question.kind === 'FILE_UPLOAD' && user?.organizationId && (
        <FileUploadQuestion
          organizationId={user.organizationId}
          uploaderId={user.userId}
          maxFiles={typeof content.maxFiles === 'number' ? content.maxFiles : 1}
          accept={Array.isArray(content.accept) ? (content.accept as string[]).join(',') : undefined}
          existingCount={Array.isArray(response.fileIds) ? (response.fileIds as string[]).length : 0}
          onFileIds={(fileIds) => onChange({ fileIds })}
          disabled={preview}
        />
      )}
      {preview && previewResult && (
        <div aria-live="polite" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border-primary)' }}>
          <Badge variant={!previewResult.autoGradable ? 'warning' : previewResult.correct ? 'success' : 'error'}>
            {!previewResult.autoGradable ? 'Se corrige a mano' : previewResult.correct ? 'Correcta' : 'Incorrecta'}
          </Badge>
          {previewResult.autoGradable && (
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {previewResult.awarded ?? 0}/{previewResult.points} puntos
            </span>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5 }}>
            <strong>Solución:</strong> {formatSolution(question, solution ?? content)}
          </p>
        </div>
      )}
    </fieldset>
  );
}

function FileUploadQuestion({
  organizationId,
  uploaderId,
  maxFiles,
  accept,
  existingCount,
  onFileIds,
  disabled = false,
}: {
  organizationId: string;
  uploaderId: string;
  maxFiles: number;
  accept?: string;
  existingCount: number;
  onFileIds: (fileIds: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      {existingCount > 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '8px 0' }}>
          {existingCount} fichero(s) ya guardado(s). Sube de nuevo para reemplazarlos.
        </p>
      )}
      <FileUpload
        organizationId={organizationId}
        uploaderId={uploaderId}
        multiple={maxFiles > 1}
        maxFiles={maxFiles}
        accept={accept}
        disabled={disabled}
        onChange={(files: FileValue[]) => {
          const done = files.filter((f) => f.status === 'done').map((f) => f.id);
          if (done.length > 0) onFileIds(done);
        }}
        hint={disabled ? 'En una tarea real podrás subir los ficheros aquí.' : `Máximo ${maxFiles} fichero(s).`}
      />
    </div>
  );
}
