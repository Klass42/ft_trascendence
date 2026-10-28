/**
 * Shared hard-delete flow for /admin/users/:id and /org/members (#104).
 *
 * Decision (#104): deleting a member is a HARD DELETE of the account (no
 * soft-deactivate). Both screens use the same endpoint (DELETE /users/:id),
 * the same irreversible confirmation copy and the same toast feedback.
 */
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { ConfirmDialog, useToast } from '@/components/ui';

export interface DeleteUserTarget {
  id: string;
  name: string;
  email?: string;
}

interface Props {
  target: DeleteUserTarget | null;
  onCancel: () => void;
  onDeleted: (id: string) => void;
}

export const DELETE_USER_COPY = {
  action: 'Eliminar cuenta',
  title: 'Eliminar cuenta definitivamente',
  confirm: 'Sí, eliminar definitivamente',
  hint:
    'Eliminar quita la cuenta de forma permanente (no es una desactivación). Esta acción no se puede deshacer.',
};

export function DeleteUserDialog({ target, onCancel, onDeleted }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!target) return;
    setLoading(true);
    try {
      await apiClient.delete(`/users/${target.id}`);
      toast({ variant: 'success', message: `Cuenta de ${target.name} eliminada definitivamente.` });
      onDeleted(target.id);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'No se pudo eliminar la cuenta',
        message: err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.',
      });
      onCancel();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={target !== null}
      title={DELETE_USER_COPY.title}
      variant="danger"
      loading={loading}
      confirmLabel={DELETE_USER_COPY.confirm}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
      message={
        target ? (
          <>
            Vas a eliminar la cuenta de <strong>{target.name}</strong>
            {target.email ? ` (${target.email})` : ''}. Se borrarán su cuenta, sesiones y datos
            asociados (matrículas, entregas, mensajes del foro…). <strong>Esta acción es
            irreversible.</strong>
          </>
        ) : null
      }
    />
  );
}
