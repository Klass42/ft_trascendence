/**
 * 404 pages.
 *
 * - NotFoundRoute: top-level catch-all. Tenant users get the page inside the app
 *   layout (nav, skip link, <main>); anonymous visitors and platform admins get
 *   a standalone page with its own <main>.
 * - PlatformNotFound: unknown /platform/* route, rendered inside PlatformLayout.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useAuth } from '@/lib/api';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { AppLayout } from './AppLayout';
import { LegalFooter } from './LegalFooter';
import styles from './NotFoundPage.module.css';

const TITLE = 'Página no encontrada';
const DESCRIPTION = 'La dirección que buscas no existe o ha cambiado de sitio.';

/** Sets the tab title while the page is mounted and restores the previous one. */
function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Klass`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function NotFoundState({ actionTo, actionLabel }: { actionTo: string; actionLabel: string }) {
  return (
    <EmptyState
      icon={<SearchX size={24} />}
      title={TITLE}
      titleAs="h1"
      description={DESCRIPTION}
      action={
        <Button as={Link} to={actionTo}>
          {actionLabel}
        </Button>
      }
    />
  );
}

export function NotFoundRoute() {
  const { user, isLoading } = useAuth();
  useDocumentTitle(TITLE);

  if (isLoading) {
    return (
      <div className={styles.standalone}>
        <Spinner size="lg" label="Cargando…" />
      </div>
    );
  }

  const isPlatformAdmin = user?.platformRole === 'SUPERADMIN';

  if (user && !isPlatformAdmin) {
    return (
      <AppLayout>
        <div className={styles.inApp}>
          <NotFoundState actionTo="/dashboard" actionLabel="Volver al inicio" />
        </div>
      </AppLayout>
    );
  }

  return (
    <div className={styles.standalone}>
      <main className={styles.main}>
        {isPlatformAdmin ? (
          <NotFoundState actionTo="/platform" actionLabel="Volver a la plataforma" />
        ) : (
          <NotFoundState actionTo="/login" actionLabel="Iniciar sesión" />
        )}
      </main>
      <LegalFooter />
    </div>
  );
}

export function PlatformNotFound() {
  useDocumentTitle(TITLE);
  return (
    <div className={styles.inApp}>
      <NotFoundState actionTo="/platform" actionLabel="Volver a la plataforma" />
    </div>
  );
}
