import { useState, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, Paperclip } from 'lucide-react';
import {
  useAuth,
  useSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useReorderLessons,
  useLessonById,
  useAttachFile,
  useDetachFile,
} from '@/lib/api';
import type { SectionDTO, LessonDTO, LessonAttachmentDTO } from '@/lib/api';
import {
  Button,
  Input,
  Textarea,
  ConfirmDialog,
  EmptyState,
  Spinner,
  useToast,
} from '@/components/ui';
import { FileUpload, type FileValue } from '@/components/ui/FileUpload';
import { parseVideoUrl, validateVideoUrl, VIDEO_URL_MAX_LENGTH } from '@/lib/video-embed';
import { VideoPlayer } from './VideoPlayer';
import styles from './ContentEditor.module.css';

/** Mirrors the GENERAL allowlist in apps/backend/src/files/file-validation.ts. */
const ATTACHMENT_ACCEPT = [
  '.pdf', '.epub', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.mp3', '.wav', '.ogg', '.m4a',
  '.mp4', '.m4v', '.webm', '.mov',
].join(',');

/** Same limit as MAX_UPLOAD_BYTES on the server. */
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Returns a copy of `ids` with the item at `index` swapped one step up or down. */
function moveId(ids: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function MoveButtons({
  label,
  isFirst,
  isLast,
  disabled,
  onMove,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className={styles.moveButtons}>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Subir ${label}`}
        disabled={disabled || isFirst}
        onClick={() => onMove(-1)}
      >
        <ChevronUp size={16} aria-hidden="true" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Bajar ${label}`}
        disabled={disabled || isLast}
        onClick={() => onMove(1)}
      >
        <ChevronDown size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

function LessonAttachments({ lessonId }: { lessonId: string }) {
  const { user } = useAuth();
  const { data: lesson, isLoading, error, refetch } = useLessonById(lessonId);
  const { attach } = useAttachFile();
  const { detach, isLoading: detaching } = useDetachFile();
  const { toast } = useToast();

  const [uploads, setUploads] = useState<FileValue[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<LessonAttachmentDTO | null>(null);
  // Uploads already handed to attach(); FileUpload re-emits "done" entries.
  const attaching = useRef(new Set<string>());

  const attachUploaded = async (file: FileValue) => {
    try {
      await attach(lessonId, file.id);
      toast({ message: `Adjunto "${file.originalName}" añadido`, variant: 'success' });
      setUploads((prev) => prev.filter((u) => u.id !== file.id));
      refetch();
    } catch {
      toast({ message: `Error al adjuntar "${file.originalName}"`, variant: 'error' });
    }
  };

  const handleUploadsChange = (next: FileValue[]) => {
    setUploads(next);
    for (const file of next) {
      if (file.status === 'done' && !attaching.current.has(file.id)) {
        attaching.current.add(file.id);
        void attachUploaded(file);
      }
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try {
      await detach(lessonId, confirmRemove.fileId);
      toast({ message: 'Adjunto eliminado', variant: 'success' });
      setConfirmRemove(null);
      refetch();
    } catch {
      toast({ message: 'Error al eliminar el adjunto', variant: 'error' });
    }
  };

  const attachments = lesson?.attachments ?? [];

  return (
    <section className={styles.attachments} aria-labelledby={`attachments-${lessonId}`}>
      <h3 id={`attachments-${lessonId}`} className={styles.attachmentsTitle}>
        Adjuntos
      </h3>

      {isLoading && !lesson ? (
        <div className={styles.status}>
          <Spinner size="sm" />
          Cargando adjuntos…
        </div>
      ) : error && !lesson ? (
        <div className={`${styles.status} ${styles.statusError}`} role="alert">
          Error al cargar los adjuntos
          <Button size="sm" variant="ghost" onClick={refetch}>Reintentar</Button>
        </div>
      ) : attachments.length === 0 ? (
        <p className={styles.attachmentsEmpty}>Esta lección no tiene adjuntos.</p>
      ) : (
        <ul className={styles.attachmentList}>
          {attachments.map((a) => (
            <li key={a.fileId} className={styles.attachmentItem} data-testid="lesson-attachment">
              <Paperclip size={16} aria-hidden="true" />
              <span className={styles.attachmentName}>{a.file.originalName}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Quitar adjunto ${a.file.originalName}`}
                onClick={() => setConfirmRemove(a)}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {user?.organizationId && (
        <FileUpload
          organizationId={user.organizationId}
          uploaderId={user.userId}
          accept={ATTACHMENT_ACCEPT}
          maxSizeBytes={ATTACHMENT_MAX_BYTES}
          multiple
          maxFiles={5}
          value={uploads}
          onChange={handleUploadsChange}
          hint="PDF, documentos de Office, imágenes, audio o vídeo. Máx. 10 MB por archivo."
        />
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => { void handleRemove(); }}
        title="Quitar adjunto"
        message={`¿Quitar "${confirmRemove?.file.originalName ?? ''}" de esta lección?`}
        confirmLabel="Quitar"
        variant="danger"
        loading={detaching}
      />
    </section>
  );
}

function SectionEditor({
  section,
  courseId,
  isFirst,
  isLast,
  moving,
  onMove,
  onUpdated,
}: {
  section: SectionDTO;
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
  moving: boolean;
  onMove: (direction: -1 | 1) => void;
  onUpdated: () => void;
}) {
  const { update: updateSection } = useUpdateSection();
  const { remove: deleteSection } = useDeleteSection();
  const { create: createLesson } = useCreateLesson();
  const { update: updateLesson } = useUpdateLesson();
  const { remove: deleteLesson } = useDeleteLesson();
  const { reorder: reorderLessons, isLoading: reorderingLessons } = useReorderLessons();
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

  const lessons = section.lessons ?? [];
  const videoError = validateVideoUrl(editLessonVideo);
  const videoSource = parseVideoUrl(editLessonVideo);

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    try {
      await updateSection(courseId, section.id, { title: newTitle.trim() });
      setRenaming(false);
      toast({ message: 'Sección renombrada', variant: 'success' });
      onUpdated();
    } catch {
      toast({ message: 'Error al renombrar la sección', variant: 'error' });
    }
  };

  const handleDeleteSection = async () => {
    try {
      await deleteSection(courseId, section.id);
      setConfirmDeleteSection(false);
      toast({ message: 'Sección eliminada', variant: 'success' });
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
        order: lessons.length + 1,
      });
      setAddingLesson(false);
      setLessonTitle('');
      toast({ message: 'Lección creada', variant: 'success' });
      onUpdated();
    } catch {
      toast({ message: 'Error al crear la lección', variant: 'error' });
    }
  };

  const handleMoveLesson = async (index: number, direction: -1 | 1) => {
    const orderedIds = moveId(lessons.map((l) => l.id), index, direction);
    try {
      await reorderLessons(section.id, orderedIds);
      toast({ message: 'Orden de lecciones actualizado', variant: 'success' });
      onUpdated();
    } catch {
      toast({ message: 'Error al reordenar las lecciones', variant: 'error' });
    }
  };

  const startEditLesson = (lesson: LessonDTO) => {
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title);
    setEditLessonContent(lesson.contentMd ?? '');
    setEditLessonVideo(lesson.videoUrl ?? '');
  };

  const handleUpdateLesson = async () => {
    if (!editingLessonId || !editLessonTitle.trim() || videoError) return;
    try {
      await updateLesson(section.id, editingLessonId, {
        title: editLessonTitle.trim(),
        contentMd: editLessonContent || undefined,
        // Empty string clears the video on the server.
        videoUrl: editLessonVideo.trim(),
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
    <div className={styles.section} data-testid="section-editor">
      {/* Section header */}
      <div className={styles.sectionHeader}>
        {renaming ? (
          <div className={styles.inlineForm}>
            <Input
              size="sm"
              className={styles.inlineField}
              aria-label="Nuevo título de la sección"
              value={newTitle}
              maxLength={200}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            />
            <Button size="sm" onClick={handleRename}>Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancelar</Button>
          </div>
        ) : (
          <>
            <span className={styles.sectionTitle} data-testid="section-title">
              {section.title}
            </span>
            <MoveButtons
              label={`sección ${section.title}`}
              isFirst={isFirst}
              isLast={isLast}
              disabled={moving}
              onMove={onMove}
            />
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
      {lessons.map((lesson, index) =>
        editingLessonId === lesson.id ? (
          <div key={lesson.id} className={styles.lessonEdit}>
            <Input
              label="Título"
              value={editLessonTitle}
              maxLength={200}
              onChange={(e) => setEditLessonTitle(e.target.value)}
            />
            <Textarea
              label="Contenido (Markdown)"
              className={styles.markdown}
              value={editLessonContent}
              onChange={(e) => setEditLessonContent(e.target.value)}
              rows={6}
            />
            <Input
              label="URL del video"
              type="url"
              value={editLessonVideo}
              maxLength={VIDEO_URL_MAX_LENGTH}
              onChange={(e) => setEditLessonVideo(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              error={videoError ?? undefined}
              hint="YouTube, Vimeo o un archivo .mp4, .webm u .ogg. Déjalo vacío para quitar el vídeo."
            />
            {videoSource && !videoError && (
              <div className={styles.videoPreview}>
                {videoSource.kind === 'link' && (
                  <p className={styles.videoPreviewNote}>
                    No se puede incrustar este enlace: los alumnos verán un botón para abrirlo.
                  </p>
                )}
                <VideoPlayer url={editLessonVideo} title={editLessonTitle || 'Lección'} />
              </div>
            )}
            <LessonAttachments lessonId={lesson.id} />
            <div className={styles.actions}>
              <Button size="sm" onClick={handleUpdateLesson} disabled={!!videoError}>Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingLessonId(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div key={lesson.id} className={styles.lessonRow} data-testid="lesson-row">
            <span className={styles.lessonTitle} data-testid="lesson-title">
              {lesson.title}
            </span>
            <MoveButtons
              label={`lección ${lesson.title}`}
              isFirst={index === 0}
              isLast={index === lessons.length - 1}
              disabled={reorderingLessons}
              onMove={(direction) => { void handleMoveLesson(index, direction); }}
            />
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
      <div className={styles.addLesson}>
        {addingLesson ? (
          <div className={styles.inlineForm}>
            <Input
              className={styles.inlineField}
              aria-label="Título de la lección"
              value={lessonTitle}
              maxLength={200}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Título de la lección"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddLesson(); if (e.key === 'Escape') { setAddingLesson(false); setLessonTitle(''); } }}
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
  const { reorder: reorderSections, isLoading: reorderingSections } = useReorderSections();
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

  const handleMoveSection = async (index: number, direction: -1 | 1) => {
    if (!sections) return;
    const orderedIds = moveId(sections.map((s) => s.id), index, direction);
    try {
      await reorderSections(courseId, orderedIds);
      toast({ message: 'Orden de secciones actualizado', variant: 'success' });
      refresh();
    } catch {
      toast({ message: 'Error al reordenar las secciones', variant: 'error' });
    }
  };

  if (isLoading && !sections) {
    return (
      <div className={styles.status}>
        <Spinner size="sm" />
        Cargando secciones…
      </div>
    );
  }

  if (error && !sections) {
    return (
      <div className={`${styles.status} ${styles.statusError}`} role="alert">
        Error al cargar secciones
        <Button size="sm" variant="ghost" onClick={refresh}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Estructura del curso</h2>
        {addingSection ? (
          <div className={styles.inlineForm}>
            <Input
              className={styles.sectionTitleField}
              aria-label="Título de la sección"
              value={sectionTitle}
              maxLength={200}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="Título de la sección"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') { setAddingSection(false); setSectionTitle(''); } }}
            />
            <Button size="sm" onClick={handleAddSection}>Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingSection(false); setSectionTitle(''); }}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAddingSection(true)}>+ Añadir sección</Button>
        )}
      </div>

      {(!sections || sections.length === 0) && !addingSection && (
        <EmptyState
          title="El curso no tiene secciones todavía"
          description="Crea la primera sección para empezar."
        />
      )}

      {sections?.map((section, index) => (
        <SectionEditor
          key={section.id}
          section={section}
          courseId={courseId}
          isFirst={index === 0}
          isLast={index === sections.length - 1}
          moving={reorderingSections}
          onMove={(direction) => { void handleMoveSection(index, direction); }}
          onUpdated={refresh}
        />
      ))}
    </div>
  );
}
