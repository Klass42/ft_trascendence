import { useMemo, useState } from 'react';
import {
  Archive, CheckSquare, FileSearch, FolderX, ChevronRight, Folder, FolderInput, FolderTree as FolderTreeIcon, FolderOpen, FolderPlus, MoreVertical, Pencil, Plus, Search, Send, Trash2,
} from 'lucide-react';
import { Button, ConfirmDialog, Dropdown, EmptyState, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
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
  type UpdateLearningResourceInput,
} from '@/lib/api';
import { mapApiValidationErrors } from '@/lib/form-errors';
import { FolderTree } from './FolderTree';
import { ResourceCard } from './ResourceCard';
import styles from './ResourcesPage.module.css';
import { RESOURCE_STATUSES, RESOURCE_TYPES, countLabel, doneLabel, splitList, validateExternalUrl, type Targets } from './resource-helpers';

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
  const [editing, setEditing] = useState<LearningResourceDTO | null>(null);
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
        toast({ variant: ok === ids.length ? 'success' : 'error', message: ok === ids.length ? `${doneLabel('Archivad', { resourceIds: ids, folderIds: [] })}.` : `Archivados ${ok} de ${ids.length} recursos.` });
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
          toast({ variant: 'success', message: `${doneLabel('Eliminad', targets)}.` });
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
      message: ok === total ? `${doneLabel('Publicad', targets)} en el curso.` : `Publicados ${ok} de ${total} elementos.`,
    });
    setPublishTargets(null);
    clearSelection();
    await reloadAll();
  };

  // #109: publishing a Borrador to a course used to "succeed" while students
  // never saw it. Ask first; on confirm publish the resource(s) and link them.
  const requestPublish = (targets: Targets, courseId: string, required: boolean) => {
    const drafts = targets.resourceIds.filter((id) => resources?.find((r) => r.id === id)?.status === 'DRAFT');
    if (drafts.length === 0) return publish(targets, courseId, required);
    setConfirm({
      title: drafts.length === 1 && targets.resourceIds.length === 1 ? 'Recurso en borrador' : 'Recursos en borrador',
      message: drafts.length === 1
        ? '¿Publicar el recurso y añadirlo al curso? Está en Borrador y, si no se publica, el alumnado no lo verá.'
        : `¿Publicar los recursos y añadirlos al curso? ${drafts.length} están en Borrador y, si no se publican, el alumnado no los verá.`,
      confirmLabel: 'Publicar y añadir',
      variant: 'primary',
      run: async () => {
        const failed = new Set<string>();
        for (const id of drafts) {
          try { await mutations.update(id, { status: 'PUBLISHED' }); } catch { failed.add(id); }
        }
        if (failed.size) {
          toast({ variant: 'error', message: `No se pudieron publicar ${failed.size} recurso${failed.size === 1 ? '' : 's'}; no se han añadido al curso.` });
        }
        const rest = { ...targets, resourceIds: targets.resourceIds.filter((id) => !failed.has(id)) };
        if (rest.resourceIds.length + rest.folderIds.length) await publish(rest, courseId, required);
        else setPublishTargets(null);
      },
    });
    return Promise.resolve();
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
    toast({ variant: ok === total ? 'success' : 'error', message: ok === total ? `${doneLabel('Movid', targets)}.` : `Movidos ${ok} de ${total} elementos.` });
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
          { label: 'Editar', icon: <Pencil size={16} />, onClick: () => setEditing(resource), disabled: !manage },
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
          <Button variant={selectMode ? 'primary' : 'secondary'} leftIcon={<CheckSquare size={16} />} onClick={() => { setSelectMode(!selectMode); clearSelection(); }}>
            {selectMode ? 'Terminar selección' : 'Seleccionar'}
          </Button>
          <Button variant="secondary" leftIcon={<FolderPlus size={16} />} onClick={() => setFolderModal({ mode: 'create' })}>Nueva carpeta</Button>
          <Button leftIcon={<Plus size={16} />} onClick={() => setFormOpen(true)}>Nuevo recurso</Button>
        </div>
      </div>

      <div className={styles.layout}>
      <div>
        <div className={styles.sidebarToggle}><Button size="sm" variant="secondary" leftIcon={<FolderTreeIcon size={14} />} onClick={() => setTreeOpen(!treeOpen)} aria-expanded={treeOpen} aria-controls="library-folder-tree">
          {treeOpen ? 'Ocultar carpetas' : 'Carpetas'}
        </Button></div>
        <aside id="library-folder-tree" aria-label="Carpetas de la biblioteca" className={`${styles.sidebar} ${treeOpen ? '' : styles.sidebarCollapsed}`}>
          <FolderTree folders={folderList} activeId={filtering ? null : folderId} onOpen={(id) => { openFolder(id); if (filtering) { setSearch(''); setType(''); setStatus(''); } }} />
        </aside>
      </div>
      <div className={styles.main}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className={styles.filterSearch}><Input type="search" aria-label="Buscar biblioteca" leftIcon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, autor o etiqueta" /></div>
        <div className={styles.filterSelect}><Select aria-label="Tipo de recurso" value={type} onChange={(e) => setType(e.target.value as LearningResourceType | '')}
          options={[{ value: '', label: 'Todos los tipos' }, ...RESOURCE_TYPES]} /></div>
        <div className={styles.filterSelect}><Select aria-label="Estado de recurso" value={status} onChange={(e) => setStatus(e.target.value as LearningResourceStatus | '')}
          options={[{ value: '', label: 'Todos los estados' }, ...RESOURCE_STATUSES]} /></div>
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
            <Button size="sm" variant="secondary" leftIcon={<Send size={14} />} disabled={!selectionCount} onClick={() => setPublishTargets(selection)}>Publicar</Button>
            <Button size="sm" variant="secondary" leftIcon={<Archive size={14} />} disabled={!selection.resourceIds.length} onClick={() => askArchive(selection)}>Archivar</Button>
            <Button size="sm" variant="secondary" leftIcon={<FolderInput size={14} />} disabled={!selectionCount} onClick={() => setMoveTargets(selection)}>Mover a…</Button>
            <Button size="sm" variant="danger" leftIcon={<Trash2 size={14} />} disabled={!selectionCount} onClick={() => askDelete(selection)}>Eliminar</Button>
          </div>
        </div>
      )}

      {isLoading && <p style={messageStyle}>Cargando biblioteca…</p>}
      {error && <EmptyState title="No se pudo cargar la biblioteca" description="Inténtalo de nuevo en unos segundos." action={<Button variant="secondary" onClick={() => void reloadAll()}>Reintentar</Button>} />}
      {!isLoading && !error && visibleResources.length === 0 && visibleFolders.length === 0 && (
        filtering ? (
          <EmptyState
            icon={<FileSearch size={28} />}
            title="Sin resultados"
            description="Ningún recurso coincide con la búsqueda o los filtros."
            action={<Button variant="secondary" onClick={() => { setSearch(''); setType(''); setStatus(''); }}>Limpiar filtros</Button>}
          />
        ) : (
          <EmptyState
            icon={<FolderX size={28} />}
            title={folderId ? 'Esta carpeta está vacía' : 'La biblioteca está vacía'}
            description={folderId ? 'Añade un recurso o crea una subcarpeta aquí.' : 'Crea el primer recurso o una carpeta para organizarlos.'}
            action={<Button leftIcon={<Plus size={16} />} onClick={() => setFormOpen(true)}>Nuevo recurso</Button>}
          />
        )
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
        open={formOpen || !!editing}
        resource={editing}
        organizationId={user?.organizationId ?? undefined}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onCreated={async (payload) => {
          if (editing) {
            await mutations.update(editing.id, toUpdatePayload(payload, editing));
            toast({ variant: 'success', message: 'Recurso actualizado.' });
            setEditing(null);
          } else {
            await mutations.create({ ...payload, ...(folderId && { folderId }) });
            toast({ variant: 'success', message: 'Recurso guardado en la biblioteca.' });
            setFormOpen(false);
          }
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
        onPublish={async (courseId, required) => { if (publishTargets) await requestPublish(publishTargets, courseId, required); }}
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

/** Edit payload: optional text fields cleared in the form are sent as null. */
function toUpdatePayload(payload: CreateLearningResourceInput, existing: LearningResourceDTO): UpdateLearningResourceInput {
  return {
    title: payload.title, type: payload.type, status: payload.status,
    description: payload.description ?? null, authors: payload.authors ?? [], tags: payload.tags ?? [],
    publisher: payload.publisher ?? null, isbn: payload.isbn ?? null,
    language: payload.language ?? null, license: payload.license ?? null,
    ...(payload.fileId ? { fileId: payload.fileId, externalUrl: null }
      : payload.externalUrl ? { externalUrl: payload.externalUrl, fileId: null }
      : { fileId: existing.fileId ?? null }),
  };
}

function formFromResource(r: LearningResourceDTO): typeof EMPTY_FORM {
  return {
    title: r.title, description: r.description ?? '', type: r.type,
    authors: r.authors.join(', '), publisher: r.publisher ?? '', isbn: r.isbn ?? '',
    language: r.language ?? '', license: r.license ?? '', tags: r.tags.join(', '),
    externalUrl: r.externalUrl ?? '', status: r.status,
  };
}

function ResourceForm({ open, resource, organizationId, onClose, onCreated, loading }: {
  open: boolean; resource?: LearningResourceDTO | null; organizationId?: string; onClose: () => void;
  onCreated: (payload: CreateLearningResourceInput) => Promise<void>; loading: boolean;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [source, setSource] = useState<'url' | 'file'>('url');
  const [files, setFiles] = useState<FileValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [urlError, setUrlError] = useState<string | undefined>();
  // Re-seed when switching between «Nuevo» and editing a given resource.
  const formKey = open ? (resource?.id ?? 'new') : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (formKey !== lastKey) {
    setLastKey(formKey);
    if (formKey) {
      setForm(resource ? formFromResource(resource) : EMPTY_FORM);
      setSource(resource?.file && !resource.externalUrl ? 'file' : 'url');
      setFiles([]); setError(null); setTitleError(undefined); setUrlError(undefined);
    }
  }
  const editing = !!resource;
  const keepsFile = editing && !!resource?.file;
  const uploading = files.some((file) => file.status === 'pending' || file.status === 'uploading');

  const close = () => { setForm(EMPTY_FORM); setFiles([]); setError(null); setUrlError(undefined); onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setTitleError(undefined);
    setUrlError(undefined);
    const isBook = form.type === 'BOOK';
    const effectiveSource = form.type === 'LINK' ? 'url' : source;
    const fileId = files.find((file) => file.status === 'done')?.id ?? (keepsFile && effectiveSource === 'file' ? resource?.fileId ?? undefined : undefined);
    if (!form.title.trim()) return setError('El título es obligatorio.');
    if (form.title.trim().length > 200) return setTitleError('El título no puede superar los 200 caracteres.');
    if (uploading) return setError('Espera a que termine la subida del archivo.');
    if (effectiveSource === 'file' && !fileId) return setError('Sube un archivo para continuar.');
    if (effectiveSource === 'url') {
      const urlProblem = validateExternalUrl(form.externalUrl);
      if (urlProblem) return setUrlError(urlProblem);
    }
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
        const urlMsg = (err.errors ?? []).find((m) => /url|enlace/i.test(m));
        if (urlMsg) setUrlError('La URL debe empezar por http:// o https:// y ser una dirección web válida.');
        setError(urlMsg && !mapped.fields.title && Object.keys(mapped.fields).length === 0 ? null : (mapped.form ?? null));
      } else {
        setError(`No se pudo ${editing ? 'guardar' : 'crear'} el recurso. ${err instanceof Error && err.message ? err.message : 'Revisa los datos e inténtalo de nuevo.'}`);
      }
    }
  };

  return (
    <Modal open={open} onClose={close} title={editing ? 'Editar recurso' : 'Nuevo recurso'} footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button form="resource-form" type="submit" loading={loading} disabled={uploading}>{editing ? 'Guardar cambios' : 'Guardar recurso'}</Button></>}>
      <form id="resource-form" noValidate onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 12 }}>
        <Input label="Título" required maxLength={200} value={form.title} error={titleError} onChange={(e) => { setForm({ ...form, title: e.target.value }); setTitleError(undefined); }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}><Select label="Tipo" value={form.type} options={RESOURCE_TYPES} onChange={(e) => { const nextType = e.target.value as LearningResourceType; setForm({ ...form, type: nextType, ...(nextType !== 'BOOK' && { isbn: '', publisher: '' }) }); if (nextType === 'LINK') { setSource('url'); setFiles([]); setUrlError(undefined); } }} /></div>
          <div style={{ flex: '1 1 160px' }}><Select label="Estado" value={form.status} options={RESOURCE_STATUSES} onChange={(e) => setForm({ ...form, status: e.target.value as LearningResourceStatus })} /></div>
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
          {form.type === 'LINK' || source === 'url' ? <Input label="URL" type="url" inputMode="url" value={form.externalUrl} error={urlError} onChange={(e) => { setForm({ ...form, externalUrl: e.target.value }); setUrlError(undefined); }} placeholder="https://…" required /> : <>
            {keepsFile && files.length === 0 && <p style={{ ...messageStyle, margin: '0 0 6px' }}>Archivo actual: {resource?.file?.originalName}. Sube otro para reemplazarlo.</p>}
            {organizationId && <FileUpload organizationId={organizationId} value={files} onChange={setFiles} maxFiles={1} hint="Sube un PDF, libro u otro material; conservará su nombre al descargar." />}
          </>}
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
      <Select label="Curso" value={courseId} onChange={(e) => setCourseId(e.target.value)} options={[{ value: '', label: 'Selecciona un curso' }, ...eligible.map((course) => ({ value: course.id, label: subjectSelectorLabel(course) }))]} />
      <label style={{ fontSize: 14 }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Recurso obligatorio</label>
      {hasFolders && <p style={{ ...messageStyle, margin: 0 }}>Las carpetas quedan vinculadas: lo que añadas después dentro (también en subcarpetas) aparecerá en el curso automáticamente.</p>}
    </div> : <EmptyState title="No hay cursos disponibles" description="No tienes otros cursos donde vincular este recurso." />}
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
    <Select label="Destino" value={destination} onChange={(e) => setDestination(e.target.value)}
      options={[{ value: '', label: 'Biblioteca (raíz)' }, ...options.map((o) => ({ value: o.id, label: o.label }))]} />
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

const messageStyle = { color: 'var(--color-text-secondary)', fontSize: 14 } as const;
const crumbStyle = { border: 'none', background: 'none', padding: '2px 4px', color: 'var(--color-accent-primary)', cursor: 'pointer', font: 'inherit', fontWeight: 600 } as const;
const batchBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 16, border: '1px solid var(--color-border-primary)', borderRadius: 10, background: 'var(--color-bg-tertiary)' } as const;
const folderCardStyle = { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border-primary)', borderRadius: 12, padding: '12px 14px', background: 'var(--color-bg-secondary)' } as const;
const folderOpenStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', minWidth: 0 } as const;
const visuallyHidden = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 } as const;
