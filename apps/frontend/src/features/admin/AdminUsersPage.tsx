import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, History, MailPlus, Pencil, RotateCcw, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { apiClient, useAuth } from '@/lib/api';
import type { GlobalRole } from '@/lib/api/types';
import { Badge, Button, EmptyState, Input, Select, Spinner, Table } from '@/components/ui';
import type { MemberDTO } from '@/features/org/types';
import { MemberAccessDialog, MEMBER_ACCESS_COPY, type MemberAccessTarget } from './MemberAccessDialog';
import styles from './AdminUsersPage.module.css';

type MemberStatus = 'active' | 'inactive' | 'pending';
type PaginatedMember = MemberDTO & { status: MemberStatus };

interface PaginatedMembers {
  data: PaginatedMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

function statusLabel(status: MemberStatus) {
  if (status === 'active') return 'Activo';
  if (status === 'pending') return 'Pendiente';
  return 'Inactivo';
}

function statusVariant(status: MemberStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const organizationId = user?.organizationId;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState<GlobalRole | ''>('');
  const [status, setStatus] = useState<MemberStatus | ''>('');
  const [account, setAccount] = useState<'' | 'active' | 'deactivated'>('');
  const [accessTarget, setAccessTarget] = useState<MemberAccessTarget | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<PaginatedMembers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!organizationId) {
      setIsLoading(false);
      setError(new Error('No se encontró la organización.'));
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (account) params.set('account', account);

    setIsLoading(true);
    setError(null);
    setResult(null);
    apiClient.get<PaginatedMembers>(`/organizations/${organizationId}/members?${params}`)
      .then((response) => {
        if (!cancelled) setResult(response);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [organizationId, debouncedSearch, role, status, account, page, pageSize, reloadCount]);

  const columns = useMemo(() => [
    { key: 'name', header: 'Nombre', render: (member: PaginatedMember) => <span className={styles.memberName} title={member.name}>{member.name}</span> },
    { key: 'email', header: 'Correo electrónico', render: (member: PaginatedMember) => <span className={styles.memberEmail} title={member.email}>{member.email}</span> },
    { key: 'role', header: 'Rol', render: (member: PaginatedMember) => <Badge variant="accent">{ROLE_LABEL[member.role]}</Badge> },
    { key: 'status', header: 'Estado', render: (member: PaginatedMember) => {
      if (member.deactivatedAt) return <Badge variant="neutral">Desactivada</Badge>;
      return <Badge variant={statusVariant(member.status)} dot>{statusLabel(member.status)}</Badge>;
    } },
    { key: 'actions', header: 'Acciones', align: 'right' as const, render: (member: PaginatedMember) => (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Pencil size={15} />}
          onClick={() => navigate(`/admin/users/${member.id}`)}
        >Editar</Button>
        {member.id !== user?.userId && accessButton(member)}
      </span>
    ) },
  ], [navigate, user?.userId]);

  function accessButton(member: PaginatedMember) {
    return member.deactivatedAt ? (
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<RotateCcw size={15} />}
        onClick={() => setAccessTarget({ id: member.id, name: member.name, email: member.email, action: 'reactivate' })}
      >{MEMBER_ACCESS_COPY.reactivate}</Button>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<UserMinus size={15} />}
        aria-label={`${MEMBER_ACCESS_COPY.deactivate}: ${member.name}`}
        onClick={() => setAccessTarget({ id: member.id, name: member.name, email: member.email, action: 'deactivate' })}
      >Quitar</Button>
    );
  }

  const hasFilters = Boolean(debouncedSearch || search.trim() || role || status || account);
  function clearFilters() {
    setSearch(''); setDebouncedSearch(''); setRole(''); setStatus(''); setAccount(''); setPage(1);
  }

  const totalPages = Math.max(result?.totalPages ?? 0, 1);
  const firstItem = result && result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastItem = result ? Math.min(result.page * result.pageSize, result.total) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>Busca y administra el acceso a la organización.</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" leftIcon={<History size={18} />} onClick={() => navigate('/admin/audit')}>Auditoría</Button>
          <Button variant="outline" leftIcon={<MailPlus size={18} />} onClick={() => navigate('/admin/users/invitations')}>Invitaciones pendientes</Button>
          <Button variant="outline" leftIcon={<FileUp size={18} />} onClick={() => navigate('/admin/users/import')}>Importar CSV</Button>
          <Button variant="outline" leftIcon={<UserPlus size={18} />} onClick={() => navigate('/admin/users/new')}>Crear usuario</Button>
          <Button
            variant="primary"
            leftIcon={<UserPlus size={18} />}
            onClick={() => navigate('/admin/users/invite')}
          >Invitar usuario</Button>
        </div>
      </header>

      <div className={styles.filters}>
        <Input
          label="Buscar usuarios"
          placeholder="Nombre o correo electrónico"
          value={search}
          maxLength={100}
          leftIcon={<Search size={18} />}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="Rol"
          value={role}
          onChange={(event) => { setRole(event.target.value as GlobalRole | ''); setPage(1); }}
          options={[
            { value: '', label: 'Todos los roles' },
            { value: 'ADMIN', label: 'Administrador' },
            { value: 'TEACHER', label: 'Profesor' },
            { value: 'STUDENT', label: 'Alumno' },
          ]}
        />
        <Select
          label="Estado"
          hint="Activo: presencia en los últimos cinco minutos. Pendiente: correo electrónico sin verificar."
          value={status}
          onChange={(event) => { setStatus(event.target.value as MemberStatus | ''); setPage(1); }}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
            { value: 'pending', label: 'Pendiente' },
          ]}
        />
        <Select
          label="Cuenta"
          hint="Desactivada: quitada de la organización; conserva su historial y se puede reactivar."
          value={account}
          onChange={(event) => { setAccount(event.target.value as '' | 'active' | 'deactivated'); setPage(1); }}
          options={[
            { value: '', label: 'Todas' },
            { value: 'active', label: 'Activas' },
            { value: 'deactivated', label: 'Desactivadas' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className={styles.loadingWrap}><Spinner size="lg" label="Cargando usuarios…" /></div>
      ) : error ? (
        <div className={styles.errorState} role="alert">
          <p>No se pudieron cargar los usuarios.</p>
          <Button variant="outline" onClick={() => setReloadCount((count) => count + 1)}>Reintentar</Button>
        </div>
      ) : (
        <>
          <div className={result?.data.length ? styles.desktopTable : undefined}>
            <Table
              columns={columns}
              data={result?.data ?? []}
              rowKey={(member) => member.id}
              empty={(
                <EmptyState
                  icon={<Users size={21} />}
                  title={hasFilters ? 'No hay resultados' : 'Aún no hay usuarios'}
                  description={hasFilters ? 'Ningún usuario coincide con la búsqueda o los filtros. Prueba con otro nombre, correo electrónico, rol o estado.' : 'Invita a las personas que participarán en esta organización.'}
                  action={hasFilters
                    ? <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
                    : <Button onClick={() => navigate('/admin/users/invite')}>Invitar usuario</Button>}
                />
              )}
            />
          </div>
          {result && result.data.length > 0 && (
            <div className={styles.mobileCards}>
              {result.data.map((member) => (
                <article key={member.id} className={styles.userCard}>
                  <div className={styles.userCardHeader}>
                    <h2 className={styles.userCardName}>{member.name}</h2>
                    <Badge variant="accent">{ROLE_LABEL[member.role]}</Badge>
                  </div>
                  <p className={styles.userCardEmail}>{member.email}</p>
                  <div className={styles.userCardMeta}>
                    <span>Estado</span>
                    <Badge variant={statusVariant(member.status)} dot>{statusLabel(member.status)}</Badge>
                  </div>
                  <div className={styles.userCardActions}>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Pencil size={15} />}
                      onClick={() => navigate(`/admin/users/${member.id}`)}
                    >Editar</Button>
                    {member.id !== user?.userId && accessButton(member)}
                  </div>
                </article>
              ))}
            </div>
          )}
          {(result?.total ?? 0) > 0 && (
            <footer className={styles.pagination}>
              <span className={styles.resultCount}>Mostrando {firstItem}–{lastItem} de {result?.total}</span>
              <div className={styles.pageControls}>
                <Select
                  label="Por página"
                  aria-label="Resultados por página"
                  value={String(pageSize)}
                  onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                  options={[
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                  ]}
                />
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
                <span className={styles.pageLabel}>Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
              </div>
            </footer>
          )}
        </>
      )}
      <MemberAccessDialog
        organizationId={organizationId ?? undefined}
        target={accessTarget}
        onCancel={() => setAccessTarget(null)}
        onDone={() => { setAccessTarget(null); setReloadCount((count) => count + 1); }}
      />
    </div>
  );
}
