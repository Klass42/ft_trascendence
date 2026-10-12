import { useState } from 'react';
import {
  Button,
  DatePicker,
  FileUpload,
  FormField,
  Input,
  Select,
  Textarea,
  Toggle,
  useToast,
  type FileValue,
} from '@/components/ui';
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
  const [status, setStatus] = useState<ActivityStatus>(initial?.status ?? 'DRAFT');
  const [openAt, setOpenAt] = useState(toDatetimeLocal(initial?.openAt));
  const [dueAt, setDueAt] = useState(toDatetimeLocal(initial?.dueAt));
  const [closeAt, setCloseAt] = useState(toDatetimeLocal(initial?.closeAt));
  const [countsTowardFinal, setCountsTowardFinal] = useState(
    initial?.countsTowardFinal ?? true,
  );
  const [fileValues, setFileValues] = useState<FileValue[]>([]);

  const uploading = fileValues.some(
    (f) => f.status === 'uploading' || f.status === 'pending',
  );

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast({ variant: 'error', message: 'El título es obligatorio.' });
      return;
    }
    const att = Number(attempts);
    if (!Number.isInteger(att) || att < 0) {
      toast({ variant: 'error', message: 'Los intentos deben ser un entero ≥ 0 (0 = ilimitados).' });
      return;
    }
    const o = toIso(openAt);
    const d = toIso(dueAt);
    const c = toIso(closeAt);
    if (o && d && o > d) return fail('La apertura no puede ser posterior a la entrega.');
    if (d && c && d > c) return fail('La entrega no puede ser posterior al cierre.');
    if (o && c && o > c) return fail('La apertura no puede ser posterior al cierre.');

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
      <FormField label="Título" required>
        {(field) => (
          <Input
            {...field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
