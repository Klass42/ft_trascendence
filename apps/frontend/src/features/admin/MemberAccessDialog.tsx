/**
 * #134: "Quitar de la organización" (deactivate) and "Reactivar", shared by
 * /admin/users and /org/members. Quitar never deletes the account: it uses
 * DELETE /organizations/:id/members/:userId, which keeps submissions, grades
 * and messages. Permanent deletion stays in DeleteUserDialog.
 */
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { ConfirmDialog, useToast } from '@/components/ui';

export interface MemberAccessTarget {
  id: string;
  name: string;
  email?: string;
  action: 'deactivate' | 'reactivate';
}

interface Props {
  organizationId: string | undefined;
  target: MemberAccessTarget | null;
  onCancel: () => void;
  onDone: (id: string, deactivatedAt: string | null) => void;
}

export const MEMBER_ACCESS_COPY = {
  deactivate: 'Quitar de la organización',
  reactivate: 'Reactivar',
  hint:
    'Quitar desactiva la cuenta: no puede entrar y sale de sus cohortes y asignaturas, pero se conservan sus entregas, notas y mensajes. Se puede reactivar. «Eliminar cuenta» (en la ficha del usuario) la borra definitivamente.',
};

export function MemberAccessDialog({ organizationId, target, onCancel, onDone }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const deactivate = target?.action === 'deactivate';

  async function handleConfirm() {
    if (!target || !organizationId) return;
    setLoading(true);
    try {
      if (deactivate) {
        await apiClient.delete(`/organizations/${organizationId}/members/${target.id}`);
        toast({ variant: 'success', message: `${target.name} ya no tiene acceso a la organización.` });
        onDone(target.id, new Date().toISOString());
      } else {
        await apiClient.post(`/organizations/${organizationId}/members/${target.id}/reactivate`);
        toast({ variant: 'success', message: `${target.name} vuelve a tener acceso.` });
        onDone(target.id, null);
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: deactivate ? 'No se pudo quitar a la persona' : 'No se pudo reactivar la cuenta',
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
      title={deactivate ? MEMBER_ACCESS_COPY.deactivate : 'Reactivar cuenta'}
      variant={deactivate ? 'danger' : 'primary'}
      loading={loading}
      confirmLabel={deactivate ? 'Sí, quitar' : 'Sí, reactivar'}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
      message={
        target ? (
          deactivate ? (
            <>
              <strong>{target.name}</strong>{target.email ? ` (${target.email})` : ''} dejará de poder
              entrar y se cerrarán sus sesiones. Sus matrículas, entregas, notas y mensajes se conservan
              (seguirá apareciendo en las calificaciones como cuenta desactivada) y podrás reactivarla más tarde.
            </>
          ) : (
            <>
              <strong>{target.name}</strong> podrá volver a entrar con su cuenta, sus matrículas y su historial.
            </>
          )
        ) : null
      }
    />
  );
}
