import { useState } from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
  Table,
  Tabs,
  useToast,
} from '@/components/ui';
import {
  useActivityMutations,
  useSaveAsTemplate,
  useTaskTemplates,
  useTeachingActivities,
} from '@/lib/api';
import type { ActivityDTO, TaskTemplateDTO, TeachingActivityDTO } from '@/lib/api';
import { formatDate } from '../assignments/helpers';
import { STATUS_BADGE } from './helpers';

interface Props {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onInstantiated: (activity: ActivityDTO) => void;
}

/**
 * Staff library: org templates and previous tasks. Instantiating copies blocks
 * into a new activity in `courseId` (attempts/grades stay on the source).
 */
export function TaskLibrary({ courseId, open, onClose, onInstantiated }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Biblioteca de tareas" size="lg">
      <Tabs
        tabs={[
          {
            id: 'templates',
            label: 'Plantillas',
            content: (
              <TemplatesTab
                courseId={courseId}
                onInstantiated={onInstantiated}
              />
            ),
          },
          {
            id: 'previous',
            label: 'Anteriores',
            content: (
              <PreviousTab
                courseId={courseId}
                onInstantiated={onInstantiated}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
}

function TemplatesTab({
  courseId,
  onInstantiated,
}: {
  courseId: string;
  onInstantiated: (activity: ActivityDTO) => void;
}) {
  const { toast } = useToast();
  const { data, isLoading, error, remove } = useTaskTemplates();
  const { createActivity, isLoading: creating } = useActivityMutations();
  const [pendingDelete, setPendingDelete] = useState<TaskTemplateDTO | null>(null);

  async function instantiate(template: TaskTemplateDTO) {
    try {
      const created = await createActivity(courseId, {
        title: template.title,
        description: template.description ?? undefined,
        templateId: template.id,
      });
      toast({ variant: 'success', message: 'Tarea creada desde la plantilla.' });
      onInstantiated(created);
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo instanciar la plantilla.',
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      toast({ variant: 'success', message: 'Plantilla eliminada.' });
      setPendingDelete(null);
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo borrar la plantilla.',
      });
    }
  }

  if (isLoading) return <Spinner size="md" label="Cargando plantillas…" />;
  if (error) {
    return (
      <p style={{ color: 'var(--color-error)' }}>
        No se pudieron cargar las plantillas.
      </p>
    );
  }

  return (
    <>
      <Table
        columns={[
          { key: 'title', header: 'Plantilla' },
          {
            key: 'blocks',
            header: 'Bloques',
            render: (row) =>
              Array.isArray(row.blocks) ? String(row.blocks.length) : '—',
          },
          {
            key: 'updatedAt',
            header: 'Actualizada',
            render: (row) => formatDate(row.updatedAt),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (row) => (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void instantiate(row)}
                  loading={creating}
                >
                  Usar en este curso
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingDelete(row)}
                >
                  Borrar
                </Button>
              </div>
            ),
          },
        ]}
        data={data ?? []}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            title="Sin plantillas todavía"
            description="Guarda una tarea como plantilla para reutilizar sus bloques."
          />
        }
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Borrar plantilla"
        message={`¿Borrar «${pendingDelete?.title}»? Las tareas ya creadas no se tocan.`}
        confirmLabel="Borrar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function PreviousTab({
  courseId,
  onInstantiated,
}: {
  courseId: string;
  onInstantiated: (activity: ActivityDTO) => void;
}) {
  const { toast } = useToast();
  const { data, isLoading, error } = useTeachingActivities();
  const { createActivity, isLoading: creating } = useActivityMutations();
  const { save, isLoading: saving } = useSaveAsTemplate();

  async function duplicate(row: TeachingActivityDTO) {
    try {
      const created = await createActivity(courseId, {
        title: row.title,
        sourceActivityId: row.id,
      });
      toast({ variant: 'success', message: 'Tarea duplicada en este curso.' });
      onInstantiated(created);
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo duplicar la tarea.',
      });
    }
  }

  async function saveTemplate(row: TeachingActivityDTO) {
    try {
      await save(row.id);
      toast({ variant: 'success', message: 'Guardada como plantilla.' });
    } catch (err) {
      toast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'No se pudo guardar la plantilla.',
      });
    }
  }

  if (isLoading) return <Spinner size="md" label="Cargando tareas anteriores…" />;
  if (error) {
    return (
      <p style={{ color: 'var(--color-error)' }}>
        No se pudieron cargar las tareas anteriores.
      </p>
    );
  }

  return (
    <Table
      columns={[
        {
          key: 'title',
          header: 'Tarea',
          render: (row) => (
            <div>
              <div>{row.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {row.courseTitle}
              </div>
            </div>
          ),
        },
        {
          key: 'status',
          header: 'Estado',
          render: (row) => {
            const s = STATUS_BADGE[row.status];
            return <Badge variant={s.variant} dot>{s.label}</Badge>;
          },
        },
        {
          key: 'final',
          header: 'Nota',
          render: (row) =>
            row.countsTowardFinal ? 'Cuenta' : (
              <Badge variant="neutral">Práctica</Badge>
            ),
        },
        {
          key: 'attempts',
          header: 'Intentos',
          render: (row) => String(row.attemptCount),
        },
        {
          key: 'actions',
          header: '',
          align: 'right',
          render: (row) => (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void duplicate(row)}
                loading={creating}
              >
                Duplicar aquí
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveTemplate(row)}
                loading={saving}
              >
                Guardar plantilla
              </Button>
            </div>
          ),
        },
      ]}
      data={data ?? []}
      rowKey={(row) => row.id}
      empty={
        <EmptyState
          title="Sin tareas anteriores"
          description="Cuando publiques tareas en tus cursos, aparecerán aquí para duplicarlas."
        />
      }
    />
  );
}
