import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@/components/ui';
import { useCourses, useForumThreads } from '@/lib/api';
import { NewThreadForm } from './NewThreadForm';
import { formatDateTime, initialsOf } from './helpers';

/**
 * Course forums, connected to the real API.
 *
 * A course selector scopes the thread list (pinned first). Any member can open
 * a new thread or search; clicking a thread opens its detail. The tenant is
 * derived server-side from identity, so nothing here trusts a client org.
 */
export function ForumsPage() {
  const navigate = useNavigate();
  const { data: courses, isLoading: coursesLoading } = useCourses();

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
    <div style={{ padding: '30px 40px', maxWidth: 860 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
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
            value={courseId ?? ''}
            onChange={(e) => {
              setCourseId(e.target.value);
              setCreating(false);
              setSearch('');
            }}
            style={{
              marginLeft: 'auto',
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
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No hay cursos disponibles.
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
              No se pudieron cargar los hilos (¿estás inscrito en este curso?).
            </p>
          )}

          {threads && threads.length === 0 && !threadsLoading && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              {debounced
                ? 'Ningún hilo coincide con tu búsqueda.'
                : 'Este curso no tiene hilos todavía. ¡Abre el primero!'}
            </p>
          )}

          {threads?.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/forums/${t.id}`)}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 13,
                padding: '15px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 11,
                cursor: 'pointer',
              }}
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {t.title}
                  </span>
                  {t.pinned && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#d97706',
                        background: '#fdf0dc',
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
            </div>
          ))}
        </>
      )}
    </div>
  );
}
