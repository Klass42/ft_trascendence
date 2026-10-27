/**
 * DeleteUserAccountDialog — shared, irreversible account deletion flow (#104).
 *
 * Used by /admin/users/:id and /org/members so both screens show the same
 * copy, the same explicit confirmation and the same success/error toast.
 * Deletion is a hard delete in the backend (prisma.user.delete): there is no
 * soft-deactivate by design.
 */
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { ConfirmDialog, useToast } from '@/components/ui';

export const DELETE_ACCOUNT_LABEL = 'Eliminar cuenta';

export function deleteAccountMessage(name: string): string {
  return `Se borrará la cuenta de ${name} de forma permanente. No podrá volver a entrar y sus datos asociados se eliminarán. Esta acción no se puede deshacer.`;
}

export interface DeleteUserAccountDialogProps {
  /** User to delete; dialog is open while non-null. */
  user: { id: string; name: string } | null;
  /** DELETE endpoint for this user. */
  endpoint: string;
  onCancel: () => void;
  onDeleted: (userId: string) => void;
}

export function DeleteUserAccountDialog({
  user,
  endpoint,
  onCancel,
  onDeleted,
}: DeleteUserAccountDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!user) return;
    setLoading(true);
    try {
      await apiClient.delete(endpoint);
      toast({ variant: 'success', message: `Cuenta de ${user.name} eliminada.` });
      onDeleted(user.id);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.';
      toast({ variant: 'error', title: 'No se pudo eliminar la cuenta', message: msg });
      onCancel();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={user !== null}
      title="Eliminar cuenta definitivamente"
      message={user ? deleteAccountMessage(user.name) : ''}
      confirmLabel="Sí, eliminar cuenta"
      cancelLabel="Cancelar"
      variant="danger"
      loading={loading}
      onConfirm={() => void handleConfirm()}
      onCancel={() => !loading && onCancel()}
    />
  );
}
