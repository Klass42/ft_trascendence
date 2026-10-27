import { useEffect, useState } from 'react';
import { Badge, Button, Modal } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { ActivityDTO, PreviewGradeResponse, SaveAnswersInput } from '@/lib/api';
import { ActivityPlayer } from './ActivityPlayer';
import styles from './ActivityPreviewModal.module.css';

interface Props {
  activity: ActivityDTO | null;
  gradeUrl: string | null;
  onClose: () => void;
}

/** Student player in a local, stateless preview frame for staff. */
export function ActivityPreviewModal({ activity, gradeUrl, onClose }: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [grade, setGrade] = useState<PreviewGradeResponse | null>(null);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDevice('desktop');
    setGrade(null);
    setResponses({});
    setIsChecking(false);
    setError(null);
  }, [activity?.id]);

  async function check(answers: SaveAnswersInput['answers']) {
    if (!gradeUrl) return;
    setIsChecking(true);
    setError(null);
    try {
      const result = await apiClient.post<PreviewGradeResponse>(gradeUrl, { answers });
      setGrade(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron comprobar las respuestas.');
    } finally {
      setIsChecking(false);
    }
  }

  function reset() {
    setResponses({});
    clearGrade();
  }

  function clearGrade() {
    setGrade(null);
    setError(null);
  }

  return (
    <Modal
      open={!!activity}
      onClose={onClose}
      title={activity ? `Vista previa: ${activity.title}` : undefined}
      size="lg"
    >
      {activity && (
        <div className={styles.content}>
          <div className={styles.banner} role="note">
            <Badge variant="info">Vista previa</Badge>
            <p>Así lo verá el alumnado. Nada de lo que respondas se guarda.</p>
          </div>

          <div className={styles.toolbar} aria-label="Controles de vista previa">
            <div className={styles.deviceControls} role="group" aria-label="Tamaño de pantalla">
              <Button
                type="button"
                size="sm"
                variant={device === 'desktop' ? 'secondary' : 'ghost'}
                aria-pressed={device === 'desktop'}
                onClick={() => setDevice('desktop')}
              >
                Escritorio
              </Button>
              <Button
                type="button"
                size="sm"
                variant={device === 'mobile' ? 'secondary' : 'ghost'}
                aria-pressed={device === 'mobile'}
                onClick={() => setDevice('mobile')}
              >
                Móvil
              </Button>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              Reiniciar
            </Button>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={`${styles.viewport} ${device === 'mobile' ? styles.mobile : ''}`}>
            <div className={styles.playerFrame}>
              <ActivityPlayer
                mode="preview"
                previewActivity={activity}
                previewGrade={grade}
                previewResponses={responses}
                previewBusy={isChecking}
                onPreviewGrade={check}
                onPreviewResultClear={clearGrade}
                onPreviewResponsesChange={setResponses}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
