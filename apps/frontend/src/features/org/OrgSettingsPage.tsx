import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Users } from 'lucide-react';
import { apiClient, useIsAdmin } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, Input, Spinner } from '@/components/ui';
import { useOrg } from '@/lib/api/hooks';
import type { OrgDTO } from './types';
import styles from './OrgSettingsPage.module.css';

export function OrgSettingsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data, isLoading, error } = useOrg();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [localData, setLocalData] = useState<OrgDTO | null>(null);

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
              label="Logo URL"
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
    </div>
  );
}
