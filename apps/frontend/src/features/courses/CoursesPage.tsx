import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useCourses, useCreateCourse } from '@/lib/api';
import type { CourseDTO, CohortStatus } from '@/lib/api';
import { Button, Modal, FormField, useToast } from '@/components/ui';

const COURSE_COLORS = [
  '#2563eb', '#0f766e', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#4f46e5', '#db2777',
];

function hashToColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

function statusLabel(status: CohortStatus): string {
  if (status === 'ACTIVE') return 'En curso';
  if (status === 'ARCHIVED') return 'Archivado';
  return 'Planificado';
}

function CourseGrid({ courses, onOpen }: { courses: CourseDTO[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
      {courses.map((course) => {
        const color = hashToColor(course.name + course.academicYear);
        return (
          <div
            key={course.id}
            onClick={() => onOpen(course.id)}
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 15,
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            <div style={{ height: 70, background: color, display: 'flex', alignItems: 'flex-end', padding: '12px 16px' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)',
                background: 'rgba(0,0,0,.15)', padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase',
              }}>
                {statusLabel(course.status)}
              </span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{course.name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>{course.academicYear}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CoursesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';
  const { data: courses, isLoading, error } = useCourses();
  const { create, isLoading: creating } = useCreateCourse();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [startsOn, setStartsOn] = useState('2026-09-01');
  const [endsOn, setEndsOn] = useState('2027-06-30');
  const [status, setStatus] = useState<CohortStatus>('ACTIVE');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const current = useMemo(() => (courses ?? []).filter((course) => course.status === 'ACTIVE'), [courses]);
  const previous = useMemo(() => (courses ?? []).filter((course) => course.status !== 'ACTIVE'), [courses]);

  const resetForm = () => {
    setName('');
    setAcademicYear('2025-2026');
    setStartsOn('2026-09-01');
    setEndsOn('2027-06-30');
    setStatus('ACTIVE');
    setFieldErrors({});
  };

  const handleCreate = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'El nombre es obligatorio';
    if (!/^\d{4}-\d{4}$/.test(academicYear.trim())) errors.academicYear = 'Usa el formato 2025-2026';
    if (!startsOn) errors.startsOn = 'La fecha de inicio es obligatoria';
    if (!endsOn) errors.endsOn = 'La fecha de fin es obligatoria';
    if (startsOn && endsOn && endsOn <= startsOn) errors.endsOn = 'Debe ser posterior al inicio';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      const course = await create({
        name: name.trim(),
        academicYear: academicYear.trim(),
        startsOn,
        endsOn,
        status,
      });
      setModalOpen(false);
      resetForm();
      toast({ message: 'Curso creado correctamente', variant: 'success' });
      navigate(`/courses/${course.id}`);
    } catch {
      toast({ message: 'Error al crear el curso', variant: 'error' });
    }
  };

  if (isLoading) {
    return <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>Cargando cursos...</div>;
  }
  if (error) {
    return <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>Error al cargar cursos: {error.message}</div>;
  }

  const open = (id: string) => navigate(`/courses/${id}`);
  const createButton = isAdmin ? (
    <Button variant="primary" onClick={() => setModalOpen(true)}>+ Crear curso</Button>
  ) : null;

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Mis cursos</h1>
        {createButton}
      </div>

      {!courses || courses.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>No hay cursos disponibles</p>
      ) : isStudent ? (
        <>
          <h2 style={{ fontSize: 18, margin: '8px 0 12px' }}>Curso actual</h2>
          {current.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>No tienes un curso activo</p> : <CourseGrid courses={current} onOpen={open} />}
          <h2 style={{ fontSize: 18, margin: '28px 0 12px' }}>Cursos anteriores</h2>
          {previous.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>Todavía no hay cursos anteriores</p> : <CourseGrid courses={previous} onOpen={open} />}
        </>
      ) : (
        <CourseGrid courses={courses} onOpen={open} />
      )}

      {isAdmin && (
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title="Crear curso" footer={<Button loading={creating} onClick={handleCreate}>Crear curso</Button>}>
          <FormField label="Nombre" error={fieldErrors.name} required>
            {(field) => <input {...field} value={name} onChange={(event) => setName(event.target.value)} placeholder="1º A" style={inputStyle} />}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Año académico" error={fieldErrors.academicYear} required>
            {(field) => <input {...field} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2025-2026" style={inputStyle} />}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Empieza" error={fieldErrors.startsOn} required>
            {(field) => <input {...field} type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} style={inputStyle} />}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Termina" error={fieldErrors.endsOn} required>
            {(field) => <input {...field} type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} style={inputStyle} />}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Estado">
            {(field) => (
              <select {...field} value={status} onChange={(event) => setStatus(event.target.value as CohortStatus)} style={inputStyle}>
                <option value="PLANNED">Planificado</option>
                <option value="ACTIVE">En curso</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            )}
          </FormField>
        </Modal>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit',
};
