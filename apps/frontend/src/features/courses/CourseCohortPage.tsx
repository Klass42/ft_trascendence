import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiClient, useAuth } from '@/lib/api';
import type { CourseDTO, PublicationStatus, SubjectDTO, SubjectStaffRole } from '@/lib/api';
import { Button, FormField, Modal, useToast } from '@/components/ui';
import { mapApiValidationErrors } from '@/lib/form-errors';
import styles from './CourseCohortPage.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit',
};

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
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffSubjectId, setStaffSubjectId] = useState('');
  const [staffRole, setStaffRole] = useState<SubjectStaffRole>('TEACHER');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reload = () => {
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
    }).catch((err: Error) => {
      setError(err.message || 'No se pudo cargar el curso');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [courseId]);

  const createSubject = async () => {
    if (!courseId) return;
    if (!title.trim()) {
      setFieldErrors({ title: 'El título es obligatorio.' });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await apiClient.post(`/courses/${courseId}/subjects`, { title: title.trim(), status: 'DRAFT' satisfies PublicationStatus });
      setSubjectOpen(false);
      setTitle('');
      toast({ message: 'Asignatura creada', variant: 'success' });
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        if (mapped.fields.title) {
          setFieldErrors({ title: mapped.fields.title });
          return;
        }
      }
      toast({ message: 'No se pudo crear la asignatura', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const lookupUserId = async (email: string) => {
    const result = await apiClient.get<{ userId: string }>(`/users/lookup?email=${encodeURIComponent(email)}`);
    return result.userId;
  };

  const enrollStudent = async () => {
    if (!courseId || !memberEmail.trim()) return;
    const email = memberEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setFieldErrors({ memberEmail: 'Introduce un correo electrónico válido.' });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const userId = await lookupUserId(email);
      await apiClient.post(`/courses/${courseId}/members`, { userId });
      setMemberOpen(false);
      setMemberEmail('');
      toast({ message: 'Alumno matriculado', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) {
        setFieldErrors({ memberEmail: 'No se encontró una cuenta con ese correo.' });
      } else if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        setFieldErrors({ memberEmail: mapped.fields.email ?? 'Revisa el correo e inténtalo de nuevo.' });
      } else {
        toast({ message: 'No se pudo matricular al alumno', variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const assignTeacher = async () => {
    if (!staffSubjectId || !staffEmail.trim()) return;
    const email = staffEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setFieldErrors({ staffEmail: 'Introduce un correo electrónico válido.' });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const userId = await lookupUserId(email);
      await apiClient.post(`/subjects/${staffSubjectId}/staff`, { userId, role: staffRole });
      setStaffOpen(false);
      setStaffEmail('');
      toast({ message: 'Profesor asignado', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) {
        setFieldErrors({ staffEmail: 'No se encontró una cuenta con ese correo.' });
      } else if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        setFieldErrors({ staffEmail: mapped.fields.email ?? 'Revisa el correo e inténtalo de nuevo.' });
      } else {
        toast({ message: 'No se pudo asignar al profesor', variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Cargando curso...</div>;
  if (error || !course) return <div style={{ padding: 40 }}>{error || 'Curso no encontrado'}</div>;

  return (
    <div className={styles.page}>
      <button onClick={() => navigate('/courses')} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: 12 }}>
        ← Mis cursos
      </button>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{course.name}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>{course.academicYear}</p>
        </div>
        {isAdmin && (
          <div className={styles.actions}>
            <Button onClick={() => setSubjectOpen(true)}>Crear asignatura</Button>
            <Button variant="secondary" onClick={() => setMemberOpen(true)}>Matricular alumno</Button>
            <Button variant="secondary" onClick={() => setStaffOpen(true)}>Asignar profesor</Button>
          </div>
        )}
      </div>
      <h2 style={{ fontSize: 18 }}>Asignaturas</h2>
      {subjects.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Este curso todavía no tiene asignaturas</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {subjects.map((subject) => (
            <button
              key={subject.id}
              onClick={() => navigate(`/courses/${course.id}/subjects/${subject.id}`)}
              style={{
                textAlign: 'left', padding: 16, borderRadius: 12, cursor: 'pointer',
                border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-secondary)',
              }}
            >
              <strong>{subject.title}</strong>
              <span className={styles.subjectStatus}>{subject.status === 'PUBLISHED' ? 'Publicada' : subject.status === 'ARCHIVED' ? 'Archivada' : 'Borrador'}</span>
            </button>
          ))}
        </div>
      )}

      <Modal open={subjectOpen} onClose={() => { setSubjectOpen(false); setFieldErrors({}); }} title="Crear asignatura" footer={<Button loading={busy} onClick={createSubject}>Crear</Button>}>
        <FormField label="Título" error={fieldErrors.title} required>
          {(field) => <input {...field} value={title} maxLength={200} onChange={(event) => { setTitle(event.target.value); setFieldErrors({}); }} style={inputStyle} />}
        </FormField>
      </Modal>
      <Modal open={memberOpen} onClose={() => { setMemberOpen(false); setFieldErrors({}); }} title="Matricular alumno" footer={<Button loading={busy} onClick={enrollStudent}>Matricular</Button>}>
        <FormField label="Correo electrónico del alumno" error={fieldErrors.memberEmail} required>
          {(field) => <input {...field} type="email" maxLength={254} value={memberEmail} onChange={(event) => { setMemberEmail(event.target.value); setFieldErrors({}); }} style={inputStyle} />}
        </FormField>
      </Modal>
      <Modal open={staffOpen} onClose={() => { setStaffOpen(false); setFieldErrors({}); }} title="Asignar profesor" footer={<Button loading={busy} onClick={assignTeacher}>Asignar</Button>}>
        <FormField label="Asignatura" required>
          {(field) => (
            <select {...field} value={staffSubjectId} onChange={(event) => setStaffSubjectId(event.target.value)} style={inputStyle}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
            </select>
          )}
        </FormField>
        <div style={{ height: 12 }} />
        <FormField label="Correo electrónico" error={fieldErrors.staffEmail} required>
          {(field) => <input {...field} type="email" maxLength={254} value={staffEmail} onChange={(event) => { setStaffEmail(event.target.value); setFieldErrors({}); }} style={inputStyle} />}
        </FormField>
        <div style={{ height: 12 }} />
        <FormField label="Rol">
          {(field) => (
            <select {...field} value={staffRole} onChange={(event) => setStaffRole(event.target.value as SubjectStaffRole)} style={inputStyle}>
              <option value="TEACHER">Profesor</option>
              <option value="ASSISTANT">Asistente</option>
            </select>
          )}
        </FormField>
      </Modal>
    </div>
  );
}
