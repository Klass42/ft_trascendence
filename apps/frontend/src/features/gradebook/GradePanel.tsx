import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useGradeSubmission } from '@/lib/api';

export interface GradeTarget {
  submissionId: string;
  studentName: string;
  assignmentTitle: string;
  maxScore: number;
  initialScore: number | null;
}

interface GradePanelProps {
  target: GradeTarget;
  onClose: () => void;
  onGraded: () => void;
}

/**
 * Modal to grade a single submission: a score (0..maxScore) plus optional
 * feedback. Validates the score on the client before hitting the API (the
 * backend re-validates against the per-assignment maxScore).
 */
export function GradePanel({ target, onClose, onGraded }: GradePanelProps) {
  const { grade, isLoading } = useGradeSubmission();
  const [score, setScore] = useState(
    target.initialScore != null ? String(target.initialScore) : '',
  );
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > target.maxScore) {
      setError(`La nota debe estar entre 0 y ${target.maxScore}.`);
      return;
    }

    try {
      await grade(
        target.submissionId,
        { score: value, feedback: feedback.trim() || undefined },
        target.maxScore,
      );
      onGraded();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la nota.',
      );
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calificar entrega"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 14,
          padding: 22,
          width: 'min(440px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Calificar</div>
          <div
            style={{
              fontSize: 13.5,
              color: 'var(--color-text-muted)',
              marginTop: 3,
            }}
          >
            {target.studentName} · {target.assignmentTitle}
          </div>
        </div>

        <Input
          label={`Nota (0 – ${target.maxScore})`}
          type="number"
          min={0}
          max={target.maxScore}
          step="any"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          autoFocus
          required
        />

        <div>
          <label
            htmlFor="grade-feedback"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: 'var(--color-text-secondary)',
            }}
          >
            Feedback (opcional)
          </label>
          <textarea
            id="grade-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Comentarios para el alumno…"
            style={{
              width: '100%',
              resize: 'vertical',
              borderRadius: 10,
              border: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              padding: '10px 12px',
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={isLoading}>
            Guardar nota
          </Button>
        </div>
      </form>
    </div>
  );
}
