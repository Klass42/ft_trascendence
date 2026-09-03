import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Spinner, useToast } from '@/components/ui';
import { useActivity, useActivityAttempts } from '@/lib/api';
import type { AttemptDTO, QuestionDTO, SaveAnswersInput } from '@/lib/api';
import { formatDate, windowState, WINDOW_BADGE } from '../assignments/helpers';
import { KIND_LABELS } from './helpers';

type ResponseMap = Record<string, Record<string, unknown>>;

interface Props {
  activityId: string;
  onAttemptChanged?: () => void;
}

/**
 * Student-safe attempt player. Question content comes exclusively from the
 * student endpoints, which omit answer keys until the server permits reveal.
 */
export function ActivityPlayer({ activityId, onAttemptChanged }: Props) {
  const { toast } = useToast();
  const { data: activity, isLoading: activityLoading, error: activityError } = useActivity(activityId);
  const {
    attempts,
    isLoading: attemptsLoading,
    error: attemptsError,
    start,
    save,
    submit,
    refetch,
  } = useActivityAttempts(activityId);
  const [activeAttempt, setActiveAttempt] = useState<AttemptDTO | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const responsesRef = useRef<ResponseMap>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo iniciar la actividad.' });
    } finally {
      setIsStarting(false);
    }
  }

  function updateResponse(questionId: string, response: Record<string, unknown>) {
    setAllResponses({ ...responsesRef.current, [questionId]: response });
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
      toast({
        variant: 'success',
        message: completed.status === 'GRADED'
          ? `Actividad corregida: ${completed.score ?? 0}/${completed.activity?.maxScore ?? activity?.maxScore ?? 0}`
          : 'Actividad enviada. Está pendiente de corrección.',
      });
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo enviar la actividad.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (activityLoading || attemptsLoading) return <Spinner size="md" label="Cargando actividad…" />;
  if (!activity || activityError || attemptsError) {
    return <p style={{ color: 'var(--color-error)' }}>No se pudo cargar esta actividad. Puede que ya no esté disponible.</p>;
  }

  const winBadge = WINDOW_BADGE[state];
  const resumable = attempts?.find((attempt) => attempt.status === 'IN_PROGRESS');

  return (
    <section aria-label={`Actividad: ${activity.title}`}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{activity.title}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <Badge variant={winBadge.variant}>{winBadge.label}</Badge>
            <Badge variant="neutral">{activity.maxScore} pts</Badge>
            <Badge variant="neutral">{activity.attemptsAllowed === 0 ? 'Intentos ilimitados' : `${activity.attemptsAllowed} intento(s)`}</Badge>
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
          onSubmit={() => void submitAttempt()}
          saving={saveState === 'saving'}
          submitting={isSubmitting}
        />
      ) : (
        <>
          <AttemptHistory attempts={attempts ?? []} maxScore={activity.maxScore} />
          <div style={{ marginTop: 18 }}>
            {state !== 'open' ? (
              <p style={{ color: 'var(--color-text-muted)' }}>{state === 'not-open' ? 'Esta actividad todavía no está abierta.' : 'El plazo de esta actividad ha terminado.'}</p>
            ) : resumable || attemptsRemaining === null || attemptsRemaining > 0 ? (
              <Button variant="primary" onClick={() => void beginOrResume()} loading={isStarting}>
                {resumable ? 'Reanudar intento' : latestAttempt ? 'Nuevo intento' : 'Empezar actividad'}
              </Button>
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>Has utilizado todos los intentos disponibles.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function AttemptHistory({ attempts, maxScore }: { attempts: AttemptDTO[]; maxScore: number }) {
  const completed = attempts.filter((attempt) => attempt.status !== 'IN_PROGRESS');
  if (!completed.length) return null;
  return (
    <div style={{ marginTop: 18, borderTop: '1px solid var(--color-border-primary)', paddingTop: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Intentos anteriores</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {completed.map((attempt) => (
          <div key={attempt.id} style={{ fontSize: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>Intento {attempt.attemptNo} · {attempt.status === 'GRADED' ? 'Corregido' : 'Pendiente de corrección'}</span>
            <strong>{attempt.status === 'GRADED' ? `${attempt.score ?? 0}/${maxScore}` : 'Enviado'}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttemptForm({ activity, responses, onChange, onSave, onSubmit, saving, submitting }: {
  activity: NonNullable<AttemptDTO['activity']>;
  responses: ResponseMap;
  onChange: (questionId: string, response: Record<string, unknown>) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
}) {
  const questions = activity.questions ?? [];
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ marginTop: 20, borderTop: '1px solid var(--color-border-primary)', paddingTop: 18 }}>
      {questions.length === 0 ? <p>No hay preguntas publicadas para esta actividad.</p> : questions.map((question, index) => (
        <QuestionInput key={question.id} question={question} number={index + 1} response={responses[question.id] ?? {}} onChange={(response) => onChange(question.id, response)} />
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
        <Button type="button" variant="outline" onClick={onSave} loading={saving}>Guardar borrador</Button>
        <Button type="submit" variant="primary" loading={submitting}>Enviar actividad</Button>
      </div>
    </form>
  );
}

function QuestionInput({ question, number, response, onChange }: { question: QuestionDTO; number: number; response: Record<string, unknown>; onChange: (response: Record<string, unknown>) => void }) {
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
    </fieldset>
  );
}
