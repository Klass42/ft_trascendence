import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Users } from 'lucide-react';
import { apiClient, useIsAdmin } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, ConfirmDialog, Input, Spinner, useToast } from '@/components/ui';
import { useOrg } from '@/lib/api/hooks';
import type { OrgDTO } from './types';
import styles from './OrgSettingsPage.module.css';

export function OrgSettingsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const { data, isLoading, error } = useOrg();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [localData, setLocalData] = useState<OrgDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isRequestingDelete, setIsRequestingDelete] = useState(false);
  const [isCancellingDelete, setIsCancellingDelete] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [checkingDeleteStatus, setCheckingDeleteStatus] = useState(true);
  const [deleteStatusError, setDeleteStatusError] = useState<string | null>(null);

  const refreshDeleteStatus = useCallback(async () => {
    setCheckingDeleteStatus(true);
    setDeleteStatusError(null);
    try {
      const status = await apiClient.get<{ pending: boolean }>(
        '/organizations/me/deletion-request',
      );
      setDeleteRequested(status.pending);
    } catch {
      setDeleteStatusError('No se pudo consultar el estado de la solicitud.');
    } finally {
      setCheckingDeleteStatus(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setCheckingDeleteStatus(false);
      return;
    }
    void refreshDeleteStatus();
  }, [isAdmin, refreshDeleteStatus]);

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size="lg" label="Cargando organización..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.center}>
        <p>No se pudo cargar la organización.</p>
      </div>
    );
  }

  const displayData = localData ?? data;

  function startEditing() {
    setEditName(displayData.name);
    setEditLogoUrl(displayData.logoUrl ?? '');
    setEditError(null);
    setFieldErrors({});
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditError(null);
    setFieldErrors({});
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!editName.trim()) errors.name = 'El nombre es obligatorio.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const patch: Record<string, string> = {};
    if (editName.trim() !== displayData.name) patch.name = editName.trim();
    const newLogo = editLogoUrl.trim() || null;
    if (newLogo !== displayData.logoUrl) patch.logoUrl =
      newLogo === null ? '' : newLogo;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const updated = await apiClient.patch<OrgDTO>(
        `/organizations/${displayData.id}`,
        patch,
      );
      setLocalData(updated);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isValidationError && err.errors?.length) {
          const next: Record<string, string> = {};
          for (const msg of err.errors) {
            const lower = msg.toLowerCase();
            if (lower.includes('name')) next.name = msg;
            else if (lower.includes('logo')) next.logoUrl = msg;
          }
          setFieldErrors(next);
          if (Object.keys(next).length === 0) setEditError(err.message);
        } else {
          setEditError(err.message);
        }
      } else {
        setEditError('No se pudo conectar con el servidor.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRequestDeletion() {
    setIsRequestingDelete(true);
    try {
      const result = await apiClient.post<{ notified: number; alreadyPending: boolean }>(
        '/organizations/me/deletion-request',
      );
      setConfirmDelete(false);
      setDeleteRequested(true);
      toast({
        message: result.alreadyPending
          ? 'El superadmin ya tiene una solicitud pendiente.'
          : 'Solicitud enviada al superadmin.',
        variant: 'success',
      });
    } catch (err) {
      toast({
        message: err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud.',
        variant: 'error',
      });
    } finally {
      setIsRequestingDelete(false);
    }
  }


  async function handleCancelDeletionRequest() {
    setIsCancellingDelete(true);
    try {
      const result = await apiClient.delete<{ cancelled: number; wasPending: boolean }>(
        '/organizations/me/deletion-request',
      );
      setDeleteRequested(false);
      toast({
        message: result.wasPending
          ? 'Solicitud de borrado cancelada.'
          : 'No había ninguna solicitud pendiente.',
        variant: 'success',
      });
    } catch (err) {
      toast({
        message: err instanceof ApiError ? err.message : 'No se pudo cancelar la solicitud.',
        variant: 'error',
      });
    } finally {
      setIsCancellingDelete(false);
    }
  }


  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Organización</h1>

      {editError && (
        <div className={styles.banner} role="alert">
          {editError}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.logoPreview}>
          {displayData.logoUrl ? (
            <img
              src={displayData.logoUrl}
              alt=""
              className={styles.logoImg}
            />
          ) : (
            displayData.name.charAt(0).toUpperCase()
          )}
        </div>

        {isEditing ? (
          <div className={styles.form}>
            <Input
              label="Nombre"
              value={editName}
              maxLength={100}
              onChange={(e) => {
                setEditName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((p) => {
                    const n = { ...p };
                    delete n.name;
                    return n;
                  });
                }
              }}
              error={fieldErrors.name}
            />
            <Input
              label="URL del logo"
              value={editLogoUrl}
              onChange={(e) => {
                setEditLogoUrl(e.target.value);
                if (fieldErrors.logoUrl) {
                  setFieldErrors((p) => {
                    const n = { ...p };
                    delete n.logoUrl;
                    return n;
                  });
                }
              }}
              error={fieldErrors.logoUrl}
              hint="URL de la imagen del logo (opcional)"
            />
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={isSaving}
                onClick={handleSave}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.info}>
              <div className={styles.orgName}>{displayData.name}</div>
              <div className={styles.slug}>slug: {displayData.slug}</div>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Pencil size={14} />}
                onClick={startEditing}
              >
                Editar
              </Button>
            )}
          </>
        )}
      </div>

      {isAdmin && (
        <div className={styles.membersSection}>
          <Button
            variant="secondary"
            leftIcon={<Users size={18} />}
            onClick={() => navigate('/org/members')}
          >
            Miembros
          </Button>
        </div>
      )}

      {isAdmin && (
        <section className={styles.dangerZone} aria-labelledby="org-deletion-request">
          <h2 id="org-deletion-request" className={styles.dangerTitle}>Borrar organización</h2>
          <p className={styles.dangerText}>
            Un administrador no puede borrar la organización. La solicitud llega al superadmin,
            que es quien puede eliminarla.
          </p>
          {deleteStatusError && (
            <div className={styles.deleteStatusError} role="alert">
              <span>{deleteStatusError}</span>
              <Button variant="ghost" size="sm" onClick={() => void refreshDeleteStatus()}>
                Reintentar
              </Button>
            </div>
          )}
          <div className={styles.dangerActions}>
            <Button
              variant="danger"
              leftIcon={<Trash2 size={16} />}
              disabled={deleteRequested || checkingDeleteStatus || isRequestingDelete || isCancellingDelete}
              onClick={() => setConfirmDelete(true)}
            >
              {checkingDeleteStatus
                ? 'Consultando solicitud…'
                : deleteRequested
                  ? 'Solicitud pendiente'
                  : 'Solicitar borrado'}
            </Button>
            {deleteRequested && !checkingDeleteStatus && (
              <Button
                variant="secondary"
                disabled={isCancellingDelete || isRequestingDelete}
                onClick={() => void handleCancelDeletionRequest()}
              >
                {isCancellingDelete ? 'Cancelando…' : 'Cancelar solicitud'}
              </Button>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Solicitar borrado"
        message={`Esto no borra «${displayData.name}». Se avisará al superadmin para que decida si eliminarla.`}
        confirmLabel="Enviar solicitud"
        variant="danger"
        loading={isRequestingDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleRequestDeletion}
      />
    </div>
  );
}
