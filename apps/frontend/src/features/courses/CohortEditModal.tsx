import { useEffect, useState } from 'react';
import type { CourseDTO, UpdateCourseInput } from '@/lib/api';
import { Button, DatePicker, Input, Modal } from '@/components/ui';
import styles from './CohortEditModal.module.css';

interface CohortEditModalProps {
  course: CourseDTO | null;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateCourseInput) => Promise<void>;
}

export function CohortEditModal({ course, open, onClose, onSave }: CohortEditModalProps) {
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !course) return;
    setName(course.name);
    setAcademicYear(course.academicYear);
    setStartsOn(course.startsOn.slice(0, 10));
    setEndsOn(course.endsOn.slice(0, 10));
    setErrors({});
  }, [course, open]);

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'El nombre es obligatorio.';
    if (name.trim().length > 120) nextErrors.name = 'Usa 120 caracteres como máximo.';
    if (!/^\d{4}-\d{4}$/.test(academicYear.trim())) {
      nextErrors.academicYear = 'Usa el formato 2025-2026.';
    }
    if (!startsOn) nextErrors.startsOn = 'La fecha de inicio es obligatoria.';
    if (!endsOn) nextErrors.endsOn = 'La fecha de fin es obligatoria.';
    if (startsOn && endsOn && endsOn <= startsOn) {
      nextErrors.endsOn = 'Debe ser posterior al inicio.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !course) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        academicYear: academicYear.trim(),
        startsOn,
        endsOn,
      });
    } catch {
      // The caller reports the API error and keeps the modal open for correction.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar cohorte"
      closeOnBackdrop={!saving}
      footer={(
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button loading={saving} onClick={handleSave}>Guardar cambios</Button>
        </div>
      )}
    >
      <div className={styles.fields}>
        <Input
          label="Nombre"
          value={name}
          maxLength={120}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Input
          label="Año académico"
          value={academicYear}
          maxLength={9}
          placeholder="2025-2026"
          error={errors.academicYear}
          onChange={(event) => setAcademicYear(event.target.value)}
          required
        />
        <div className={styles.dateFields}>
          <DatePicker
            label="Empieza"
            value={startsOn}
            error={errors.startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            required
          />
          <DatePicker
            label="Termina"
            value={endsOn}
            error={errors.endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            required
          />
        </div>
      </div>
    </Modal>
  );
}
