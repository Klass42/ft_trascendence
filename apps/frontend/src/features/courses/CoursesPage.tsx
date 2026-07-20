import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCourses,
  useIsTeacher,
  useCreateCourse,
} from '@/lib/api';
import {
  Button,
  Modal,
  FormField,
  useToast,
} from '@/components/ui';

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

export function CoursesPage() {
  const navigate = useNavigate();
  const isTeacher = useIsTeacher();
  const { data: courses, isLoading, error } = useCourses(isTeacher ? undefined : 'PUBLISHED');
  const { create, isLoading: creating } = useCreateCourse();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setAccessCode('');
    setFieldErrors({});
  };

  const handleCreate = async () => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = 'El título es obligatorio';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const course = await create({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        accessCode: accessCode.trim() || undefined,
        status: 'DRAFT',
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
    return (
      <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>
        Cargando cursos...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>
        Error al cargar cursos: {error.message}
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div style={{ padding: '30px 40px', maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Mis cursos
          </h1>
          {isTeacher && (
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              + Crear curso
            </Button>
          )}
        </div>
        <p style={{ color: 'var(--color-text-secondary)' }}>No hay cursos disponibles</p>

        {isTeacher && (
          <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title="Crear curso" footer={<Button loading={creating} onClick={handleCreate}>Crear curso</Button>}>
            <FormField label="Título" error={fieldErrors.title} required>
              {(f) => <input {...f} value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
            </FormField>
            <div style={{ height: 12 }} />
            <FormField label="Descripción">
              {(f) => (
                <textarea
                  {...f}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                />
              )}
            </FormField>
            <div style={{ height: 12 }} />
            <FormField label="Categoría">
              {(f) => <input {...f} value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
            </FormField>
            <div style={{ height: 12 }} />
            <FormField label="Código de acceso">
              {(f) => <input {...f} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Opcional" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
            </FormField>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Mis cursos
        </h1>
        {isTeacher && (
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Crear curso
          </Button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        {courses.map((c) => {
          const color = hashToColor(c.title);
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/courses/${c.id}`)}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 15,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: 70,
                  background: color,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '12px 16px',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,.7)',
                    background: 'rgba(0,0,0,.15)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  {c.status === 'DRAFT' ? 'Borrador' : c.status === 'ARCHIVED' ? 'Archivado' : 'Publicado'}
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{c.title}</div>
                {c.description && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {c.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isTeacher && (
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title="Crear curso" footer={<Button loading={creating} onClick={handleCreate}>Crear curso</Button>}>
          <FormField label="Título" error={fieldErrors.title} required>
            {(f) => <input {...f} value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Descripción">
            {(f) => (
              <textarea
                {...f}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
              />
            )}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Categoría">
            {(f) => <input {...f} value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
          </FormField>
          <div style={{ height: 12 }} />
          <FormField label="Código de acceso">
            {(f) => <input {...f} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Opcional" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
          </FormField>
        </Modal>
      )}
    </div>
  );
}
