import { useState } from 'react';
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { useActivityMutations } from '@/lib/api';
import type { QuestionDTO, QuestionKind } from '@/lib/api';
import { QuestionContentEditor } from './QuestionContentEditor';
import { emptyContent, KIND_LABELS, KIND_ORDER } from './helpers';

/**
 * Create or edit a single question. The kind is fixed once created (changing it
 * would invalidate the stored content); on create, switching the kind resets the
 * content to that kind's empty template. Validates the content shape front-side
 * (the backend re-validates) before saving.
 */
interface Props {
  activityId: string;
  initial?: QuestionDTO;
  onSaved: () => void;
  onCancel: () => void;
}

export function QuestionForm({ activityId, initial, onSaved, onCancel }: Props) {
  const editing = !!initial;
  const { toast } = useToast();
  const { createQuestion, updateQuestion, isLoading } = useActivityMutations();

  const [kind, setKind] = useState<QuestionKind>(initial?.kind ?? 'MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [points, setPoints] = useState(String(initial?.points ?? 1));
  const [content, setContent] = useState<Record<string, unknown>>(
    initial?.content ?? emptyContent('MULTIPLE_CHOICE'),
  );

  function changeKind(next: QuestionKind) {
    setKind(next);
    setContent(emptyContent(next)); // start fresh so content matches the kind
  }

  async function handleSave() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast({ variant: 'error', message: 'El enunciado es obligatorio.' });
      return;
    }
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts < 0) {
      toast({ variant: 'error', message: 'Los puntos deben ser un número ≥ 0.' });
      return;
    }
    const contentError = validateContent(kind, content);
    if (contentError) {
      toast({ variant: 'error', message: contentError });
      return;
    }

    try {
      if (editing) {
        await updateQuestion(initial.id, { prompt: trimmedPrompt, points: pts, content });
      } else {
        await createQuestion(activityId, {
          kind,
          prompt: trimmedPrompt,
          points: pts,
          content,
        });
      }
      toast({ variant: 'success', message: editing ? 'Pregunta guardada.' : 'Pregunta añadida.' });
      onSaved();
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo guardar la pregunta.',
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!editing && (
        <FormField label="Tipo de pregunta">
          {(field) => (
            <Select
              {...field}
              value={kind}
              onChange={(e) => changeKind(e.target.value as QuestionKind)}
              options={KIND_ORDER.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            />
          )}
        </FormField>
      )}

      <FormField label="Enunciado">
        {(field) => (
          <Textarea
            {...field}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe la pregunta…"
            rows={2}
          />
        )}
      </FormField>

      <QuestionContentEditor kind={kind} content={content} onChange={setContent} />

      <div style={{ maxWidth: 140 }}>
        <FormField label="Puntos">
          {(field) => (
            <Input
              {...field}
              type="number"
              min={0}
              step="0.5"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          )}
        </FormField>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={handleSave} disabled={isLoading}>
          {editing ? 'Guardar pregunta' : 'Añadir pregunta'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Front-side content validation mirroring the backend's per-kind rules, so a
 * teacher gets an inline message instead of a 400. */
function validateContent(
  kind: QuestionKind,
  content: Record<string, unknown>,
): string | null {
  const strArr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
  switch (kind) {
    case 'MULTIPLE_CHOICE': {
      const options = strArr(content.options).map((o) => String(o).trim());
      if (options.length < 2 || options.some((o) => !o)) {
        return 'Añade al menos 2 opciones y sin texto vacío.';
      }
      if (strArr(content.correct).length < 1) {
        return 'Marca al menos una opción correcta.';
      }
      return null;
    }
    case 'TRUE_FALSE':
      return typeof content.answer === 'boolean' ? null : 'Elige Verdadero o Falso.';
    case 'FILL_BLANK': {
      const blanks = strArr(content.blanks) as { accepted?: unknown }[];
      if (blanks.length < 1) return 'Añade al menos un hueco.';
      if (blanks.some((b) => strArr(b.accepted).length < 1)) {
        return 'Cada hueco necesita al menos una respuesta aceptada.';
      }
      return null;
    }
    case 'MATCHING': {
      const left = strArr(content.left).map((s) => String(s).trim());
      const right = strArr(content.right).map((s) => String(s).trim());
      if (left.length < 1) return 'Añade al menos una pareja.';
      if (left.some((s) => !s) || right.some((s) => !s)) {
        return 'Completa ambos lados de cada pareja.';
      }
      return null;
    }
    case 'ORDERING': {
      const items = strArr(content.items).map((s) => String(s).trim());
      if (items.length < 2) return 'Añade al menos 2 elementos.';
      if (items.some((s) => !s)) return 'Ningún elemento puede estar vacío.';
      return null;
    }
    case 'SHORT_ANSWER':
      return null; // accepted[] optional (empty = manual grading)
    case 'ESSAY': {
      const min =
        content.minChars === undefined ? undefined : Number(content.minChars);
      const max =
        content.maxChars === undefined ? undefined : Number(content.maxChars);
      if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
        return 'El mínimo de caracteres debe ser un entero ≥ 0.';
      }
      if (max !== undefined && (!Number.isInteger(max) || max < 0)) {
        return 'El máximo de caracteres debe ser un entero ≥ 0.';
      }
      if (min !== undefined && max !== undefined && min > max) {
        return 'El mínimo no puede superar el máximo de caracteres.';
      }
      return null;
    }
    case 'FILE_UPLOAD': {
      const maxFiles = Number(content.maxFiles);
      if (!Number.isInteger(maxFiles) || maxFiles < 1) {
        return 'Indica un número máximo de ficheros ≥ 1.';
      }
      if (
        content.accept !== undefined &&
        (!Array.isArray(content.accept) ||
          content.accept.some((x) => typeof x !== 'string'))
      ) {
        return 'Los tipos aceptados deben ser una lista de textos.';
      }
      return null;
    }
    default:
      return null;
  }
}
