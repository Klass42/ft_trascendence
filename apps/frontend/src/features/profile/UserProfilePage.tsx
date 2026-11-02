import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { SearchX, UserCheck, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Spinner, useToast } from '@/components/ui';
import { ApiError, apiClient, useAuth } from '@/lib/api';
import type { GlobalRole } from '@/lib/api';
import { usePresence } from '@/features/presence';
import { formatDate } from '@/lib/format';
import type { PublicProfileDTO } from './userProfileTypes';
import styles from './UserProfilePage.module.css';

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

/** Same shape the backend accepts for ids (ParseIdPipe), so malformed urls never hit the API. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Public profile of another member of the organization (`/users/:id`). */
export function UserProfilePage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { friends, isLoading: isPresenceLoading, hasError: presenceError, refresh: refreshPresence } = usePresence();
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isSelf = user?.userId === id;
  const validId = ID_PATTERN.test(id);

  const load = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    setLoadError(null);
    try {
      setProfile(await apiClient.get<PublicProfileDTO>(`/users/${encodeURIComponent(id)}/profile`));
    } catch (err) {
      setProfile(null);
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setNotFound(true);
      else setLoadError('No se pudo cargar el perfil. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isSelf || !validId) return;
    void load();
  }, [isSelf, validId, load]);

  useEffect(() => {
    if (profile) document.title = `${profile.name} · Klass`;
  }, [profile]);

  if (isSelf) return <Navigate to="/profile" replace />;

  if (!validId || notFound) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<SearchX size={24} />}
          title="Usuario no encontrado"
          titleAs="h1"
          description="Esta persona no existe o no pertenece a tu organización."
          action={<Button as={Link} to="/friends">Ir a Amigos</Button>}
        />
      </div>
    );
  }

  if (isLoading && !profile) {
    return <div className={styles.loading}><Spinner size="lg" label="Cargando perfil" /></div>;
  }

  if (!profile) {
    return (
      <div className={styles.page}>
        <h1 className={styles.srOnly}>Perfil</h1>
        <div className={styles.error} role="alert">{loadError}</div>
        <Button variant="outline" onClick={() => void load()}>Reintentar</Button>
      </div>
    );
  }

  const presence = friends.find((friend) => friend.id === profile.id);
  const isFriend = profile.relation === 'FRIEND';

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    setIsBusy(true);
    try {
      await action();
      await Promise.all([load(), refreshPresence()]);
      toast({ variant: 'success', message: success });
    } catch {
      toast({ variant: 'error', message: failure });
    } finally {
      setIsBusy(false);
    }
  };

  const sendRequest = () => run(
    async () => { await apiClient.post(`/users/${profile.id}/friend`); },
    `Solicitud enviada a ${profile.name}`,
    'No se pudo enviar la solicitud. Puede que ya exista una solicitud pendiente.',
  );

  const acceptRequest = () => run(
    async () => { await apiClient.patch(`/friendships/${profile.friendshipId}`, { status: 'ACCEPTED' }); },
    `Ahora eres amigo de ${profile.name}`,
    'No se pudo aceptar la solicitud. Actualiza la página e inténtalo de nuevo.',
  );

  const removeFriend = async () => {
    await run(
      async () => { await apiClient.delete(`/friendships/${profile.friendshipId}`); },
      `Has eliminado a ${profile.name} de tus amigos`,
      'No se pudo eliminar a esta persona.',
    );
    setConfirmRemove(false);
  };

  return (
    <div className={styles.page}>
      <Card padding="lg">
        <header className={styles.header}>
          <Avatar src={profile.avatarUrl} size="lg" alt={`Foto de ${profile.name}`} />
          <div className={styles.identity}>
            <h1 className={styles.name}>{profile.name}</h1>
            <div className={styles.badges}>
              <Badge variant="accent">{ROLE_LABEL[profile.role]}</Badge>
              {isFriend && (
                presence ? (
                  <Badge variant={presence.online ? 'success' : 'neutral'} dot aria-live="polite">
                    {presence.online ? 'En línea' : 'Desconectado'}
                  </Badge>
                ) : (
                  <Badge variant="neutral" aria-live="polite">
                    {isPresenceLoading ? 'Comprobando' : presenceError ? 'Estado no disponible' : 'Desconectado'}
                  </Badge>
                )
              )}
            </div>
          </div>
          <div className={styles.action}>
            {profile.relation === 'NONE' && (
              <Button leftIcon={<UserPlus size={16} />} loading={isBusy} onClick={() => void sendRequest()}>
                Añadir
              </Button>
            )}
            {profile.relation === 'PENDING_SENT' && <Badge variant="neutral">Solicitud enviada</Badge>}
            {profile.relation === 'PENDING_RECEIVED' && profile.friendshipId && (
              <Button leftIcon={<UserCheck size={16} />} loading={isBusy} onClick={() => void acceptRequest()}>
                Aceptar solicitud
              </Button>
            )}
            {isFriend && profile.friendshipId && (
              <>
                <Badge variant="success">Amigos</Badge>
                <Button variant="outline" disabled={isBusy} onClick={() => setConfirmRemove(true)}>
                  Eliminar amistad
                </Button>
              </>
            )}
          </div>
        </header>

        <section className={styles.section} aria-labelledby="about-heading">
          <h2 id="about-heading" className={styles.sectionTitle}>Sobre {profile.name}</h2>
          {profile.bio ? (
            <p className={styles.bio}>{profile.bio}</p>
          ) : (
            <p className={styles.muted}>Esta persona todavía no ha escrito nada sobre sí misma.</p>
          )}
          <dl className={styles.details}>
            {profile.email && (
              <div>
                <dt>Correo electrónico</dt>
                <dd>{profile.email}</dd>
              </div>
            )}
            <div>
              <dt>Miembro desde</dt>
              <dd>{formatDate(profile.memberSince)}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="shared-heading">
          <h2 id="shared-heading" className={styles.sectionTitle}>Cohortes en común</h2>
          {profile.sharedCourses.length === 0 ? (
            <p className={styles.muted}>No compartís ninguna cohorte.</p>
          ) : (
            <ul className={styles.courseList}>
              {profile.sharedCourses.map((course) => (
                <li key={course.id}>
                  <Link className={styles.courseLink} to={`/courses/${encodeURIComponent(course.id)}`}>
                    {course.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        title="Eliminar amistad"
        message={`¿Quieres eliminar a ${profile.name} de tus amigos?`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={isBusy}
        onConfirm={() => void removeFriend()}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
