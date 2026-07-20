import { Button, Input } from '@/components/ui';
import type { QuestionKind } from '@/lib/api';

/** Accessible label + hint wrapper for a GROUP of controls (option lists, radio
 * groups). Unlike the design-system FormField (single control, render-prop),
 * this is a fieldset/legend so grouped inputs are announced together. */
function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 6px', minWidth: 0 }}>
      <legend style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6, padding: 0 }}>
        {label}
      </legend>
      {children}
      {hint && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
          {hint}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Per-kind editor for a question's `content`. Fully controlled: the parent owns
 * `content` (validated by-construction via helpers/emptyContent) and receives a
 * new object on every edit. Matching/ordering are simplified for authoring —
 * you enter matching pairs row by row and the correct order top-to-bottom; the
 * player shuffles them for the student.
 */
interface Props {
  kind: QuestionKind;
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
};

export function QuestionContentEditor({ kind, content, onChange }: Props) {
  switch (kind) {
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceEditor content={content} onChange={onChange} />;
    case 'TRUE_FALSE':
      return <TrueFalseEditor content={content} onChange={onChange} />;
    case 'FILL_BLANK':
      return <FillBlankEditor content={content} onChange={onChange} />;
    case 'SHORT_ANSWER':
      return <ShortAnswerEditor content={content} onChange={onChange} />;
    case 'MATCHING':
      return <MatchingEditor content={content} onChange={onChange} />;
    case 'ORDERING':
      return <OrderingEditor content={content} onChange={onChange} />;
    default:
      return null;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const asNumArr = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : []);

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

// ─── MULTIPLE_CHOICE ──────────────────────────────────────────────────────────
function MultipleChoiceEditor({ content, onChange }: Omit<Props, 'kind'>) {
  const options = asStrArr(content.options);
  const correct = asNumArr(content.correct);

  const setOption = (i: number, value: string) => {
    const next = [...options];
    next[i] = value;
    onChange({ ...content, options: next });
  };
  const toggleCorrect = (i: number) => {
    const next = correct.includes(i)
      ? correct.filter((c) => c !== i)
      : [...correct, i].sort((a, b) => a - b);
    onChange({ ...content, correct: next });
  };
  const addOption = () =>
    onChange({ ...content, options: [...options, ''] });
  const removeOption = (i: number) => {
    const nextOptions = options.filter((_, idx) => idx !== i);
    // Drop / shift the correct indices to track the removed option.
    const nextCorrect = correct
      .filter((c) => c !== i)
      .map((c) => (c > i ? c - 1 : c));
    onChange({ ...content, options: nextOptions, correct: nextCorrect });
  };

  return (
    <FieldGroup
      label="Opciones"
      hint="Marca la casilla de las respuestas correctas (una o varias)."
    >
      <div>
        {options.map((opt, i) => (
          <div key={i} style={rowStyle}>
            <input
              type="checkbox"
              checked={correct.includes(i)}
              onChange={() => toggleCorrect(i)}
              aria-label={`Opción ${i + 1} es correcta`}
              style={{ width: 18, height: 18, flexShrink: 0 }}
            />
            <Input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Opción ${i + 1}`}
              aria-label={`Texto de la opción ${i + 1}`}
            />
            <IconButton
              label={`Eliminar opción ${i + 1}`}
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
            >
              ✕
            </IconButton>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          + Añadir opción
        </Button>
      </div>
    </FieldGroup>
  );
}

// ─── TRUE_FALSE ───────────────────────────────────────────────────────────────
function TrueFalseEditor({ content, onChange }: Omit<Props, 'kind'>) {
  const answer = content.answer === true;
  return (
    <FieldGroup label="Respuesta correcta">
      <div style={{ display: 'flex', gap: 18 }}>
        {[true, false].map((val) => (
          <label
            key={String(val)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <input
              type="radio"
              name="tf-answer"
              checked={answer === val}
              onChange={() => onChange({ ...content, answer: val })}
            />
            {val ? 'Verdadero' : 'Falso'}
          </label>
        ))}
      </div>
    </FieldGroup>
  );
}

// ─── FILL_BLANK ───────────────────────────────────────────────────────────────
function FillBlankEditor({ content, onChange }: Omit<Props, 'kind'>) {
  const blanks = Array.isArray(content.blanks)
    ? (content.blanks as { accepted: string[] }[])
    : [];

  const setBlank = (i: number, value: string) => {
    const next = [...blanks];
    next[i] = {
      accepted: value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onChange({ ...content, blanks: next });
  };
  const addBlank = () =>
    onChange({ ...content, blanks: [...blanks, { accepted: [] }] });
  const removeBlank = (i: number) =>
    onChange({ ...content, blanks: blanks.filter((_, idx) => idx !== i) });

  return (
    <FieldGroup
      label="Huecos"
      hint="Escribe «___» en el enunciado por cada hueco. Para cada uno, las respuestas aceptadas separadas por comas (sinónimos)."
    >
      <div>
        {blanks.map((b, i) => (
          <div key={i} style={rowStyle}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', width: 62 }}>
              Hueco {i + 1}
            </span>
            <Input
              value={(b.accepted ?? []).join(', ')}
              onChange={(e) => setBlank(i, e.target.value)}
              placeholder="perro, can"
              aria-label={`Respuestas aceptadas del hueco ${i + 1}`}
            />
            <IconButton
              label={`Eliminar hueco ${i + 1}`}
              onClick={() => removeBlank(i)}
              disabled={blanks.length <= 1}
            >
              ✕
            </IconButton>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addBlank}>
          + Añadir hueco
        </Button>
      </div>
    </FieldGroup>
  );
}

// ─── SHORT_ANSWER ─────────────────────────────────────────────────────────────
function ShortAnswerEditor({ content, onChange }: Omit<Props, 'kind'>) {
  const accepted = asStrArr(content.accepted);
  return (
    <FieldGroup
      label="Respuestas aceptadas"
      hint="Separadas por comas (sinónimos). Déjalo vacío para corregir a mano."
    >
      <Input
        value={accepted.join(', ')}
        onChange={(e) =>
          onChange({
            ...content,
            accepted: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="Madrid"
        aria-label="Respuestas aceptadas"
      />
    </FieldGroup>
  );
}

// ─── MATCHING (identity pairing per row) ──────────────────────────────────────
function MatchingEditor({ content, onChange }: Omit<Props, 'kind'>) {
  const left = asStrArr(content.left);
  const right = asStrArr(content.right);

  // Rebuild with identity pairs so left[i] ↔ right[i] is always the answer.
  const commit = (nextLeft: string[], nextRight: string[]) =>
    onChange({
      left: nextLeft,
      right: nextRight,
      pairs: nextLeft.map((_, i) => [i, i]),
    });

  const setLeft = (i: number, v: string) => {
    const next = [...left];
    next[i] = v;
    commit(next, right);
  };
  const setRight = (i: number, v: string) => {
    const next = [...right];
    next[i] = v;
    commit(left, next);
  };
  const addRow = () => commit([...left, ''], [...right, '']);
  const removeRow = (i: number) =>
    commit(
      left.filter((_, idx) => idx !== i),
      right.filter((_, idx) => idx !== i),
    );

  return (
    <FieldGroup
      label="Parejas"
      hint="Cada fila es una pareja correcta. El alumno verá la columna derecha desordenada."
    >
      <div>
        {left.map((l, i) => (
          <div key={i} style={rowStyle}>
            <Input
              value={l}
              onChange={(e) => setLeft(i, e.target.value)}
              placeholder="Izquierda"
              aria-label={`Término izquierdo ${i + 1}`}
            />
            <span aria-hidden style={{ color: 'var(--color-text-muted)' }}>↔</span>
            <Input
              value={right[i] ?? ''}
              onChange={(e) => setRight(i, e.target.value)}
              placeholder="Derecha"
              aria-label={`Término derecho ${i + 1}`}
            />
            <IconButton
              label={`Eliminar pareja ${i + 1}`}
              onClick={() => removeRow(i)}
              disabled={left.length <= 1}
            >
              ✕
            </IconButton>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Añadir pareja
        </Button>
      </div>
    </FieldGroup>
  );
}

// ─── ORDERING (correct order = top-to-bottom) ─────────────────────────────────
function OrderingEditor({ content, onChange }: Omit<Props, 'kind'>) {
  const items = asStrArr(content.items);

  const commit = (next: string[]) =>
    onChange({ items: next, correctOrder: next.map((_, i) => i) });

  const setItem = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    commit(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  const addItem = () => commit([...items, '']);
  const removeItem = (i: number) => commit(items.filter((_, idx) => idx !== i));

  return (
    <FieldGroup
      label="Elementos (en el orden correcto)"
      hint="Ordénalos de arriba a abajo como es correcto. El alumno los verá desordenados."
    >
      <div>
        {items.map((it, i) => (
          <div key={i} style={rowStyle}>
            <span style={{ width: 20, color: 'var(--color-text-muted)' }}>{i + 1}.</span>
            <Input
              value={it}
              onChange={(e) => setItem(i, e.target.value)}
              placeholder={`Elemento ${i + 1}`}
              aria-label={`Elemento ${i + 1}`}
            />
            <IconButton label={`Subir elemento ${i + 1}`} onClick={() => move(i, -1)} disabled={i === 0}>
              ↑
            </IconButton>
            <IconButton
              label={`Bajar elemento ${i + 1}`}
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
            >
              ↓
            </IconButton>
            <IconButton
              label={`Eliminar elemento ${i + 1}`}
              onClick={() => removeItem(i)}
              disabled={items.length <= 2}
            >
              ✕
            </IconButton>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Añadir elemento
        </Button>
      </div>
    </FieldGroup>
  );
}
