import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import { apiClient, useAuth, useCourses, useCreateCourse } from '@/lib/api';
import type { CohortStatus, CourseDTO, UpdateCourseInput } from '@/lib/api';
import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';
import { CohortEditModal } from './CohortEditModal';
import { CourseActionsMenu } from './CourseActionsMenu';
import styles from './CoursesPage.module.css';

function statusLabel(status: CohortStatus): string {
  if (status === 'ACTIVE') return 'En curso';
  if (status === 'ARCHIVED') return 'Archivado';
  return 'Planificado';
}

function statusVariant(status: CohortStatus): 'success' | 'neutral' | 'info' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ARCHIVED') return 'neutral';
  return 'info';
}

function formatDateRange(course: CourseDTO): string {
  const format = (value: string) => new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(value));
  return `${format(course.startsOn)} – ${format(course.endsOn)}`;
}

interface CourseGridProps {
  courses: CourseDTO[];
  isAdmin: boolean;
  onOpen: (id: string) => void;
  onEdit: (course: CourseDTO) => void;
  onToggleArchive: (course: CourseDTO) => void;
  onDelete: (course: CourseDTO) => void;
}

function CourseGrid({ courses, isAdmin, onOpen, onEdit, onToggleArchive, onDelete }: CourseGridProps) {
  return (
    <div className={styles.courseGrid}>
      {courses.map((course) => (
        <article className={styles.courseCard} key={course.id}>
          <div className={styles.cardTop}>
            <Badge variant={statusVariant(course.status)} dot>{statusLabel(course.status)}</Badge>
            {isAdmin && (
              <CourseActionsMenu
                course={course}
                onEdit={() => onEdit(course)}
                onToggleArchive={() => onToggleArchive(course)}
                onDelete={() => onDelete(course)}
              />
            )}
          </div>
          <button type="button" className={styles.courseLink} onClick={() => onOpen(course.id)}>
            <strong className={styles.courseName}>{course.name}</strong>
            <span className={styles.academicYear}>{course.academicYear}</span>
            <span className={styles.dateRange}>{formatDateRange(course)}</span>
          </button>
        </article>
      ))}
    </div>
  );
}

export function CoursesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';
  const { data: courses, isLoading, error, refetch } = useCourses();
  const { create, isLoading: creating } = useCreateCourse();
  const { toast } = useToast();
  const [courseList, setCourseList] = useState<CourseDTO[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CourseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [startsOn, setStartsOn] = useState('2026-09-01');
  const [endsOn, setEndsOn] = useState('2027-06-30');
  const [status, setStatus] = useState<CohortStatus>('ACTIVE');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (courses) setCourseList(courses);
  }, [courses]);

  const current = useMemo(
    () => courseList.filter((course) => course.status === 'ACTIVE'),
    [courseList],
  );
  const previous = useMemo(
    () => courseList.filter((course) => course.status !== 'ACTIVE'),
    [courseList],
  );

  function resetCreateForm() {
    setName('');
    setAcademicYear('2026-2027');
    setStartsOn('2026-09-01');
    setEndsOn('2027-06-30');
    setStatus('ACTIVE');
    setFieldErrors({});
  }

  async function handleCreate() {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'El nombre es obligatorio.';
    if (name.trim().length > 100) errors.name = 'El nombre no puede superar los 100 caracteres.';
    if (!/^\d{4}-\d{4}$/.test(academicYear.trim())) {
      errors.academicYear = 'Usa el formato 2025-2026.';
    }
    if (!startsOn) errors.startsOn = 'La fecha de inicio es obligatoria.';
    if (!endsOn) errors.endsOn = 'La fecha de fin es obligatoria.';
    if (startsOn && endsOn && endsOn <= startsOn) errors.endsOn = 'Debe ser posterior al inicio.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const course = await create({ name: name.trim(), academicYear: academicYear.trim(), startsOn, endsOn, status });
      setCourseList((items) => [...items, course]);
      setCreateOpen(false);
      resetCreateForm();
      toast({ message: 'Cohorte creada.', variant: 'success' });
      navigate(`/courses/${course.id}`);
    } catch {
      toast({ message: 'No se pudo crear la cohorte.', variant: 'error' });
    }
  }

  async function saveCourse(courseId: string, input: UpdateCourseInput) {
    try {
      const updated = await apiClient.patch<CourseDTO>(`/courses/${courseId}`, input);
      setCourseList((items) => items.map((course) => course.id === courseId ? updated : course));
      setEditTarget(null);
      toast({ message: 'Cohorte actualizada.', variant: 'success' });
    } catch {
      toast({ message: 'No se pudo actualizar la cohorte.', variant: 'error' });
      throw new Error('No se pudo actualizar la cohorte.');
    }
  }

  async function toggleArchive(course: CourseDTO) {
    const nextStatus: CohortStatus = course.status === 'ARCHIVED' ? 'PLANNED' : 'ARCHIVED';
    try {
      const updated = await apiClient.patch<CourseDTO>(`/courses/${course.id}`, { status: nextStatus });
      setCourseList((items) => items.map((item) => item.id === course.id ? updated : item));
      toast({
        message: nextStatus === 'ARCHIVED' ? 'Cohorte archivada.' : 'Cohorte desarchivada como planificada.',
        variant: 'success',
      });
    } catch {
      toast({ message: 'No se pudo cambiar el estado de la cohorte.', variant: 'error' });
    }
  }

  async function deleteCourse() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/courses/${deleteTarget.id}`);
      setCourseList((items) => items.filter((course) => course.id !== deleteTarget.id));
      toast({ message: 'Cohorte borrada.', variant: 'success' });
      setDeleteTarget(null);
    } catch {
      toast({
        message: 'No se pudo borrar. Si tiene matrículas o intentos, archívala para conservar el historial.',
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return <div className={styles.status}><Spinner size="lg" label="Cargando cohortes…" /></div>;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          <span>No se pudieron cargar las cohortes.</span>
          <Button variant="outline" onClick={refetch}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const gridProps = {
    isAdmin,
    onOpen: (id: string) => navigate(`/courses/${id}`),
    onEdit: setEditTarget,
    onToggleArchive: toggleArchive,
    onDelete: setDeleteTarget,
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Mis cursos</h1>
          <p className={styles.subtitle}>Cohortes y asignaturas de tu organización.</p>
        </div>
        {isAdmin && (
          <Button leftIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>Crear cohorte</Button>
        )}
      </header>

      {courseList.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title="Todavía no hay cohortes"
          description={isAdmin ? 'Crea la primera cohorte para organizar sus asignaturas.' : 'Cuando te asignen a una cohorte, aparecerá aquí.'}
          action={isAdmin ? <Button onClick={() => setCreateOpen(true)}>Crear cohorte</Button> : undefined}
        />
      ) : isStudent ? (
        <>
          <section className={styles.courseSection}>
            <h2>Curso actual</h2>
            {current.length === 0 ? (
              <p className={styles.sectionEmpty}>No tienes una cohorte activa.</p>
            ) : <CourseGrid courses={current} {...gridProps} />}
          </section>
          <section className={styles.courseSection}>
            <h2>Cursos anteriores</h2>
            {previous.length === 0 ? (
              <p className={styles.sectionEmpty}>Todavía no hay cursos anteriores.</p>
            ) : <CourseGrid courses={previous} {...gridProps} />}
          </section>
        </>
      ) : (
        <CourseGrid courses={courseList} {...gridProps} />
      )}

      {isAdmin && (
        <>
          <Modal
            open={createOpen}
            onClose={() => { setCreateOpen(false); resetCreateForm(); }}
            title="Crear cohorte"
            footer={(
              <div className={styles.modalActions}>
                <Button variant="ghost" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancelar</Button>
                <Button loading={creating} onClick={handleCreate}>Crear cohorte</Button>
              </div>
            )}
          >
            <div className={styles.formFields}>
              <Input label="Nombre" value={name} maxLength={100} error={fieldErrors.name} onChange={(event) => setName(event.target.value)} required />
              <Input label="Año académico" value={academicYear} maxLength={9} placeholder="2026-2027" error={fieldErrors.academicYear} onChange={(event) => setAcademicYear(event.target.value)} required />
              <div className={styles.dateFields}>
                <DatePicker label="Empieza" value={startsOn} error={fieldErrors.startsOn} onChange={(event) => setStartsOn(event.target.value)} required />
                <DatePicker label="Termina" value={endsOn} error={fieldErrors.endsOn} onChange={(event) => setEndsOn(event.target.value)} required />
              </div>
              <Select
                label="Estado"
                value={status}
                onChange={(event) => setStatus(event.target.value as CohortStatus)}
                options={[
                  { value: 'PLANNED', label: 'Planificado' },
                  { value: 'ACTIVE', label: 'En curso' },
                  { value: 'ARCHIVED', label: 'Archivado' },
                ]}
              />
            </div>
          </Modal>

          <CohortEditModal
            course={editTarget}
            open={editTarget !== null}
            onClose={() => setEditTarget(null)}
            onSave={(input) => saveCourse(editTarget!.id, input)}
          />

          <ConfirmDialog
            open={deleteTarget !== null}
            title="Borrar cohorte"
            message={deleteTarget ? `Se borrará «${deleteTarget.name}» y sus asignaturas. Si hay matrículas, entregas o intentos, tendrás que archivarla para conservar el historial.` : ''}
            confirmLabel="Borrar cohorte"
            variant="danger"
            loading={deleting}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={deleteCourse}
          />
        </>
      )}
    </div>
  );
}
