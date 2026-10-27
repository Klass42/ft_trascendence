import { useMemo, useState } from 'react';
import {
  Archive, CheckSquare, ChevronRight, Folder, FolderInput, FolderTree as FolderTreeIcon, FolderOpen, FolderPlus, MoreVertical, Pencil, Plus, Search, Send, Trash2,
} from 'lucide-react';
import { Button, ConfirmDialog, Dropdown, Input, Modal, Textarea, useToast } from '@/components/ui';
import { FileUpload, type FileValue } from '@/components/ui/FileUpload';
import {
  useAuth,
  useMySubjects,
  useResourceMutations,
  useResources,
  useResourceFolders,
  ApiError,
  subjectSelectorLabel,
  type CreateLearningResourceInput,
  type LearningResourceDTO,
  type ResourceFolderDTO,
  type LearningResourceStatus,
  type LearningResourceType,
} from '@/lib/api';
import { mapApiValidationErrors } from '@/lib/form-errors';
import { FolderTree } from './FolderTree';
import { ResourceCard } from './ResourceCard';
import styles from './ResourcesPage.module.css';
import { RESOURCE_STATUSES, RESOURCE_TYPES, splitList } from './resource-helpers';

const EMPTY_FORM = {
  title: '', description: '', type: 'DOCUMENT' as LearningResourceType,
  authors: '', publisher: '', isbn: '', language: '', license: '', tags: '',
  externalUrl: '', status: 'DRAFT' as LearningResourceStatus,
};

/** One pending confirmation shown through ConfirmDialog (never window.confirm). */
interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'primary' | 'danger';
  run: () => Promise<void>;
}

/** What a Publicar / Mover a… modal acts on: one item or the batch selection. */
interface Targets { resourceIds: string[]; folderIds: string[] }

const countLabel = ({ resourceIds, folderIds }: Targets) => [
  resourceIds.length && `${resourceIds.length} recurso${resourceIds.length === 1 ? '' : 's'}`,
  folderIds.length && `${folderIds.length} carpeta${folderIds.length === 1 ? '' : 's'}`,
].filter(Boolean).join(' y ');

/**
 * Staff-only organization catalogue (#26, Drive-style layout #22: fixed
 * folder-tree sidebar on the left, breadcrumbs + grid on the right): real folders with breadcrumbs, a ⋮
 * menu per item, a «Seleccionar» mode with batch actions and «Mover a…».
 * Files are uploaded first, then referenced by id.
 */
export function ResourcesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<LearningResourceType | ''>('');
  const [status, setStatus] = useState<LearningResourceStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [publishTargets, setPublishTargets] = useState<Targets | null>(null);
  const [moveTargets, setMoveTargets] = useState<Targets | null>(null);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' } | { mode: 'rename'; folder: ResourceFolderDTO } | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const { data: resources, isLoading, error, refresh } = useResources({ search, type: type || undefined, status: status || undefined });
  const { data: folders, refresh: refreshFolders } = useResourceFolders();
  // Staff also need to prepare resources for a draft course before it is
  // published; the backend still enforces course-level staff access.
  const { data: courses } = useMySubjects();
  const mutations = useResourceMutations();

  const canManage = (item: { createdById: string }) => user?.role === 'ADMIN' || item.createdById === user?.userId;
  const filtering = !!(search.trim() || type || status);
  const folderList = folders ?? [];
  const folderById = useMemo(() => new Map(folderList.map((f) => [f.id, f])), [folderList]);
  const breadcrumbs = useMemo(() => {
    const chain: ResourceFolderDTO[] = [];
    let cur = folderId ? folderById.get(folderId) : undefined;
    while (cur && !chain.includes(cur)) { chain.unshift(cur); cur = cur.parentId ? folderById.get(cur.parentId) : undefined; }
    return chain;
  }, [folderById, folderId]);
  // While searching/filtering, results span every folder; otherwise show the current folder.
  const visibleFolders = filtering ? [] : folderList.filter((f) => f.parentId === folderId);
  const visibleResources = (resources ?? []).filter((r) => filtering || (r.folderId ?? null) === folderId);

  const selection: Targets = { resourceIds: [...selectedResources], folderIds: [...selectedFolders] };
  const selectionCount = selection.resourceIds.length + selection.folderIds.length;
  const clearSelection = () => { setSelectedResources(new Set()); setSelectedFolders(new Set()); };
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id); else next.delete(id);
    setter(next);
  };
  const reloadAll = async () => { await Promise.all([refresh(), refreshFolders()]); };
  const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

  const openFolder = (id: string | null) => { setFolderId(id); clearSelection(); setTreeOpen(false); };

  const askArchive = (targets: Targets) => {
    const ids = targets.resourceIds.filter((id) => resources?.find((r) => r.id === id)?.status !== 'ARCHIVED');
    if (ids.length === 0) {
      toast({ variant: 'info', message: 'No hay recursos sin archivar en la selección (las carpetas no se archivan).' });
      return;
    }
    setConfirm({
      title: 'Archivar recursos',
      message: `Se archivarán ${countLabel({ resourceIds: ids, folderIds: [] })}.${targets.folderIds.length ? ' Las carpetas seleccionadas no se archivan.' : ''}`,
      confirmLabel: 'Archivar',
      variant: 'primary',
      run: async () => {
        let ok = 0;
        for (const id of ids) {
          try { await mutations.update(id, { status: 'ARCHIVED' }); ok += 1; } catch { /* reported below */ }
        }
        toast({ variant: ok === ids.length ? 'success' : 'error', message: `Archivados ${ok} de ${ids.length} recursos.` });
      },
    });
  };

  const askDelete = (targets: Targets) => {
    const single = targets.resourceIds.length + targets.folderIds.length === 1;
    setConfirm({
      title: single ? (targets.folderIds.length ? 'Eliminar carpeta' : 'Eliminar recurso') : 'Eliminar selección',
      message: `Se eliminarán ${countLabel(targets)} de la biblioteca.`
        + (targets.folderIds.length ? ' El contenido de las carpetas eliminadas pasa a la raíz.' : '')
        + ' Los archivos almacenados no se borrarán.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
      run: async () => {
        try {
          if (single && targets.resourceIds.length) await mutations.remove(targets.resourceIds[0]);
          else if (single) await mutations.removeFolder(targets.folderIds[0]);
          else await mutations.batchDelete(targets);
          toast({ variant: 'success', message: `Eliminados ${countLabel(targets)}.` });
          if (targets.folderIds.includes(folderId ?? '')) setFolderId(null);
        } catch (err) {
          toast({ variant: 'error', message: errorMessage(err, 'No se pudo eliminar.') });
        }
      },
    });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.run();
      clearSelection();
      await reloadAll();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  // Publish = loop over existing endpoints (resources one by one, folders as live links).
  const publish = async (targets: Targets, courseId: string, required: boolean) => {
    let ok = 0;
    const total = targets.resourceIds.length + targets.folderIds.length;
    for (const id of targets.resourceIds) {
      try { await mutations.publishToCourse(id, { subjectId: courseId, required }); ok += 1; } catch { /* counted */ }
    }
    for (const id of targets.folderIds) {
      try { await mutations.publishFolderToCourse(id, { subjectId: courseId, required }); ok += 1; } catch { /* counted */ }
    }
    toast({
      variant: ok === total ? 'success' : 'error',
      message: ok === total ? `Publicados ${countLabel(targets)} en el curso.` : `Publicados ${ok} de ${total} elementos.`,
    });
    setPublishTargets(null);
    clearSelection();
    await reloadAll();
  };

  const move = async (targets: Targets, destination: string | null) => {
    let ok = 0;
    const total = targets.resourceIds.length + targets.folderIds.length;
    for (const id of targets.resourceIds) {
      try { await mutations.update(id, { folderId: destination }); ok += 1; } catch { /* counted */ }
    }
    for (const id of targets.folderIds) {
      try { await mutations.updateFolder(id, { parentId: destination }); ok += 1; } catch { /* counted */ }
    }
    toast({ variant: ok === total ? 'success' : 'error', message: ok === total ? `Movidos ${countLabel(targets)}.` : `Movidos ${ok} de ${total} elementos.` });
    setMoveTargets(null);
    clearSelection();
    await reloadAll();
  };

  const resourceMenu = (resource: LearningResourceDTO) => {
    const one: Targets = { resourceIds: [resource.id], folderIds: [] };
    const manage = canManage(resource);
    return (
      <Dropdown
        trigger={<><MoreVertical size={18} aria-hidden="true" /><span style={visuallyHidden}>Acciones de {resource.title}</span></>}
        items={[
          { label: 'Publicar en curso', icon: <Send size={16} />, onClick: () => setPublishTargets(one) },
          { label: 'Archivar', icon: <Archive size={16} />, onClick: () => askArchive(one), disabled: !manage || resource.status === 'ARCHIVED' },
          { label: 'Mover a…', icon: <FolderInput size={16} />, onClick: () => setMoveTargets(one), disabled: !manage },
          { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: () => askDelete(one), danger: true, disabled: !manage },
        ]}
        align="right"
      />
    );
  };

  const folderMenu = (folder: ResourceFolderDTO) => {
    const one: Targets = { resourceIds: [], folderIds: [folder.id] };
    const manage = canManage(folder);
    return (
      <Dropdown
        trigger={<><MoreVertical size={18} aria-hidden="true" /><span style={visuallyHidden}>Acciones de {folder.name}</span></>}
        items={[
          { label: 'Abrir', icon: <FolderOpen size={16} />, onClick: () => openFolder(folder.id) },
          { label: 'Publicar en curso', icon: <Send size={16} />, onClick: () => setPublishTargets(one) },
          { label: 'Renombrar', icon: <Pencil size={16} />, onClick: () => setFolderModal({ mode: 'rename', folder }), disabled: !manage },
          { label: 'Mover a…', icon: <FolderInput size={16} />, onClick: () => setMoveTargets(one), disabled: !manage },
          { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: () => askDelete(one), danger: true, disabled: !manage },
        ]}
        align="right"
      />
    );
  };

  const publishTitle = publishTargets
    ? (publishTargets.resourceIds.length + publishTargets.folderIds.length === 1
      ? (resources?.find((r) => r.id === publishTargets.resourceIds[0])?.title ?? folderById.get(publishTargets.folderIds[0])?.name ?? '')
      : countLabel(publishTargets))
    : '';
  // Hide courses already linked when publishing a single item.
  const publishExclude = publishTargets && publishTargets.resourceIds.length + publishTargets.folderIds.length === 1
    ? (resources?.find((r) => r.id === publishTargets.resourceIds[0])?.subjects.map((l) => l.subjectId)
      ?? folderById.get(publishTargets.folderIds[0])?.subjects.map((l) => l.subjectId) ?? [])
    : [];

  return (
    <div style={{ padding: '28px 40px', maxWidth: 1360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Biblioteca</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)' }}>Recursos reutilizables de la organización: libros, documentos, enlaces y multimedia.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant={selectMode ? 'primary' : 'secondary'} onClick={() => { setSelectMode(!selectMode); clearSelection(); }}>
            <CheckSquare size={16} /> {selectMode ? 'Terminar selección' : 'Seleccionar'}
          </Button>
          <Button variant="secondary" onClick={() => setFolderModal({ mode: 'create' })}><FolderPlus size={16} /> Nueva carpeta</Button>
          <Button onClick={() => setFormOpen(true)}><Plus size={16} /> Nuevo recurso</Button>
        </div>
      </div>

      <div className={styles.layout}>
      <div>
        <div className={styles.sidebarToggle}><Button size="sm" variant="secondary" onClick={() => setTreeOpen(!treeOpen)} aria-expanded={treeOpen} aria-controls="library-folder-tree">
          <FolderTreeIcon size={14} /> {treeOpen ? 'Ocultar carpetas' : 'Carpetas'}
        </Button></div>
        <aside id="library-folder-tree" className={`${styles.sidebar} ${treeOpen ? '' : styles.sidebarCollapsed}`}>
          <FolderTree folders={folderList} activeId={filtering ? null : folderId} onOpen={(id) => { openFolder(id); if (filtering) { setSearch(''); setType(''); setStatus(''); } }} />
        </aside>
      </div>
      <div className={styles.main}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={searchStyle}><Search size={15} /><input aria-label="Buscar biblioteca" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, autor o etiqueta" style={inputStyle} /></label>
        <select aria-label="Tipo de recurso" value={type} onChange={(e) => setType(e.target.value as LearningResourceType | '')} style={selectStyle}>
          <option value="">Todos los tipos</option>{RESOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select aria-label="Estado de recurso" value={status} onChange={(e) => setStatus(e.target.value as LearningResourceStatus | '')} style={selectStyle}>
          <option value="">Todos los estados</option>{RESOURCE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <nav aria-label="Ruta de carpetas" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 14, marginBottom: 16 }}>
        {filtering ? (
          <span style={{ color: 'var(--color-text-secondary)' }}>Resultados en todas las carpetas</span>
        ) : (
          <>
            <button type="button" style={crumbStyle} onClick={() => openFolder(null)}>Biblioteca</button>
            {breadcrumbs.map((folder) => (
              <span key={folder.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ChevronRight size={14} aria-hidden="true" />
                <button type="button" style={crumbStyle} onClick={() => openFolder(folder.id)} aria-current={folder.id === folderId ? 'page' : undefined}>{folder.name}</button>
              </span>
            ))}
          </>
        )}
      </nav>

      {selectMode && (
        <div role="toolbar" aria-label="Acciones sobre la selección" style={batchBarStyle}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{selectionCount ? `${countLabel(selection)} seleccionados` : 'Nada seleccionado'}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" disabled={!selectionCount} onClick={() => setPublishTargets(selection)}><Send size={14} /> Publicar</Button>
            <Button size="sm" variant="secondary" disabled={!selection.resourceIds.length} onClick={() => askArchive(selection)}><Archive size={14} /> Archivar</Button>
            <Button size="sm" variant="secondary" disabled={!selectionCount} onClick={() => setMoveTargets(selection)}><FolderInput size={14} /> Mover a…</Button>
            <Button size="sm" variant="danger" disabled={!selectionCount} onClick={() => askDelete(selection)}><Trash2 size={14} /> Eliminar</Button>
          </div>
        </div>
      )}

      {isLoading && <p style={messageStyle}>Cargando biblioteca…</p>}
      {error && <p style={messageStyle}>No se pudo cargar la biblioteca.</p>}
      {!isLoading && !error && visibleResources.length === 0 && visibleFolders.length === 0 && (
        <p style={messageStyle}>{filtering ? 'No hay recursos con estos filtros.' : 'Esta carpeta está vacía.'}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {visibleFolders.map((folder) => {
          const manage = canManage(folder);
          return (
            <article key={folder.id} style={folderCardStyle}>
              {selectMode && (
                <input
                  type="checkbox"
                  aria-label={`Seleccionar carpeta ${folder.name}`}
                  checked={selectedFolders.has(folder.id)}
                  disabled={!manage}
                  title={manage ? undefined : 'No puedes gestionar esta carpeta'}
                  onChange={(e) => toggle(selectedFolders, setSelectedFolders, folder.id, e.target.checked)}
                />
              )}
              <button type="button" onClick={() => openFolder(folder.id)} style={folderOpenStyle}>
                <Folder size={22} aria-hidden="true" style={{ color: 'var(--color-accent-primary)', flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{folder.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {folder._count.resources} recursos · {folder._count.children} subcarpetas
                    {folder.subjects.length > 0 && ` · publicada en ${folder.subjects.map((l) => l.subject.title).join(', ')}`}
                  </span>
                </span>
              </button>
              {folderMenu(folder)}
            </article>
          );
        })}
        {visibleResources.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            showStatus
            actions={resourceMenu(resource)}
            selection={selectMode ? {
              checked: selectedResources.has(resource.id),
              disabled: !canManage(resource),
              onChange: (on) => toggle(selectedResources, setSelectedResources, resource.id, on),
            } : undefined}
          />
        ))}
      </div>
      </div>
      </div>

      <ResourceForm
        open={formOpen}
        organizationId={user?.organizationId ?? undefined}
        onClose={() => setFormOpen(false)}
        onCreated={async (payload) => {
          await mutations.create({ ...payload, ...(folderId && { folderId }) });
          toast({ variant: 'success', message: 'Recurso guardado en la biblioteca.' });
          setFormOpen(false);
          await reloadAll();
        }}
        loading={mutations.isLoading}
      />
      <PublishModal
        title={publishTitle}
        hasFolders={!!publishTargets?.folderIds.length}
        excludeSubjectIds={publishExclude}
        courses={courses ?? []}
        open={!!publishTargets}
        onClose={() => setPublishTargets(null)}
        onPublish={async (courseId, required) => { if (publishTargets) await publish(publishTargets, courseId, required); }}
        loading={mutations.isLoading}
      />
      <MoveModal
        open={!!moveTargets}
        targets={moveTargets}
        folders={folderList}
        onClose={() => setMoveTargets(null)}
        onMove={async (destination) => { if (moveTargets) await move(moveTargets, destination); }}
        loading={mutations.isLoading}
      />
      <FolderNameModal
        state={folderModal}
        onClose={() => setFolderModal(null)}
        loading={mutations.isLoading}
        onSave={async (name) => {
          try {
            if (folderModal?.mode === 'rename') await mutations.updateFolder(folderModal.folder.id, { name });
            else await mutations.createFolder({ name, ...(folderId && { parentId: folderId }) });
            toast({ variant: 'success', message: folderModal?.mode === 'rename' ? 'Carpeta renombrada.' : 'Carpeta creada.' });
            setFolderModal(null);
            await refreshFolders();
          } catch (err) {
            toast({ variant: 'error', message: errorMessage(err, 'No se pudo guardar la carpeta.') });
          }
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        loading={busy}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirm(null)}
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
  const [titleError, setTitleError] = useState<string | undefined>();
  const uploading = files.some((file) => file.status === 'pending' || file.status === 'uploading');

  const close = () => { setForm(EMPTY_FORM); setFiles([]); setError(null); onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setTitleError(undefined);
    const isBook = form.type === 'BOOK';
    const effectiveSource = form.type === 'LINK' ? 'url' : source;
    const fileId = files.find((file) => file.status === 'done')?.id;
    if (!form.title.trim()) return setError('El título es obligatorio.');
    if (form.title.trim().length > 200) return setTitleError('El título no puede superar los 200 caracteres.');
    if (uploading) return setError('Espera a que termine la subida del archivo.');
    if (effectiveSource === 'file' && !fileId) return setError('Sube un archivo para continuar.');
    if (effectiveSource === 'url' && !form.externalUrl.trim()) return setError('Introduce una URL externa válida.');
    try {
      await onCreated({
        title: form.title.trim(), type: form.type, description: form.description.trim() || undefined,
        authors: splitList(form.authors), publisher: isBook ? form.publisher.trim() || undefined : undefined,
        isbn: isBook ? form.isbn.trim() || undefined : undefined, language: form.language.trim() || undefined,
        license: form.license.trim() || undefined, tags: splitList(form.tags), status: form.status,
        ...(effectiveSource === 'file' ? { fileId } : { externalUrl: form.externalUrl.trim() }),
      });
      setForm(EMPTY_FORM); setFiles([]);
    } catch (err) {
      if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        setTitleError(mapped.fields.title);
        setError(mapped.form ?? null);
      } else {
        setError('No se pudo crear el recurso. Revisa los datos e inténtalo de nuevo.');
      }
    }
  };

  return (
    <Modal open={open} onClose={close} title="Nuevo recurso" footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button form="resource-form" type="submit" loading={loading} disabled={uploading}>Guardar recurso</Button></>}>
      <form id="resource-form" onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 12 }}>
        <Input label="Título" required maxLength={200} value={form.title} error={titleError} onChange={(e) => { setForm({ ...form, title: e.target.value }); setTitleError(undefined); }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={labelStyle}>Tipo<select value={form.type} onChange={(e) => { const nextType = e.target.value as LearningResourceType; setForm({ ...form, type: nextType, ...(nextType !== 'BOOK' && { isbn: '', publisher: '' }) }); if (nextType === 'LINK') { setSource('url'); setFiles([]); } }} style={selectStyle}>{RESOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label style={labelStyle}>Estado<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LearningResourceStatus })} style={selectStyle}>{RESOURCE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        <Input label="Autores (separados por comas)" value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {form.type === 'BOOK' && <Input label="Editorial" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />}
          {form.type === 'BOOK' && <Input label="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />}
          <Input label="Idioma" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
        </div>
        <Input label="Licencia" value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} />
        <Input label="Etiquetas (separadas por comas)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Contenido</div>
          {form.type !== 'LINK' && <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
            <label><input type="radio" checked={source === 'url'} onChange={() => setSource('url')} /> Enlace externo</label>
            <label><input type="radio" checked={source === 'file'} onChange={() => setSource('file')} /> Archivo</label>
          </div>}
          {form.type === 'LINK' || source === 'url' ? <Input label="URL" type="url" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://…" required /> : organizationId && <FileUpload organizationId={organizationId} value={files} onChange={setFiles} maxFiles={1} hint="Sube un PDF, libro u otro material; conservará su nombre al descargar." />}
        </div>
        {error && <p style={{ color: 'var(--color-error)', margin: 0, fontSize: 13 }}>{error}</p>}
      </form>
    </Modal>
  );
}

function PublishModal({ title, hasFolders, excludeSubjectIds, courses, open, onClose, onPublish, loading }: {
  title: string; hasFolders: boolean; excludeSubjectIds: string[];
  courses: { id: string; title: string; course: { name: string; academicYear: string } }[]; open: boolean; onClose: () => void;
  onPublish: (courseId: string, required: boolean) => Promise<void>; loading: boolean;
}) {
  const [courseId, setCourseId] = useState('');
  const [required, setRequired] = useState(false);
  const eligible = courses.filter((course) => !excludeSubjectIds.includes(course.id));
  const submit = async () => { if (courseId) { await onPublish(courseId, required); setCourseId(''); } };
  return <Modal open={open} onClose={onClose} title={`Publicar: ${title}`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void submit()} loading={loading} disabled={!courseId}>Publicar</Button></>}>
    {eligible.length ? <div style={{ display: 'grid', gap: 12 }}>
      <label style={labelStyle}>Curso<select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={selectStyle}><option value="">Selecciona un curso</option>{eligible.map((course) => <option key={course.id} value={course.id}>{subjectSelectorLabel(course)}</option>)}</select></label>
      <label style={{ fontSize: 14 }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Recurso obligatorio</label>
      {hasFolders && <p style={{ ...messageStyle, margin: 0 }}>Las carpetas quedan vinculadas: lo que añadas después dentro (también en subcarpetas) aparecerá en el curso automáticamente.</p>}
    </div> : <p style={messageStyle}>No tienes otros cursos publicados donde vincular este recurso.</p>}
  </Modal>;
}

/** «Mover a…» — the only way to move items (no drag & drop, #26). */
function MoveModal({ open, targets, folders, onClose, onMove, loading }: {
  open: boolean; targets: Targets | null; folders: ResourceFolderDTO[]; onClose: () => void;
  onMove: (destination: string | null) => Promise<void>; loading: boolean;
}) {
  const [destination, setDestination] = useState('');
  // A folder cannot go inside itself or its own subfolders.
  const blocked = useMemo(() => {
    const out = new Set<string>(targets?.folderIds ?? []);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; }
    }
    return out;
  }, [folders, targets]);
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (f: ResourceFolderDTO) => {
    const parts = [f.name];
    let cur = f.parentId ? byId.get(f.parentId) : undefined;
    while (cur && parts.length < 20) { parts.unshift(cur.name); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return parts.join(' / ');
  };
  const options = folders.filter((f) => !blocked.has(f.id)).map((f) => ({ id: f.id, label: pathOf(f) })).sort((a, b) => a.label.localeCompare(b.label));
  const submit = async () => { await onMove(destination || null); setDestination(''); };
  return <Modal open={open} onClose={onClose} title={`Mover ${targets ? countLabel(targets) : ''}`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void submit()} loading={loading}>Mover</Button></>}>
    <label style={labelStyle}>Destino<select value={destination} onChange={(e) => setDestination(e.target.value)} style={selectStyle}>
      <option value="">Biblioteca (raíz)</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select></label>
  </Modal>;
}

function FolderNameModal({ state, onClose, onSave, loading }: {
  state: { mode: 'create' } | { mode: 'rename'; folder: ResourceFolderDTO } | null;
  onClose: () => void; onSave: (name: string) => Promise<void>; loading: boolean;
}) {
  const [name, setName] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = state ? (state.mode === 'rename' ? state.folder.id : 'create') : null;
  if (key !== lastKey) { setLastKey(key); setName(state?.mode === 'rename' ? state.folder.name : ''); }
  const submit = (event?: React.FormEvent) => { event?.preventDefault(); if (name.trim()) void onSave(name.trim()); };
  return <Modal open={!!state} onClose={onClose} title={state?.mode === 'rename' ? 'Renombrar carpeta' : 'Nueva carpeta'} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button form="folder-form" type="submit" loading={loading} disabled={!name.trim()}>Guardar</Button></>}>
    <form id="folder-form" onSubmit={submit}><Input label="Nombre" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></form>
  </Modal>;
}

const searchStyle = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--color-border-primary)', borderRadius: 8, padding: '0 9px', color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)' } as const;
const inputStyle = { border: 'none', outline: 'none', padding: '9px 0', background: 'transparent', font: 'inherit', fontSize: 13, width: 190, color: 'var(--color-text-primary)' } as const;
const selectStyle = { border: '1px solid var(--color-border-primary)', borderRadius: 8, padding: '8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 13 } as const;
const labelStyle = { display: 'grid', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' } as const;
const messageStyle = { color: 'var(--color-text-secondary)', fontSize: 14 } as const;
const crumbStyle = { border: 'none', background: 'none', padding: '2px 4px', color: 'var(--color-accent-primary)', cursor: 'pointer', font: 'inherit', fontWeight: 600 } as const;
const batchBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 16, border: '1px solid var(--color-border-primary)', borderRadius: 10, background: 'var(--color-bg-tertiary)' } as const;
const folderCardStyle = { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border-primary)', borderRadius: 12, padding: '12px 14px', background: 'var(--color-bg-secondary)' } as const;
const folderOpenStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', minWidth: 0 } as const;
const visuallyHidden = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 } as const;
