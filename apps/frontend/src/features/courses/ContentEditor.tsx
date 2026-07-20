import { useState, useCallback } from 'react';
import {
  useSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
} from '@/lib/api';
import type { SectionDTO, LessonDTO } from '@/lib/api';
import {
  Button,
  FormField,
  ConfirmDialog,
  useToast,
} from '@/components/ui';

function SectionEditor({
  section,
  courseId,
  onUpdated,
}: {
  section: SectionDTO;
  courseId: string;
  onUpdated: () => void;
}) {
  const { update: updateSection } = useUpdateSection();
  const { remove: deleteSection } = useDeleteSection();
  const { create: createLesson } = useCreateLesson();
  const { update: updateLesson } = useUpdateLesson();
  const { remove: deleteLesson } = useDeleteLesson();
  const { toast } = useToast();

  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(section.title);
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [confirmDeleteSection, setConfirmDeleteSection] = useState(false);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonContent, setEditLessonContent] = useState('');
  const [editLessonVideo, setEditLessonVideo] = useState('');
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<string | null>(null);

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    try {
      await updateSection(courseId, section.id, { title: newTitle.trim() });
      setRenaming(false);
    } catch {
      toast({ message: 'Error al renombrar la sección', variant: 'error' });
    }
  };

  const handleDeleteSection = async () => {
    try {
      await deleteSection(courseId, section.id);
      setConfirmDeleteSection(false);
      onUpdated();
    } catch {
      toast({ message: 'Error al eliminar la sección', variant: 'error' });
    }
  };

  const handleAddLesson = async () => {
    if (!lessonTitle.trim()) return;
    try {
      await createLesson(section.id, {
        title: lessonTitle.trim(),
        order: (section.lessons?.length ?? 0) + 1,
      });
      setAddingLesson(false);
      setLessonTitle('');
      toast({ message: 'Lección creada', variant: 'success' });
      onUpdated();
    } catch {
      toast({ message: 'Error al crear la lección', variant: 'error' });
    }
  };

  const startEditLesson = (lesson: LessonDTO) => {
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title);
    setEditLessonContent(lesson.contentMd ?? '');
    setEditLessonVideo(lesson.videoUrl ?? '');
  };

  const handleUpdateLesson = async () => {
    if (!editingLessonId || !editLessonTitle.trim()) return;
    try {
      await updateLesson(section.id, editingLessonId, {
        title: editLessonTitle.trim(),
        contentMd: editLessonContent || undefined,
        videoUrl: editLessonVideo || undefined,
      });
      setEditingLessonId(null);
      toast({ message: 'Lección actualizada', variant: 'success' });
      onUpdated();
    } catch {
      toast({ message: 'Error al actualizar la lección', variant: 'error' });
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await deleteLesson(section.id, lessonId);
      setConfirmDeleteLesson(null);
      toast({ message: 'Lección eliminada', variant: 'success' });
      onUpdated();
    } catch {
      toast({ message: 'Error al eliminar la lección', variant: 'error' });
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--color-border-primary)',
        borderRadius: 13,
        marginBottom: 18,
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border-primary)',
        }}
      >
        {renaming ? (
          <>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--color-accent-primary)',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            />
            <Button size="sm" onClick={handleRename}>Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
              {section.title}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
              Renombrar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteSection(true)}>
              Eliminar
            </Button>
          </>
        )}
      </div>

      {/* Lessons */}
      {section.lessons?.map((lesson) =>
        editingLessonId === lesson.id ? (
          <div
            key={lesson.id}
            style={{
              padding: 16,
              borderBottom: '1px solid var(--color-border-primary)',
            }}
          >
            <FormField label="Título">
              {(f) => (
                <input
                  {...f}
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }}
                />
              )}
            </FormField>
            <div style={{ height: 8 }} />
            <FormField label="Contenido (Markdown)">
              {(f) => (
                <textarea
                  {...f}
                  value={editLessonContent}
                  onChange={(e) => setEditLessonContent(e.target.value)}
                  rows={6}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 13, fontFamily: 'monospace', resize: 'vertical' }}
                />
              )}
            </FormField>
            <div style={{ height: 8 }} />
            <FormField label="URL del video">
              {(f) => (
                <input
                  {...f}
                  value={editLessonVideo}
                  onChange={(e) => setEditLessonVideo(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }}
                />
              )}
            </FormField>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button size="sm" onClick={handleUpdateLesson}>Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingLessonId(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div
            key={lesson.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 16px',
              borderBottom: '1px solid var(--color-border-primary)',
            }}
          >
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
              {lesson.title}
            </span>
            <Button size="sm" variant="ghost" onClick={() => startEditLesson(lesson)}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteLesson(lesson.id)}>
              Eliminar
            </Button>
          </div>
        ),
      )}

      {/* Add lesson */}
      <div style={{ padding: 12, background: 'var(--color-bg-secondary)' }}>
        {addingLesson ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Título de la lección"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddLesson(); if (e.key === 'Escape') { setAddingLesson(false); setLessonTitle(''); } }}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-accent-primary)', fontSize: 14, fontFamily: 'inherit' }}
            />
            <Button size="sm" onClick={handleAddLesson}>Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingLesson(false); setLessonTitle(''); }}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setAddingLesson(true)}>
            + Añadir lección
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteSection}
        onCancel={() => setConfirmDeleteSection(false)}
        onConfirm={() => { handleDeleteSection(); }}
        title="Eliminar sección"
        message={`¿Eliminar "${section.title}" y todas sus lecciones?`}
        confirmLabel="Eliminar"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmDeleteLesson !== null}
        onCancel={() => setConfirmDeleteLesson(null)}
        onConfirm={() => { if (confirmDeleteLesson) handleDeleteLesson(confirmDeleteLesson); }}
        title="Eliminar lección"
        message="¿Estás seguro de eliminar esta lección?"
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}

export function ContentEditor({ courseId }: { courseId: string }) {
  const { data: sections, isLoading, error, refetch } = useSections(courseId);
  const { create: createSection } = useCreateSection();
  const { toast } = useToast();

  const refresh = useCallback(() => refetch(), [refetch]);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');

  const handleAddSection = async () => {
    if (!sectionTitle.trim()) return;
    try {
      await createSection(courseId, {
        title: sectionTitle.trim(),
        order: (sections?.length ?? 0) + 1,
      });
      setAddingSection(false);
      setSectionTitle('');
      toast({ message: 'Sección creada', variant: 'success' });
      refresh();
    } catch {
      toast({ message: 'Error al crear la sección', variant: 'error' });
    }
  };

  if (isLoading) return <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Cargando secciones…</div>;

  if (error) return <div style={{ color: 'var(--color-error)', padding: 20 }}>Error al cargar secciones</div>;

  return (
    <div style={{ padding: '26px 40px', maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Estructura del curso</span>
        {addingSection ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="Título de la sección"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') { setAddingSection(false); setSectionTitle(''); } }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-accent-primary)', fontSize: 14, fontFamily: 'inherit', width: 250 }}
            />
            <Button size="sm" onClick={handleAddSection}>Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingSection(false); setSectionTitle(''); }}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAddingSection(true)}>+ Añadir sección</Button>
        )}
      </div>

      {(!sections || sections.length === 0) && !addingSection && (
        <div style={{ color: 'var(--color-text-muted)', padding: 20, textAlign: 'center' }}>
          El curso no tiene secciones todavía. Crea la primera sección para empezar.
        </div>
      )}

      {sections?.map((section) => (
        <SectionEditor
          key={section.id}
          section={section}
          courseId={courseId}
          onUpdated={refresh}
        />
      ))}
    </div>
  );
}
