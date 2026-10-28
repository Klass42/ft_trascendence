import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, BookOpen, MoreVertical, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { ApiError, apiClient, useAuth } from '@/lib/api';
import type { CohortStatus, CourseDTO, PublicationStatus, SubjectDTO, SubjectStaffRole, UpdateCourseInput, UpdateSubjectInput } from '@/lib/api';
import { mapApiValidationErrors } from '@/lib/form-errors';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { CohortEditModal } from './CohortEditModal';
import { CourseActionsMenu } from './CourseActionsMenu';
import styles from './CourseCohortPage.module.css';

function subjectStatusLabel(status: PublicationStatus) {
  if (status === 'PUBLISHED') return 'Publicada';
  if (status === 'ARCHIVED') return 'Archivada';
  return 'Borrador';
}

function subjectStatusVariant(status: PublicationStatus): 'success' | 'neutral' | 'info' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'neutral';
  return 'info';
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

interface SubjectActionsProps {
  subject: SubjectDTO;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

function SubjectActionsMenu({ subject, onEdit, onToggleArchive, onDelete }: SubjectActionsProps) {
  return (
    <Dropdown
      trigger={(
        <>
          <MoreVertical size={18} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Acciones de {subject.title}</span>
        </>
      )}
      items={[
        { label: 'Editar', icon: <Pencil size={16} />, onClick: onEdit },
        subject.status === 'ARCHIVED'
          ? { label: 'Desarchivar', icon: <ArchiveRestore size={16} />, onClick: onToggleArchive }
          : { label: 'Archivar', icon: <Archive size={16} />, onClick: onToggleArchive },
        { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: onDelete, danger: true },
      ]}
      align="right"
    />
  );
}

export function CourseCohortPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { toast } = useToast();
  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [courseEditOpen, setCourseEditOpen] = useState(false);
  const [courseDeleteOpen, setCourseDeleteOpen] = useState(false);
  const [subjectEditTarget, setSubjectEditTarget] = useState<SubjectDTO | null>(null);
  const [subjectDeleteTarget, setSubjectDeleteTarget] = useState<SubjectDTO | null>(null);
  const [title, setTitle] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [subjectCategory, setSubjectCategory] = useState('');
  const [subjectTitleError, setSubjectTitleError] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberEmailError, setMemberEmailError] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffEmailError, setStaffEmailError] = useState('');
  const [staffSubjectId, setStaffSubjectId] = useState('');
  const [staffRole, setStaffRole] = useState<SubjectStaffRole>('TEACHER');

  const reload = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    Promise.all([
      apiClient.get<CourseDTO>(`/courses/${courseId}`),
      apiClient.get<SubjectDTO[]>(`/courses/${courseId}/subjects`),
    ]).then(([nextCourse, nextSubjects]) => {
      setCourse(nextCourse);
      setSubjects(nextSubjects);
      setStaffSubjectId((current) => current || nextSubjects[0]?.id || '');
      setError(null);
    }).catch(() => {
      setError('No se pudo cargar la cohorte y sus asignaturas.');
    }).finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => { reload(); }, [reload]);

  async function createSubject() {
    const nextTitle = title.trim();
    if (!courseId || !nextTitle) {
      setSubjectTitleError(!nextTitle ? 'El título es obligatorio.' : '');
      return;
    }
    setSubjectTitleError('');
    setBusy(true);
    try {
      await apiClient.post(`/courses/${courseId}/subjects`, { title: nextTitle, status: 'DRAFT' satisfies PublicationStatus });
      setSubjectOpen(false);
      setTitle('');
      setSubjectTitleError('');
      toast({ message: 'Asignatura creada.', variant: 'success' });
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        if (mapped.fields.title) {
          setSubjectTitleError(mapped.fields.title);
          return;
        }
      }
      toast({ message: 'No se pudo crear la asignatura.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function saveCohort(input: UpdateCourseInput) {
    if (!course) return;
    try {
      const updated = await apiClient.patch<CourseDTO>(`/courses/${course.id}`, input);
      setCourse(updated);
      setCourseEditOpen(false);
      toast({ message: 'Cohorte actualizada.', variant: 'success' });
    } catch {
      toast({ message: 'No se pudo actualizar la cohorte.', variant: 'error' });
      throw new Error('No se pudo actualizar la cohorte.');
    }
  }

  async function toggleCohortArchive() {
    if (!course) return;
    const status: CohortStatus = course.status === 'ARCHIVED' ? 'PLANNED' : 'ARCHIVED';
    try {
      const updated = await apiClient.patch<CourseDTO>(`/courses/${course.id}`, { status });
      setCourse(updated);
      toast({
        message: status === 'ARCHIVED' ? 'Cohorte archivada.' : 'Cohorte desarchivada como planificada.',
        variant: 'success',
      });
    } catch {
      toast({ message: 'No se pudo cambiar el estado de la cohorte.', variant: 'error' });
    }
  }

  async function deleteCohort() {
    if (!course) return;
    setBusy(true);
    try {
      await apiClient.delete(`/courses/${course.id}`);
      toast({ message: 'Cohorte eliminada.', variant: 'success' });
      navigate('/courses');
    } catch {
      toast({ message: 'No se pudo eliminar. Si hay matrículas o intentos, archívala para conservar el historial.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function startSubjectEdit(subject: SubjectDTO) {
    setSubjectTitle(subject.title);
    setSubjectDescription(subject.description ?? '');
    setSubjectCategory(subject.category ?? '');
    setSubjectTitleError('');
    setSubjectEditTarget(subject);
  }

  async function saveSubject(input: UpdateSubjectInput) {
    if (!subjectEditTarget) return;
    setBusy(true);
    try {
      const updated = await apiClient.patch<SubjectDTO>(`/subjects/${subjectEditTarget.id}`, input);
      setSubjects((items) => items.map((subject) => subject.id === updated.id ? updated : subject));
      setSubjectEditTarget(null);
      toast({ message: 'Asignatura actualizada.', variant: 'success' });
    } catch {
      toast({ message: 'No se pudo actualizar la asignatura.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleSubjectArchive(subject: SubjectDTO) {
    const status: PublicationStatus = subject.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED';
    try {
      const updated = await apiClient.patch<SubjectDTO>(`/subjects/${subject.id}`, { status });
      setSubjects((items) => items.map((item) => item.id === updated.id ? updated : item));
      toast({
        message: status === 'ARCHIVED' ? 'Asignatura archivada.' : 'Asignatura desarchivada como borrador.',
        variant: 'success',
      });
    } catch {
      toast({ message: 'No se pudo cambiar el estado de la asignatura.', variant: 'error' });
    }
  }

  async function deleteSubject() {
    if (!subjectDeleteTarget) return;
    setBusy(true);
    try {
      await apiClient.delete(`/subjects/${subjectDeleteTarget.id}`);
      setSubjects((items) => items.filter((subject) => subject.id !== subjectDeleteTarget.id));
      toast({ message: 'Asignatura eliminada.', variant: 'success' });
      setSubjectDeleteTarget(null);
    } catch {
      toast({ message: 'No se pudo eliminar. Si tiene matrículas, entregas o intentos, archívala.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const lookupUserId = async (email: string) => {
    const result = await apiClient.get<{ userId: string }>(`/users/lookup?email=${encodeURIComponent(email)}`);
    return result.userId;
  };

  async function enrollStudent() {
    const email = memberEmail.trim();
    if (!isValidEmail(email)) {
      setMemberEmailError('Introduce un correo electrónico válido.');
      return;
    }
    if (!courseId) return;
    setMemberEmailError('');
    setBusy(true);
    try {
      const userId = await lookupUserId(email);
      await apiClient.post(`/courses/${courseId}/members`, { userId });
      setMemberOpen(false);
      setMemberEmail('');
      setMemberEmailError('');
      toast({ message: 'Alumno matriculado.', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) {
        setMemberEmailError('No se encontró una cuenta con ese correo.');
      } else if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        setMemberEmailError(mapped.fields.email ?? 'Revisa el correo e inténtalo de nuevo.');
      } else {
        toast({ message: 'No se pudo matricular al alumno.', variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function assignTeacher() {
    const email = staffEmail.trim();
    if (!staffSubjectId) return;
    if (!isValidEmail(email)) {
      setStaffEmailError('Introduce un correo electrónico válido.');
      return;
    }
    setStaffEmailError('');
    setBusy(true);
    try {
      const userId = await lookupUserId(email);
      await apiClient.post(`/subjects/${staffSubjectId}/staff`, { userId, role: staffRole });
      setStaffOpen(false);
      setStaffEmail('');
      setStaffEmailError('');
      toast({ message: 'Profesor asignado.', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) {
        setStaffEmailError('No se encontró una cuenta con ese correo.');
      } else if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        setStaffEmailError(mapped.fields.email ?? 'Revisa el correo e inténtalo de nuevo.');
      } else {
        toast({ message: 'No se pudo asignar al profesor.', variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className={styles.pageStatus}><Spinner size="lg" label="Cargando cohorte…" /></div>;
  }

  if (error || !course) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState} role="alert">
          <p>{error || 'No se encontró la cohorte.'}</p>
          <Button variant="outline" onClick={reload}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Button variant="ghost" size="sm" onClick={() => navigate('/courses')}>← Mis cursos</Button>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Badge variant={course.status === 'ACTIVE' ? 'success' : course.status === 'ARCHIVED' ? 'neutral' : 'info'} dot>
            {course.status === 'ACTIVE' ? 'En curso' : course.status === 'ARCHIVED' ? 'Archivada' : 'Planificada'}
          </Badge>
          <h1>{course.name}</h1>
          <p>{course.academicYear}</p>
        </div>
        {isAdmin && (
          <div className={styles.headerActions}>
            <CourseActionsMenu
              course={course}
              onEdit={() => setCourseEditOpen(true)}
              onToggleArchive={toggleCohortArchive}
              onDelete={() => setCourseDeleteOpen(true)}
            />
            <Button leftIcon={<Plus size={17} />} onClick={() => setSubjectOpen(true)}>Crear asignatura</Button>
            <Button variant="secondary" leftIcon={<UserPlus size={17} />} onClick={() => setMemberOpen(true)}>Matricular alumno</Button>
            <Button variant="secondary" leftIcon={<Users size={17} />} disabled={subjects.length === 0} onClick={() => setStaffOpen(true)}>Asignar profesor</Button>
          </div>
        )}
      </header>

      <section className={styles.subjectSection}>
        <h2>Asignaturas</h2>
        {subjects.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title="Sin asignaturas"
            description={isAdmin ? 'Añade la primera asignatura de esta cohorte.' : 'Todavía no hay asignaturas en esta cohorte.'}
            action={isAdmin ? <Button onClick={() => setSubjectOpen(true)}>Crear asignatura</Button> : undefined}
          />
        ) : (
          <div className={styles.subjectList}>
            {subjects.map((subject) => (
              <article className={styles.subjectRow} key={subject.id}>
                <button
                  type="button"
                  className={styles.subjectLink}
                  onClick={() => navigate(`/courses/${course.id}/subjects/${subject.id}`)}
                >
                  <span className={styles.subjectTitle}>{subject.title}</span>
                  <Badge variant={subjectStatusVariant(subject.status)}>{subjectStatusLabel(subject.status)}</Badge>
                </button>
                {isAdmin && (
                  <SubjectActionsMenu
                    subject={subject}
                    onEdit={() => startSubjectEdit(subject)}
                    onToggleArchive={() => toggleSubjectArchive(subject)}
                    onDelete={() => setSubjectDeleteTarget(subject)}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={subjectOpen}
        onClose={() => { setSubjectOpen(false); setSubjectTitleError(''); }}
        title="Crear asignatura"
        footer={(
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setSubjectOpen(false); setSubjectTitleError(''); }}>Cancelar</Button>
            <Button loading={busy} onClick={createSubject}>Crear asignatura</Button>
          </div>
        )}
      >
        <Input label="Título" value={title} maxLength={200} error={subjectTitleError} onChange={(event) => { setTitle(event.target.value); setSubjectTitleError(''); }} required />
      </Modal>

      <Modal
        open={subjectEditTarget !== null}
        onClose={() => { setSubjectEditTarget(null); setSubjectTitleError(''); }}
        title="Editar asignatura"
        footer={(
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setSubjectEditTarget(null); setSubjectTitleError(''); }}>Cancelar</Button>
            <Button
              loading={busy}
              onClick={() => {
                const trimmedTitle = subjectTitle.trim();
                if (!trimmedTitle) {
                  setSubjectTitleError('El título es obligatorio.');
                  return;
                }
                setSubjectTitleError('');
                void saveSubject({
                  title: trimmedTitle,
                  description: subjectDescription.trim(),
                  category: subjectCategory.trim(),
                });
              }}
            >Guardar cambios</Button>
          </div>
        )}
      >
        <div className={styles.formFields}>
          <Input label="Título" value={subjectTitle} maxLength={200} error={subjectTitleError} onChange={(event) => { setSubjectTitle(event.target.value); setSubjectTitleError(''); }} required />
          <Textarea label="Descripción" value={subjectDescription} onChange={(event) => setSubjectDescription(event.target.value)} rows={4} />
          <Input label="Categoría" value={subjectCategory} maxLength={80} onChange={(event) => setSubjectCategory(event.target.value)} />
        </div>
      </Modal>

      <Modal open={memberOpen} onClose={() => { setMemberOpen(false); setMemberEmailError(''); }} title="Matricular alumno" footer={<Button loading={busy} onClick={enrollStudent}>Matricular</Button>}>
        <Input label="Correo electrónico del alumno" type="email" maxLength={254} value={memberEmail} error={memberEmailError} onChange={(event) => { setMemberEmail(event.target.value); setMemberEmailError(''); }} required />
      </Modal>

      <Modal open={staffOpen} onClose={() => { setStaffOpen(false); setStaffEmailError(''); }} title="Asignar profesor" footer={<Button loading={busy} onClick={assignTeacher}>Asignar profesor</Button>}>
        <div className={styles.formFields}>
          <Select
            label="Asignatura"
            value={staffSubjectId}
            onChange={(event) => setStaffSubjectId(event.target.value)}
            options={subjects.map((subject) => ({ value: subject.id, label: subject.title }))}
          />
          <Input label="Correo electrónico" type="email" maxLength={254} value={staffEmail} error={staffEmailError} onChange={(event) => { setStaffEmail(event.target.value); setStaffEmailError(''); }} required />
          <Select
            label="Rol"
            value={staffRole}
            onChange={(event) => setStaffRole(event.target.value as SubjectStaffRole)}
            options={[
              { value: 'TEACHER', label: 'Profesor' },
              { value: 'ASSISTANT', label: 'Asistente' },
            ]}
          />
        </div>
      </Modal>

      <CohortEditModal
        course={course}
        open={courseEditOpen}
        onClose={() => setCourseEditOpen(false)}
        onSave={saveCohort}
      />

      <ConfirmDialog
        open={courseDeleteOpen}
        title="Eliminar cohorte"
        message={`Se borrará «${course.name}» y sus asignaturas. Si hay matrículas, entregas o intentos, tendrás que archivarla para conservar el historial.`}
        confirmLabel="Eliminar cohorte"
        variant="danger"
        loading={busy}
        onCancel={() => setCourseDeleteOpen(false)}
        onConfirm={deleteCohort}
      />

      <ConfirmDialog
        open={subjectDeleteTarget !== null}
        title="Eliminar asignatura"
        message={subjectDeleteTarget ? `Se borrará «${subjectDeleteTarget.title}» y su contenido. Si la cohorte tiene matrículas o hay entregas o intentos, tendrás que archivarla.` : ''}
        confirmLabel="Eliminar asignatura"
        variant="danger"
        loading={busy}
        onCancel={() => setSubjectDeleteTarget(null)}
        onConfirm={deleteSubject}
      />
    </div>
  );
}
