import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Inbox, Search, Send, UserPlus, Users } from 'lucide-react';
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, Input, Spinner, useToast } from '@/components/ui';
import { apiClient } from '@/lib/api';
import type { GlobalRole } from '@/lib/api';
import { usePresence } from '@/features/presence';
import { useNotifications } from '@/features/notifications';
import styles from './FriendsPage.module.css';

interface FriendPerson {
  friendshipId: string;
  id: string;
  name: string;
  avatarUrl: string | null;
}

type FriendRelation = 'NONE' | 'FRIEND' | 'PENDING_SENT' | 'PENDING_RECEIVED';

interface SearchResult {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: GlobalRole;
  /** Name of a cohort the person shares with the current user, if any. */
  sharedCourse: string | null;
  relation: FriendRelation;
  /** Friendship row behind `relation` (null when there is none). */
  friendshipId: string | null;
}

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

interface FriendshipListDTO {
  friends: FriendPerson[];
  receivedRequests: FriendPerson[];
  sentRequests: FriendPerson[];
}

const EMPTY_LIST: FriendshipListDTO = {
  friends: [],
  receivedRequests: [],
  sentRequests: [],
};

export function FriendsPage() {
  const { toast } = useToast();
  const {
    friends: presenceFriends,
    isLoading: isPresenceLoading,
    hasError: presenceError,
    refresh: refreshPresence,
  } = usePresence();
  const { friendsUpdate } = useNotifications();
  const searchInput = useRef<HTMLInputElement>(null);
  const lastQuery = useRef<string | null>(null);
  const previousPresenceIds = useRef<string | null>(null);
  const [list, setList] = useState<FriendshipListDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<FriendPerson | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const next = await apiClient.get<FriendshipListDTO>('/friendships');
      setList(next);
      setLoadError(null);
    } catch {
      setLoadError('No se pudieron cargar tus amistades. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const onlineById = useMemo(
    () => new Map(presenceFriends.map((friend) => [friend.id, friend.online])),
    [presenceFriends],
  );
  const presenceIds = presenceFriends.map((friend) => friend.id).sort().join(',');

  useEffect(() => {
    if (isPresenceLoading) return;
    if (previousPresenceIds.current !== null && previousPresenceIds.current !== presenceIds) {
      void refreshList();
    }
    previousPresenceIds.current = presenceIds;
  }, [isPresenceLoading, presenceIds, refreshList]);

  const fetchSearch = useCallback(async (normalizedQuery: string) => {
    const results = await apiClient.get<SearchResult[]>(
      `/users/search?q=${encodeURIComponent(normalizedQuery)}`,
    );
    lastQuery.current = normalizedQuery;
    setSearchResults(results);
  }, []);

  /** Re-runs the last search without flicker so relations stay accurate. */
  const refreshSearch = useCallback(async () => {
    if (lastQuery.current === null) return;
    try {
      await fetchSearch(lastQuery.current);
    } catch {
      // Keep showing the previous results; the lists above are still correct.
    }
  }, [fetchSearch]);

  const searchUsers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setQueryError('Escribe al menos 2 caracteres.');
      setSearchResults(null);
      return;
    }

    setQueryError(undefined);
    setSearchError(null);
    setIsSearching(true);
    try {
      await fetchSearch(normalizedQuery);
    } catch {
      setSearchError('No se pudo completar la búsqueda. Inténtalo de nuevo.');
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  // A FRIEND_REQUEST notification (new request received, or ours accepted)
  // arrives over the socket: refresh the lists, presence and visible results.
  const lastFriendsUpdate = useRef(friendsUpdate?.receivedAt ?? null);
  useEffect(() => {
    if (!friendsUpdate || friendsUpdate.receivedAt === lastFriendsUpdate.current) return;
    lastFriendsUpdate.current = friendsUpdate.receivedAt;
    void refreshList();
    void refreshPresence();
    void refreshSearch();
  }, [friendsUpdate, refreshList, refreshPresence, refreshSearch]);

  const sendRequest = async (person: SearchResult) => {
    setBusyId(person.id);
    try {
      const friendship = await apiClient.post<{ id: string }>(`/users/${person.id}/friend`);
      setSearchResults((current) => current?.map((result) => (
        result.id === person.id
          ? { ...result, relation: 'PENDING_SENT', friendshipId: friendship?.id ?? null }
          : result
      )) ?? null);
      await refreshList();
      toast({ variant: 'success', message: `Solicitud enviada a ${person.name}` });
    } catch {
      toast({
        variant: 'error',
        message: 'No se pudo enviar la solicitud. Puede que ya exista una solicitud pendiente.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const acceptRequest = async (request: Pick<FriendPerson, 'friendshipId' | 'name'>) => {
    setBusyId(request.friendshipId);
    try {
      await apiClient.patch(`/friendships/${request.friendshipId}`, { status: 'ACCEPTED' });
      await refreshList();
      await refreshPresence();
      await refreshSearch();
      toast({ variant: 'success', message: `Ahora eres amigo de ${request.name}` });
    } catch {
      toast({
        variant: 'error',
        message: 'No se pudo aceptar la solicitud. Actualiza la lista e inténtalo de nuevo.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const removeRequest = async (request: FriendPerson, successMessage: string) => {
    setBusyId(request.friendshipId);
    try {
      await apiClient.delete(`/friendships/${request.friendshipId}`);
      await refreshList();
      await refreshSearch();
      toast({ variant: 'success', message: successMessage });
    } catch {
      toast({
        variant: 'error',
        message: 'No se pudo actualizar la solicitud.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const removeFriend = async () => {
    if (!friendToRemove) return;
    setBusyId(friendToRemove.friendshipId);
    try {
      await apiClient.delete(`/friendships/${friendToRemove.friendshipId}`);
      setFriendToRemove(null);
      await refreshList();
      await refreshPresence();
      await refreshSearch();
      toast({ variant: 'success', message: `Has eliminado a ${friendToRemove.name} de tus amigos` });
    } catch {
      toast({
        variant: 'error',
        message: 'No se pudo eliminar a esta persona.',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading && !list) {
    return <div className={styles.loading}><Spinner size="lg" label="Cargando amigos" /></div>;
  }

  if (loadError && !list) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Amigos</h1>
        <div className={styles.error} role="alert">{loadError}</div>
        <Button variant="outline" onClick={() => { setIsLoading(true); void refreshList(); }}>
          Reintentar
        </Button>
      </div>
    );
  }

  const data = list ?? EMPTY_LIST;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Amigos</h1>
          <p className={styles.subtitle}>Busca personas de tu organización y conecta con ellas.</p>
        </div>
        {data.friends.length > 0 && (
          <Badge variant="success" dot>
            {data.friends.length} {data.friends.length === 1 ? 'amigo' : 'amigos'} · {presenceFriends.filter((friend) => friend.online).length} en línea
          </Badge>
        )}
      </header>

      <section className={styles.searchSection} aria-labelledby="search-heading">
        <h2 id="search-heading" className={styles.sectionTitle}>Buscar personas</h2>
        <form className={styles.searchForm} onSubmit={searchUsers} noValidate>
          <Input
            ref={searchInput}
            label="Nombre o correo electrónico"
            type="search"
            value={query}
            minLength={2}
            maxLength={100}
            autoComplete="off"
            placeholder="Por ejemplo, Lucía"
            leftIcon={<Search size={18} />}
            error={queryError}
            onChange={(event) => {
              setQuery(event.target.value);
              setQueryError(undefined);
              setSearchResults(null);
              setSearchError(null);
            }}
          />
          <Button type="submit" loading={isSearching} leftIcon={<Search size={16} />}>
            Buscar
          </Button>
        </form>
        {searchError && <p className={styles.error} role="alert">{searchError}</p>}
        {searchResults && (
          <div className={styles.searchResults} aria-live="polite">
            <h3 className={styles.subheading}>Resultados</h3>
            {searchResults.length === 0 ? (
              <EmptyState
                icon={<Search size={24} />}
                title="No encontramos personas"
                description="Prueba con otro nombre o correo de tu organización."
              />
            ) : (
              <ul className={styles.peopleList}>
                {searchResults.map((person) => (
                  <li className={styles.personRow} key={person.id}>
                    <div className={styles.personInfo}>
                      <Avatar src={person.avatarUrl} size="md" />
                      <div className={styles.personText}>
                        <div className={styles.personName}>{person.name}</div>
                        <div className={styles.muted}>
                          {ROLE_LABEL[person.role]}
                          {person.sharedCourse && ` · Cohorte: ${person.sharedCourse}`}
                        </div>
                      </div>
                    </div>
                    {person.relation === 'FRIEND' && <Badge variant="success">Amigos</Badge>}
                    {person.relation === 'PENDING_SENT' && <Badge variant="neutral">Solicitud enviada</Badge>}
                    {person.relation === 'PENDING_RECEIVED' && person.friendshipId && (
                      <Button
                        size="sm"
                        loading={busyId === person.friendshipId}
                        disabled={busyId !== null && busyId !== person.friendshipId}
                        onClick={() => void acceptRequest({ friendshipId: person.friendshipId as string, name: person.name })}
                        aria-label={`Aceptar a ${person.name} en los resultados`}
                      >
                        Aceptar
                      </Button>
                    )}
                    {person.relation === 'NONE' && (
                      <Button
                        size="sm"
                        loading={busyId === person.id}
                        disabled={busyId !== null && busyId !== person.id}
                        leftIcon={<UserPlus size={16} />}
                        onClick={() => void sendRequest(person)}
                      >
                        Añadir
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {loadError && (
        <div className={styles.statusError} role="alert">
          {loadError}
          <Button
            size="sm"
            variant="ghost"
            loading={isLoading}
            onClick={() => { setIsLoading(true); void refreshList(); }}
          >
            Reintentar
          </Button>
        </div>
      )}

      <div className={styles.requestGrid}>
        <section className={styles.section} aria-labelledby="received-heading">
          <div className={styles.sectionHeader}>
            <h2 id="received-heading" className={styles.sectionTitle}>Solicitudes recibidas</h2>
            {data.receivedRequests.length > 0 && <Badge variant="accent">{data.receivedRequests.length}</Badge>}
          </div>
          {data.receivedRequests.length === 0 ? (
            <EmptyState
              icon={<Inbox size={24} />}
              title="No tienes solicitudes pendientes"
              description="Cuando alguien quiera ser tu amigo, aparecerá aquí."
            />
          ) : (
            <ul className={styles.peopleList}>
              {data.receivedRequests.map((request) => (
                <li className={styles.personRow} key={request.friendshipId}>
                  <div className={styles.personInfo}>
                    <Avatar src={request.avatarUrl} size="md" />
                    <span className={styles.personName}>{request.name}</span>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      size="sm"
                      loading={busyId === request.friendshipId}
                      disabled={busyId !== null && busyId !== request.friendshipId}
                      onClick={() => void acceptRequest(request)}
                      aria-label={`Aceptar solicitud de ${request.name}`}
                    >
                      Aceptar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId !== null}
                      onClick={() => void removeRequest(request, 'Solicitud rechazada')}
                      aria-label={`Rechazar solicitud de ${request.name}`}
                    >
                      Rechazar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="sent-heading">
          <div className={styles.sectionHeader}>
            <h2 id="sent-heading" className={styles.sectionTitle}>Solicitudes enviadas</h2>
            {data.sentRequests.length > 0 && <Badge variant="neutral">{data.sentRequests.length}</Badge>}
          </div>
          {data.sentRequests.length === 0 ? (
            <EmptyState
              icon={<Send size={24} />}
              title="No has enviado solicitudes"
              description="Las solicitudes que envíes aparecerán aquí hasta que las respondan."
            />
          ) : (
            <ul className={styles.peopleList}>
              {data.sentRequests.map((request) => (
                <li className={styles.personRow} key={request.friendshipId}>
                  <div className={styles.personInfo}>
                    <Avatar src={request.avatarUrl} size="md" />
                    <div>
                      <div className={styles.personName}>{request.name}</div>
                      <div className={styles.muted}>Pendiente de respuesta</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === request.friendshipId}
                    disabled={busyId !== null && busyId !== request.friendshipId}
                    onClick={() => void removeRequest(request, 'Solicitud cancelada')}
                    aria-label={`Cancelar solicitud a ${request.name}`}
                  >
                    Cancelar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.section} aria-labelledby="friends-heading">
        <div className={styles.sectionHeader}>
          <h2 id="friends-heading" className={styles.sectionTitle}>Mis amigos</h2>
          {data.friends.length > 0 && <Badge variant="neutral">{data.friends.length}</Badge>}
        </div>
        {presenceError && (
          <div className={styles.statusError} role="status">
            No se pudo cargar el estado en línea.
            <Button size="sm" variant="ghost" loading={isPresenceLoading} onClick={() => void refreshPresence()}>
              Reintentar
            </Button>
          </div>
        )}
        {data.friends.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="Todavía no tienes amigos"
            description="Busca a alguien de tu organización para enviarle una solicitud."
            action={<Button variant="outline" onClick={() => searchInput.current?.focus()}>Buscar personas</Button>}
          />
        ) : (
          <ul className={styles.peopleList}>
            {data.friends.map((friend) => {
              const online = onlineById.get(friend.id) ?? false;
              return (
                <li className={styles.personRow} key={friend.friendshipId}>
                  <div className={styles.personInfo}>
                    <Avatar src={friend.avatarUrl} size="md" />
                    <span className={styles.personName}>{friend.name}</span>
                    <Badge variant={online ? 'success' : 'neutral'} dot aria-live="polite">
                      {isPresenceLoading ? 'Comprobando' : presenceError ? 'Estado no disponible' : online ? 'En línea' : 'Desconectado'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId !== null}
                    onClick={() => setFriendToRemove(friend)}
                    aria-label={`Eliminar a ${friend.name} de tus amigos`}
                  >
                    Eliminar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(friendToRemove)}
        title="Eliminar amigo"
        message={friendToRemove ? `¿Quieres eliminar a ${friendToRemove.name} de tus amigos?` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        loading={Boolean(friendToRemove && busyId === friendToRemove.friendshipId)}
        onConfirm={() => void removeFriend()}
        onCancel={() => setFriendToRemove(null)}
      />
    </div>
  );
}
