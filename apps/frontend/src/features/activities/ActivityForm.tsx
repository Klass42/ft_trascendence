import { useState } from 'react';
import {
  Button,
  DatePicker,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { useActivityMutations } from '@/lib/api';
import type { ActivityDTO, ActivityStatus } from '@/lib/api';
import { toDatetimeLocal, toIso } from '../assignments/helpers';

/**
 * Create or edit an activity's metadata (title, description, scoring, attempt
 * policy, submission window, publish status). Questions are managed separately
 * in the detail view. `type` is fixed to QUIZ for now — LISTENING/SPEAKING media
 * activities arrive in B4.
 */
interface Props {
  courseId: string;
  initial?: ActivityDTO;
  inModal?: boolean;
  onSaved: (activity: ActivityDTO) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador (oculta a alumnos)' },
  { value: 'PUBLISHED', label: 'Publicada (visible y realizable)' },
  { value: 'ARCHIVED', label: 'Archivada' },
];

export function ActivityForm({ courseId, initial, inModal, onSaved, onCancel }: Props) {
  const editing = !!initial;
  const { toast } = useToast();
  const { createActivity, updateActivity, isLoading } = useActivityMutations();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [maxScore, setMaxScore] = useState(String(initial?.maxScore ?? 100));
  const [attempts, setAttempts] = useState(String(initial?.attemptsAllowed ?? 1));
  const [status, setStatus] = useState<ActivityStatus>(initial?.status ?? 'DRAFT');
  const [openAt, setOpenAt] = useState(toDatetimeLocal(initial?.openAt));
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt));
  const [closeAt, setCloseAt] = useState(toDatetimeLocal(initial?.closeAt));

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast({ variant: 'error', message: 'El título es obligatorio.' });
      return;
    }
    const score = Number(maxScore);
    if (!Number.isFinite(score) || score < 1) {
      toast({ variant: 'error', message: 'La puntuación máxima debe ser ≥ 1.' });
      return;
    }
    const att = Number(attempts);
    if (!Number.isInteger(att) || att < 0) {
      toast({ variant: 'error', message: 'Los intentos deben ser un entero ≥ 0 (0 = ilimitados).' });
      return;
    }
    // Window ordering (backend re-checks): openAt ≤ dueAt ≤ closeAt.
    const o = toIso(openAt);
    const d = toIso(dueAt);
    const c = toIso(closeAt);
    if (o && d && o > d) return fail('La apertura no puede ser posterior a la entrega.');
    if (d && c && d > c) return fail('La entrega no puede ser posterior al cierre.');
    if (o && c && o > c) return fail('La apertura no puede ser posterior al cierre.');

    try {
      const payload = {
        title: trimmed,
        description: description.trim() || undefined,
        maxScore: score,
        attemptsAllowed: att,
        status,
        openAt: o,
        dueAt: d,
        closeAt: c,
      };
      const saved = editing
        ? await updateActivity(initial.id, payload)
        : await createActivity(courseId, { type: 'QUIZ', ...payload });
      toast({ variant: 'success', message: editing ? 'Actividad guardada.' : 'Actividad creada.' });
      onSaved(saved);
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo guardar la actividad.',
      });
    }
  }

  function fail(message: string) {
    toast({ variant: 'error', message });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...(inModal
          ? {}
          : {
              border: '1px solid var(--color-border-primary)',
              borderRadius: 12,
              padding: 18,
              background: 'var(--color-bg-secondary)',
            }),
      }}
    >
      <FormField label="Título">
        {(field) => (
          <Input
            {...field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Vocabulario: la casa"
          />
        )}
      </FormField>

      <FormField label="Descripción">
        {(field) => (
          <Textarea
            {...field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instrucciones o contexto (opcional)"
            rows={2}
          />
        )}
      </FormField>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 120px' }}>
          <FormField label="Puntuación máxima">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={1}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <FormField label="Intentos" hint="0 = ilimitados">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={0}
                value={attempts}
                onChange={(e) => setAttempts(e.target.value)}
              />
            )}
          </FormField>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <DatePicker
            label="Apertura"
            mode="datetime"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <DatePicker
            label="Entrega"
            mode="datetime"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <DatePicker
            label="Cierre"
            mode="datetime"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
          />
        </div>
      </div>

      <FormField label="Estado">
        {(field) => (
          <Select
            {...field}
            value={status}
            onChange={(e) => setStatus(e.target.value as ActivityStatus)}
            options={STATUS_OPTIONS}
          />
        )}
      </FormField>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={handleSave} disabled={isLoading}>
          {editing ? 'Guardar cambios' : 'Crear actividad'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
