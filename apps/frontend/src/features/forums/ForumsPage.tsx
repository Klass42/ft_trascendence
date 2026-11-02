import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@/components/ui';
import { subjectSelectorLabel, useMySubjects, useForumThreads } from '@/lib/api';
import { NewThreadForm } from './NewThreadForm';
import { initialsOf } from './helpers';
import { formatDateTime } from '@/lib/format';
import styles from './ForumsPage.module.css';

/**
 * Course forums, connected to the real API.
 *
 * A course selector scopes the thread list (pinned first). Any member can open
 * a new thread or search; clicking a thread opens its detail. The tenant is
 * derived server-side from identity, so nothing here trusts a client org.
 */
export function ForumsPage() {
  const navigate = useNavigate();
  const { data: courses, isLoading: coursesLoading } = useMySubjects();

  const [courseId, setCourseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);

  // Default the selector to the first available course.
  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const {
    data: threads,
    isLoading: threadsLoading,
    error: threadsError,
  } = useForumThreads(courseId, debounced);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Foros
        </h1>

        {courses && courses.length > 0 && (
          <select
            className={styles.courseSelect}
            aria-label="Asignatura"
            value={courseId ?? ''}
            onChange={(e) => {
              setCourseId(e.target.value);
              setCreating(false);
              setSearch('');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {subjectSelectorLabel(c)}
              </option>
            ))}
          </select>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando asignaturas…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No hay asignaturas disponibles.
        </p>
      )}

      {courseId && (
        <>
          {/* Toolbar: search + new thread */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en el foro…"
              style={{
                flex: '1 1 240px',
                padding: '9px 13px',
                borderRadius: 9,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {!creating && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                + Nuevo hilo
              </Button>
            )}
          </div>

          {creating && (
            <NewThreadForm
              courseId={courseId}
              onCreated={(thread) => {
                setCreating(false);
                navigate(`/forums/${thread.id}`);
              }}
              onCancel={() => setCreating(false)}
            />
          )}

          {threadsLoading && <Spinner size="md" label="Cargando hilos…" />}

          {threadsError && (
            <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
              No se pudieron cargar los hilos (¿estás inscrito en esta asignatura?).
            </p>
          )}

          {threads && threads.length === 0 && !threadsLoading && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              {debounced
                ? 'Ningún hilo coincide con tu búsqueda.'
                : 'Esta asignatura no tiene hilos todavía. ¡Abre el primero!'}
            </p>
          )}

          {threads?.map((t) => (
            <Link
              key={t.id}
              to={`/forums/${t.id}`}
              className={styles.threadCard}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--color-accent-muted)',
                  color: 'var(--color-accent-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  flex: 'none',
                }}
              >
                {initialsOf(t.author?.name)}
              </div>
              <div className={styles.threadText}>
                <div
                  className={styles.threadTitle}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span className={styles.threadTitleText}>{t.title}</span>
                  {t.pinned && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: 'var(--color-warning-strong)',
                        background: 'var(--color-warning-muted)',
                        padding: '2px 8px',
                        borderRadius: 20,
                      }}
                    >
                      FIJADO
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                  }}
                >
                  {t.author?.name ?? 'Anónimo'} · {t._count.posts}{' '}
                  {t._count.posts === 1 ? 'mensaje' : 'mensajes'} ·{' '}
                  {formatDateTime(t.createdAt)}
                </div>
              </div>
              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
