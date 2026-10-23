import { useMemo, useState } from 'react';
import { Archive, Plus, Search, Send, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { FileUpload, type FileValue } from '@/components/ui/FileUpload';
import {
  useAuth,
  useMySubjects,
  useResourceMutations,
  useResources,
  type CreateLearningResourceInput,
  type LearningResourceStatus,
  type LearningResourceType,
} from '@/lib/api';
import { ResourceCard } from './ResourceCard';
import { RESOURCE_STATUSES, RESOURCE_TYPES, splitList } from './resource-helpers';

const EMPTY_FORM = {
  title: '', description: '', type: 'DOCUMENT' as LearningResourceType,
  authors: '', publisher: '', isbn: '', language: '', license: '', tags: '',
  externalUrl: '', status: 'DRAFT' as LearningResourceStatus,
};

/** Staff-only organization catalogue. Files are uploaded first, then referenced by id. */
export function ResourcesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<LearningResourceType | ''>('');
  const [status, setStatus] = useState<LearningResourceStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [publishId, setPublishId] = useState<string | null>(null);
  const { data: resources, isLoading, error, refresh } = useResources({ search, type: type || undefined, status: status || undefined });
  // Staff also need to prepare resources for a draft course before it is
  // published; the backend still enforces course-level staff access.
  const { data: courses } = useMySubjects();
  const mutations = useResourceMutations();

  const publishingResource = useMemo(() => resources?.find((item) => item.id === publishId) ?? null, [publishId, resources]);

  const archive = async (id: string) => {
    try {
      await mutations.update(id, { status: 'ARCHIVED' });
      toast({ variant: 'success', message: 'Recurso archivado.' });
      await refresh();
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo archivar.' });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar este recurso de la biblioteca? Los archivos almacenados no se borrarán.')) return;
    try {
      await mutations.remove(id);
      toast({ variant: 'success', message: 'Recurso eliminado.' });
      await refresh();
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo eliminar.' });
    }
  };

  return (
    <div style={{ padding: '28px 40px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Biblioteca</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)' }}>Recursos reutilizables de la organización: libros, documentos, enlaces y multimedia.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}><Plus size={16} /> Nuevo recurso</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <label style={searchStyle}><Search size={15} /><input aria-label="Buscar biblioteca" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, autor o etiqueta" style={inputStyle} /></label>
        <select aria-label="Tipo de recurso" value={type} onChange={(e) => setType(e.target.value as LearningResourceType | '')} style={selectStyle}>
          <option value="">Todos los tipos</option>{RESOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select aria-label="Estado de recurso" value={status} onChange={(e) => setStatus(e.target.value as LearningResourceStatus | '')} style={selectStyle}>
          <option value="">Todos los estados</option>{RESOURCE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      {isLoading && <p style={messageStyle}>Cargando biblioteca…</p>}
      {error && <p style={messageStyle}>No se pudo cargar la biblioteca.</p>}
      {!isLoading && !error && resources?.length === 0 && <p style={messageStyle}>No hay recursos con estos filtros.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {resources?.map((resource) => (
          <div key={resource.id} style={{ display: 'grid', gap: 8 }}>
            <ResourceCard resource={resource} showStatus />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button size="sm" variant="secondary" onClick={() => setPublishId(resource.id)}><Send size={14} /> Publicar en curso</Button>
              {resource.status !== 'ARCHIVED' && <Button size="sm" variant="ghost" onClick={() => void archive(resource.id)}><Archive size={14} /> Archivar</Button>}
              <Button size="sm" variant="ghost" onClick={() => void remove(resource.id)}><Trash2 size={14} /> Eliminar</Button>
            </div>
          </div>
        ))}
      </div>

      <ResourceForm
        open={formOpen}
        organizationId={user?.organizationId ?? undefined}
        onClose={() => setFormOpen(false)}
        onCreated={async (payload) => {
          await mutations.create(payload);
          toast({ variant: 'success', message: 'Recurso guardado en la biblioteca.' });
          setFormOpen(false);
          await refresh();
        }}
        loading={mutations.isLoading}
      />
      <PublishModal
        resource={publishingResource}
        courses={courses ?? []}
        open={!!publishId}
        onClose={() => setPublishId(null)}
        onPublish={async (courseId, required) => {
          if (!publishingResource) return;
          await mutations.publishToCourse(publishingResource.id, { subjectId: courseId, required });
          toast({ variant: 'success', message: 'Recurso vinculado al curso.' });
          setPublishId(null);
          await refresh();
        }}
        loading={mutations.isLoading}
      />
    </div>
  );
}

function ResourceForm({ open, organizationId, onClose, onCreated, loading }: {
  open: boolean; organizationId?: string; onClose: () => void;
  onCreated: (payload: CreateLearningResourceInput) => Promise<void>; loading: boolean;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [source, setSource] = useState<'url' | 'file'>('url');
  const [files, setFiles] = useState<FileValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const uploading = files.some((file) => file.status === 'pending' || file.status === 'uploading');

  const close = () => { setForm(EMPTY_FORM); setFiles([]); setError(null); onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const fileId = files.find((file) => file.status === 'done')?.id;
    if (!form.title.trim()) return setError('El título es obligatorio.');
    if (uploading) return setError('Espera a que termine la subida del archivo.');
    if (source === 'file' && !fileId) return setError('Sube un archivo para continuar.');
    if (source === 'url' && !form.externalUrl.trim()) return setError('Introduce una URL externa válida.');
    try {
      await onCreated({
        title: form.title.trim(), type: form.type, description: form.description.trim() || undefined,
        authors: splitList(form.authors), publisher: form.publisher.trim() || undefined,
        isbn: form.isbn.trim() || undefined, language: form.language.trim() || undefined,
        license: form.license.trim() || undefined, tags: splitList(form.tags), status: form.status,
        ...(source === 'file' ? { fileId } : { externalUrl: form.externalUrl.trim() }),
      });
      setForm(EMPTY_FORM); setFiles([]);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el recurso.'); }
  };

  return (
    <Modal open={open} onClose={close} title="Nuevo recurso" footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button form="resource-form" type="submit" loading={loading} disabled={uploading}>Guardar recurso</Button></>}>
      <form id="resource-form" onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 12 }}>
        <Input label="Título" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={labelStyle}>Tipo<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LearningResourceType })} style={selectStyle}>{RESOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label style={labelStyle}>Estado<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LearningResourceStatus })} style={selectStyle}>{RESOURCE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        <Input label="Autores (separados por comas)" value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input label="Editorial" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
          <Input label="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
          <Input label="Idioma" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
        </div>
        <Input label="Licencia" value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} />
        <Input label="Etiquetas (separadas por comas)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Contenido</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
            <label><input type="radio" checked={source === 'url'} onChange={() => setSource('url')} /> Enlace externo</label>
            <label><input type="radio" checked={source === 'file'} onChange={() => setSource('file')} /> Archivo</label>
          </div>
          {source === 'url' ? <Input label="URL" type="url" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://…" required /> : organizationId && <FileUpload organizationId={organizationId} value={files} onChange={setFiles} maxFiles={1} hint="Sube un PDF, libro u otro material; conservará su nombre al descargar." />}
        </div>
        {error && <p style={{ color: 'var(--color-error)', margin: 0, fontSize: 13 }}>{error}</p>}
      </form>
    </Modal>
  );
}

function PublishModal({ resource, courses, open, onClose, onPublish, loading }: {
  resource: { id: string; title: string; subjects: { subjectId: string }[] } | null;
  courses: { id: string; title: string; course: { name: string; academicYear: string } }[]; open: boolean; onClose: () => void;
  onPublish: (courseId: string, required: boolean) => Promise<void>; loading: boolean;
}) {
  const [courseId, setCourseId] = useState('');
  const [required, setRequired] = useState(false);
  const eligible = courses.filter((course) => !resource?.subjects.some((link) => link.subjectId === course.id));
  const submit = async () => { if (courseId) await onPublish(courseId, required); };
  return <Modal open={open} onClose={onClose} title={`Publicar: ${resource?.title ?? ''}`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void submit()} loading={loading} disabled={!courseId}>Publicar</Button></>}>
    {eligible.length ? <div style={{ display: 'grid', gap: 12 }}><label style={labelStyle}>Curso<select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={selectStyle}><option value="">Selecciona un curso</option>{eligible.map((course) => <option key={course.id} value={course.id}>{`${course.title} · ${course.course.name} · ${course.course.academicYear}`}</option>)}</select></label><label style={{ fontSize: 14 }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Recurso obligatorio</label></div> : <p style={messageStyle}>No tienes otros cursos publicados donde vincular este recurso.</p>}
  </Modal>;
}

const searchStyle = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--color-border-primary)', borderRadius: 8, padding: '0 9px', color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)' } as const;
const inputStyle = { border: 'none', outline: 'none', padding: '9px 0', background: 'transparent', font: 'inherit', fontSize: 13, width: 190, color: 'var(--color-text-primary)' } as const;
const selectStyle = { border: '1px solid var(--color-border-primary)', borderRadius: 8, padding: '8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 13 } as const;
const labelStyle = { display: 'grid', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' } as const;
const messageStyle = { color: 'var(--color-text-secondary)', fontSize: 14 } as const;
