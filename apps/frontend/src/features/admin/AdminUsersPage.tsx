import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Search, UserPlus, Users } from 'lucide-react';
import { apiClient, useAuth } from '@/lib/api';
import type { GlobalRole } from '@/lib/api/types';
import { Badge, Button, EmptyState, Input, Select, Spinner, Table } from '@/components/ui';
import type { MemberDTO } from '@/features/org/types';
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
  ADMIN: 'Admin',
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
  }, [organizationId, debouncedSearch, role, status, page, pageSize, reloadCount]);

  const columns = useMemo(() => [
    { key: 'name', header: 'Nombre', render: (member: PaginatedMember) => <span className={styles.memberName} title={member.name}>{member.name}</span> },
    { key: 'email', header: 'Email', render: (member: PaginatedMember) => <span className={styles.memberEmail} title={member.email}>{member.email}</span> },
    { key: 'role', header: 'Rol', render: (member: PaginatedMember) => <Badge variant="accent">{ROLE_LABEL[member.role]}</Badge> },
    { key: 'status', header: 'Estado', render: (member: PaginatedMember) => {
      return <Badge variant={statusVariant(member.status)} dot>{statusLabel(member.status)}</Badge>;
    } },
    { key: 'actions', header: 'Acciones', align: 'right' as const, render: (member: PaginatedMember) => (
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<Pencil size={15} />}
        onClick={() => navigate(`/admin/users/${member.id}`)}
      >Editar</Button>
    ) },
  ], [navigate]);

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
        <Button
          variant="primary"
          leftIcon={<UserPlus size={18} />}
          onClick={() => navigate('/admin/users/invite')}
        >Invitar usuario</Button>
      </header>

      <div className={styles.filters}>
        <Input
          label="Buscar usuarios"
          placeholder="Nombre o email"
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
            { value: 'ADMIN', label: 'Admin' },
            { value: 'TEACHER', label: 'Profesor' },
            { value: 'STUDENT', label: 'Alumno' },
          ]}
        />
        <Select
          label="Estado"
          hint="Activo: presencia en los últimos cinco minutos. Pendiente: email sin verificar."
          value={status}
          onChange={(event) => { setStatus(event.target.value as MemberStatus | ''); setPage(1); }}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
            { value: 'pending', label: 'Pendiente' },
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
          <Table
            columns={columns}
            data={result?.data ?? []}
            rowKey={(member) => member.id}
            empty={(
              <EmptyState
                icon={<Users size={21} />}
                title={result?.total ? 'No hay resultados' : 'Aún no hay usuarios'}
                description={result?.total ? 'Prueba con otro nombre, email, rol o estado.' : 'Invita a las personas que participarán en esta organización.'}
                action={!result?.total ? <Button onClick={() => navigate('/admin/users/invite')}>Invitar usuario</Button> : undefined}
              />
            )}
          />
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
    </div>
  );
}
