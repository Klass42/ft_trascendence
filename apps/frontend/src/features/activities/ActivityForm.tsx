import { useState } from 'react';
import {
  Button,
  DatePicker,
  FormField,
  Input,
  Select,
  Textarea,
  Toggle,
  useToast,
} from '@/components/ui';
import { FileUpload, type FileValue } from '@/components/ui/FileUpload';
import { useActivityMutations, useAuth } from '@/lib/api';
import type { ActivityDTO, ActivityStatus } from '@/lib/api';
import { toDatetimeLocal, toIso } from '../assignments/helpers';

/**
 * Create or edit a task's metadata (title, window, attempts, countsTowardFinal).
 * `maxScore` is derived from question points — not collected here. Questions
 * are managed separately. `type` is fixed to QUIZ.
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

type FieldErrors = Partial<Record<'title' | 'attempts' | 'timeLimit' | 'openAt' | 'dueAt' | 'closeAt', string>>;

export function ActivityForm({
  courseId,
  initial,
  inModal,
  onSaved,
  onCancel,
}: Props) {
  const editing = !!initial;
  const { user } = useAuth();
  const { toast } = useToast();
  const { createActivity, updateActivity, isLoading } = useActivityMutations();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [attempts, setAttempts] = useState(String(initial?.attemptsAllowed ?? 1));
  const [timeLimit, setTimeLimit] = useState(
    initial?.timeLimitSec ? String(Math.ceil(initial.timeLimitSec / 60)) : '',
  );
  const [status, setStatus] = useState<ActivityStatus>(initial?.status ?? 'DRAFT');
  const [openAt, setOpenAt] = useState(toDatetimeLocal(initial?.openAt));
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt));
  const [closeAt, setCloseAt] = useState(toDatetimeLocal(initial?.closeAt));
  const [countsTowardFinal, setCountsTowardFinal] = useState(
    initial?.countsTowardFinal ?? true,
  );
  const [fileValues, setFileValues] = useState<FileValue[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Update a field and drop its stale error (the others stay until re-validated). */
  function clearError(...fields: Array<keyof FieldErrors>) {
    setErrors((prev) => {
      if (!fields.some((field) => prev[field])) return prev;
      const next = { ...prev };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  const uploading = fileValues.some(
    (f) => f.status === 'uploading' || f.status === 'pending',
  );

  async function handleSave() {
    const trimmed = title.trim();
    const att = Number(attempts);
    const o = toIso(openAt);
    const d = toIso(dueAt);
    const c = toIso(closeAt);
    const found: FieldErrors = {};
    if (!trimmed) found.title = 'El título es obligatorio.';
    if (attempts.trim() === '' || !Number.isInteger(att) || att < 0) {
      found.attempts = 'Debe ser un entero ≥ 0 (0 = ilimitados).';
    }
    const minutes = Number(timeLimit);
    if (timeLimit.trim() !== '' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
      found.timeLimit = 'Debe ser un entero entre 1 y 1440 minutos.';
    }
    if (o && d && o > d) found.dueAt = 'La entrega no puede ser anterior a la apertura.';
    if (d && c && d > c) found.closeAt = 'El cierre no puede ser anterior a la entrega.';
    else if (o && c && o > c) found.closeAt = 'El cierre no puede ser anterior a la apertura.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const uploadedIds = fileValues
      .filter((f) => f.status === 'done')
      .map((f) => f.id);
    const keptIds = (initial?.files ?? []).map((f) => f.fileId);
    const fileIds = editing ? [...keptIds, ...uploadedIds] : uploadedIds;

    try {
      const payload = {
        title: trimmed,
        description: description.trim() || undefined,
        attemptsAllowed: att,
        // Empty clears the limit when editing; omitted on create.
        timeLimitSec: timeLimit.trim() === '' ? (editing ? null : undefined) : minutes * 60,
        status,
        openAt: o,
        dueAt: d,
        closeAt: c,
        countsTowardFinal,
        ...(fileIds.length > 0 || editing ? { fileIds } : {}),
      };
      const saved = editing
        ? await updateActivity(initial.id, payload)
        : await createActivity(courseId, { type: 'QUIZ', ...payload });
      toast({ variant: 'success', message: editing ? 'Tarea guardada.' : 'Tarea creada.' });
      onSaved(saved);
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo guardar la tarea.',
      });
    }
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
      <FormField label="Título" required error={errors.title}>
        {(field) => (
          <Input
            {...field}
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError('title');
            }}
            placeholder="Ej. Examen mixto · unidad 3"
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

      <div style={{ flex: '1 1 120px', maxWidth: 220 }}>
        <FormField label="Intentos" hint="0 = ilimitados" error={errors.attempts}>
          {(field) => (
            <Input
              {...field}
              type="number"
              min={0}
              value={attempts}
              onChange={(e) => {
                setAttempts(e.target.value);
                clearError('attempts');
              }}
            />
          )}
        </FormField>
      </div>

      <div style={{ flex: '1 1 120px', maxWidth: 220 }}>
        <FormField
          label="Tiempo límite (minutos)"
          hint="Vacío = sin límite. El servidor cierra el intento al agotarse."
          error={errors.timeLimit}
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              min={1}
              max={1440}
              value={timeLimit}
              onChange={(e) => {
                setTimeLimit(e.target.value);
                clearError('timeLimit');
              }}
            />
          )}
        </FormField>
      </div>

      <FormField
        label="Cuenta para la nota final"
        hint="Si lo desactivas, el alumno ve su nota pero no entra en el promedio."
      >
        {(field) => (
          <Toggle
            id={field.id}
            checked={countsTowardFinal}
            onChange={setCountsTowardFinal}
            aria-label="Cuenta para la nota final"
          />
        )}
      </FormField>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <DatePicker
            label="Apertura"
            mode="datetime"
            value={openAt}
            onChange={(e) => {
              setOpenAt(e.target.value);
              clearError('dueAt', 'closeAt');
            }}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <DatePicker
            label="Entrega"
            mode="datetime"
            value={dueAt}
            error={errors.dueAt}
            onChange={(e) => {
              setDueAt(e.target.value);
              clearError('dueAt', 'closeAt');
            }}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <DatePicker
            label="Cierre"
            mode="datetime"
            value={closeAt}
            error={errors.closeAt}
            onChange={(e) => {
              setCloseAt(e.target.value);
              clearError('dueAt', 'closeAt');
            }}
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

      {user?.organizationId && (
        <FileUpload
          organizationId={user.organizationId}
          uploaderId={user.userId}
          multiple
          maxFiles={5}
          value={fileValues}
          onChange={setFileValues}
          hint="Adjunta recursos del enunciado (máx. 5 archivos)."
        />
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isLoading || uploading}
        >
          {editing ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
