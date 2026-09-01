import { useState } from 'react';
import { Button, FileUpload, type FileValue } from '@/components/ui';
import { useAuth, useSubmitAssignment } from '@/lib/api';
import type { AssignmentDTO, SubmissionDTO } from '@/lib/api';
import { STATUS_CHIP, formatDate, openFile } from './helpers';

interface SubmissionFormProps {
  assignment: AssignmentDTO;
  submission: SubmissionDTO | null;
  onSubmitted: () => void;
}

/**
 * Student view of an assignment: current status + a form to submit text and
 * files. Files are uploaded through the shared FileUpload (to /files); on
 * submit we send the resulting file ids. Once GRADED the form is read-only.
 */
export function SubmissionForm({
  assignment,
  submission,
  onSubmitted,
}: SubmissionFormProps) {
  const { user } = useAuth();
  const { submit, isLoading } = useSubmitAssignment();

  const [text, setText] = useState(submission?.text ?? '');
  // New uploads picked in this session.
  const [fileValues, setFileValues] = useState<FileValue[]>([]);
  // Previously-attached files the student chooses to keep.
  const [keptFiles, setKeptFiles] = useState(submission?.files ?? []);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const isGraded = submission?.status === 'GRADED';
  const uploading = fileValues.some(
    (f) => f.status === 'uploading' || f.status === 'pending',
  );
  const newDoneIds = fileValues
    .filter((f) => f.status === 'done')
    .map((f) => f.id);
  const allFileIds = [...keptFiles.map((k) => k.fileId), ...newDoneIds];

  const chip = STATUS_CHIP[submission?.status ?? 'NONE'];

  async function handleSubmit(status: 'DRAFT' | 'SUBMITTED') {
    setFormError(null);
    setOkMessage(null);

    // Client-side validation (mandatory front+back).
    if (status === 'SUBMITTED' && !text.trim() && allFileIds.length === 0) {
      setFormError('Escribe algo o adjunta al menos un archivo para entregar.');
      return;
    }
    if (uploading) {
      setFormError('Espera a que terminen de subirse los archivos.');
      return;
    }

    try {
      await submit(assignment.id, {
        text: text.trim() || undefined,
        status,
        fileIds: allFileIds,
      });
      setFileValues([]);
      setOkMessage(
        status === 'DRAFT' ? 'Borrador guardado.' : '¡Entrega enviada!',
      );
      onSubmitted();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo guardar la entrega.',
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Estado:
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: chip.fg,
            background: chip.bg,
            padding: '4px 11px',
            borderRadius: 20,
          }}
        >
          {chip.label}
        </span>
        {submission?.status === 'GRADED' && submission.score != null && (
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f766e' }}>
            {submission.score} / {assignment.maxScore}
          </span>
        )}
      </div>

      {/* Teacher feedback (once graded) */}
      {isGraded && submission?.feedback && (
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 4,
            }}
          >
            Comentario del profesor
          </div>
          {submission.feedback}
        </div>
      )}

      {/* Kept / existing files */}
      {keptFiles.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: 'var(--color-text-secondary)',
            }}
          >
            Archivos adjuntos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {keptFiles.map((f) => (
              <div
                key={f.fileId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13.5,
                }}
              >
                <button
                  type="button"
                  onClick={() => openFile(f.fileId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-accent-primary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    textAlign: 'left',
                  }}
                >
                  {f.file.originalName}
                </button>
                {!isGraded && (
                  <button
                    type="button"
                    aria-label={`Quitar ${f.file.originalName}`}
                    onClick={() =>
                      setKeptFiles((prev) =>
                        prev.filter((k) => k.fileId !== f.fileId),
                      )
                    }
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editable form (hidden once graded) */}
      {!isGraded && (
        <>
          <div>
            <label
              htmlFor="submission-text"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--color-text-secondary)',
              }}
            >
              Tu respuesta
            </label>
            <textarea
              id="submission-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Escribe tu respuesta o comenta tu entrega…"
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

          {user?.organizationId && (
            <FileUpload
              organizationId={user.organizationId}
              uploaderId={user.userId}
              multiple
              maxFiles={5}
              value={fileValues}
              onChange={setFileValues}
              hint="Adjunta tu trabajo (máx. 5 archivos)."
            />
          )}

          {formError && (
            <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>
              {formError}
            </p>
          )}
          {okMessage && (
            <p style={{ color: '#0f766e', fontSize: 13, margin: 0 }}>
              {okMessage}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              loading={isLoading}
              disabled={uploading}
              onClick={() => handleSubmit('SUBMITTED')}
            >
              Entregar
            </Button>
            <Button
              variant="outline"
              loading={isLoading}
              disabled={uploading}
              onClick={() => handleSubmit('DRAFT')}
            >
              Guardar borrador
            </Button>
          </div>

          {assignment.dueAt && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0 }}>
              Fecha límite: {formatDate(assignment.dueAt)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
