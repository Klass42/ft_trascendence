import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Plus, Search, Trash2, Users } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Badge, Button, ConfirmDialog, EmptyState, Spinner, useToast } from '@/components/ui';
import styles from './PlatformOrganizationsPage.module.css';

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  logoUrl?: string | null;
  _count?: { users: number; invitations: number };
};

function statusVariant(status: Organization['status']) {
  return status === 'ACTIVE' ? 'success' : 'warning';
}

export function PlatformOrganizationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    apiClient.get<Organization[]>('/platform/organizations')
      .then(setItems)
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  }, []);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter(({ name, slug }) =>
      name.toLowerCase().includes(normalized) || slug.toLowerCase().includes(normalized),
    );
  }, [items, query]);

  const activeCount = items.filter((org) => org.status === 'ACTIVE').length;
  const pendingCount = items.reduce((total, org) => total + (org._count?.invitations ?? 0), 0);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/platform/organizations/${pendingDelete.id}`);
      setItems((current) => current.filter((org) => org.id !== pendingDelete.id));
      toast({ message: `«${pendingDelete.name}» eliminada`, variant: 'success' });
      setPendingDelete(null);
    } catch (error) {
      toast({
        message: error instanceof ApiError ? error.message : 'No se pudo eliminar la organización.',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Klass Platform</span>
          <h1>Organizaciones</h1>
          <p>Da de alta espacios de aprendizaje y entrega a cada administrador un acceso seguro.</p>
        </div>
        <Button as={Link} to="/platform/organizations/new" leftIcon={<Plus size={18} />}>
          Nueva organización
        </Button>
      </section>

      <section className={styles.metrics} aria-label="Resumen de organizaciones">
        <div className={styles.metric}>
          <span className={styles.metricIcon}><Building2 size={18} /></span>
          <div><strong>{items.length}</strong><span>Organizaciones</span></div>
        </div>
        <div className={styles.metric}>
          <span className={`${styles.metricIcon} ${styles.activeIcon}`}><span className={styles.pulse} /></span>
          <div><strong>{activeCount}</strong><span>Activas</span></div>
        </div>
        <div className={styles.metric}>
          <span className={`${styles.metricIcon} ${styles.pendingIcon}`}><Users size={18} /></span>
          <div><strong>{pendingCount}</strong><span>Invitaciones pendientes</span></div>
        </div>
      </section>

      <section className={styles.directory}>
        <div className={styles.directoryHeader}>
          <div>
            <h2>Directorio</h2>
            <p>{items.length === 1 ? '1 organización creada' : `${items.length} organizaciones creadas`}</p>
          </div>
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <span className={styles.srOnly}>Buscar organización</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o código" />
          </label>
        </div>

        {hasError && <div className={styles.error} role="alert">No se pudieron cargar las organizaciones. Inténtalo de nuevo.</div>}

        {isLoading ? (
          <div className={styles.loading}><Spinner size="lg" label="Cargando organizaciones..." /></div>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} />}
            title={query ? 'No hay coincidencias' : 'Tu plataforma está lista'}
            description={query ? 'Prueba con otro nombre o código de organización.' : 'Crea la primera organización para invitar a su administrador.'}
            action={!query ? <Button as={Link} to="/platform/organizations/new">Crear organización</Button> : undefined}
          />
        ) : (
          <div className={styles.list}>
            {visibleItems.map((org) => (
              <div key={org.id} className={styles.organization}>
                <Link to={`/platform/organizations/${org.id}`} className={styles.orgMain}>
                  <div className={styles.avatar} aria-hidden="true">
                    {org.logoUrl ? <img src={org.logoUrl} alt="" /> : org.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className={styles.orgInfo}>
                    <strong>{org.name}</strong>
                    <span>klass.app/{org.slug}</span>
                  </div>
                  <div className={styles.orgMeta}>
                    <Badge variant={statusVariant(org.status)} dot>{org.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}</Badge>
                    <span>{org._count?.users ?? 0} usuarios</span>
                    {(org._count?.invitations ?? 0) > 0 && <span>{org._count!.invitations} invitación{org._count!.invitations === 1 ? '' : 'es'}</span>}
                  </div>
                  <ChevronRight className={styles.chevron} size={20} aria-hidden="true" />
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.deleteButton}
                  aria-label={`Eliminar ${org.name}`}
                  onClick={() => setPendingDelete(org)}
                  leftIcon={<Trash2 size={16} />}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar organización"
        message={
          pendingDelete
            ? `¿Eliminar «${pendingDelete.name}»? Se borrarán sus usuarios, cursos y archivos. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!isDeleting) setPendingDelete(null); }}
      />
    </div>
  );
}
