import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@/components/ui';
import {
  useAuth,
  useForumThread,
  useCreatePost,
  usePinThread,
} from '@/lib/api';
import type { ForumPostDTO } from '@/lib/api';
import { formatDateTime, initialsOf, isStaffRole } from './helpers';

/**
 * A forum thread with its posts rendered as a reply tree, connected to the real
 * API. Any member can reply (optionally nested under another post); course
 * staff can pin/unpin. The backend derives the tenant from the thread's course.
 */
export function ThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: thread, isLoading, error, refetch } = useForumThread(
    threadId ?? null,
  );
  const { create: createPost, isLoading: posting } = useCreatePost();
  const { togglePin, isLoading: pinning } = usePinThread();

  // Which post we're replying to (null = top-level reply to the thread).
  const [replyTo, setReplyTo] = useState<string | null>(null);

  // Global-role heuristic for showing the pin button; the backend enforces the
  // real course-staff check either way.
  const canPin = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  async function submitReply(body: string, parentId: string | null) {
    if (!threadId) return;
    await createPost(threadId, {
      body,
      parentId: parentId ?? undefined,
    });
    setReplyTo(null);
    refetch();
  }

  if (isLoading) {
    return (
      <div style={{ padding: 40 }}>
        <Spinner size="md" label="Cargando hilo…" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div style={{ padding: 40 }}>
        <button
          onClick={() => navigate('/forums')}
          style={backBtnStyle}
        >
          ← Foros
        </button>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 18 }}>
          {error ? 'No se pudo cargar el hilo.' : 'Hilo no encontrado.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '26px 40px', maxWidth: 760 }}>
      <button onClick={() => navigate('/forums')} style={backBtnStyle}>
        ← Foros
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          margin: '18px 0 6px',
        }}
      >
        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.01em',
            flex: 1,
          }}
        >
          {thread.title}
          {thread.pinned && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#92400e',
                background: '#fdf0dc',
                padding: '3px 9px',
                borderRadius: 20,
                marginLeft: 10,
                verticalAlign: 'middle',
              }}
            >
              FIJADO
            </span>
          )}
        </h1>
        {canPin && (
          <Button
            variant="ghost"
            loading={pinning}
            onClick={async () => {
              await togglePin(thread.id);
              refetch();
            }}
          >
            {thread.pinned ? 'Desfijar' : 'Fijar'}
          </Button>
        )}
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          marginBottom: 22,
        }}
      >
        {thread.author?.name ?? 'Anónimo'} · {formatDateTime(thread.createdAt)}
      </div>

      {thread.posts.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Aún no hay mensajes. ¡Sé el primero en responder!
        </p>
      )}

      {thread.posts.map((post) => (
        <PostNode
          key={post.id}
          post={post}
          depth={0}
          currentUserId={user?.userId ?? null}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          onReply={submitReply}
          posting={posting}
        />
      ))}

      {/* Top-level reply to the thread. */}
      <div style={{ marginTop: 22 }}>
        <ReplyComposer
          placeholder="Escribe una respuesta…"
          submitLabel="Publicar"
          busy={posting && replyTo === null}
          onSubmit={(body) => submitReply(body, null)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursive post node
// ---------------------------------------------------------------------------

interface PostNodeProps {
  post: ForumPostDTO;
  depth: number;
  currentUserId: string | null;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  onReply: (body: string, parentId: string | null) => Promise<void>;
  posting: boolean;
}

function PostNode({
  post,
  depth,
  currentUserId,
  replyTo,
  setReplyTo,
  onReply,
  posting,
}: PostNodeProps) {
  const mine = post.authorId != null && post.authorId === currentUserId;
  const staff = isStaffRole(post.authorRole);
  // Cap the visual indent so deep threads stay readable.
  const indent = Math.min(depth, 5) * 22;

  return (
    <div style={{ marginLeft: indent }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--color-accent-muted)',
            color: 'var(--color-accent-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            flex: 'none',
          }}
        >
          {initialsOf(post.author?.name)}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: mine
              ? 'var(--color-accent-muted)'
              : 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 12,
            padding: '11px 15px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 13.5,
                color: staff
                  ? 'var(--color-accent-hover)'
                  : 'var(--color-text-primary)',
              }}
            >
              {post.author?.name ?? 'Anónimo'}
            </span>
            {staff && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-accent-hover)',
                  background: 'var(--color-accent-muted)',
                  padding: '1px 7px',
                  borderRadius: 20,
                }}
              >
                {post.authorRole === 'ASSISTANT' ? 'AYUDANTE' : 'PROFESOR'}
              </span>
            )}
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                marginLeft: 'auto',
              }}
            >
              {formatDateTime(post.createdAt)}
            </span>
          </div>
          <div
            style={{
              fontSize: 14.5,
              lineHeight: 1.55,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {post.body}
          </div>
          <button
            type="button"
            onClick={() =>
              setReplyTo(replyTo === post.id ? null : post.id)
            }
            style={{
              marginTop: 8,
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-accent-hover)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {replyTo === post.id ? 'Cancelar' : 'Responder'}
          </button>

          {replyTo === post.id && (
            <div style={{ marginTop: 10 }}>
              <ReplyComposer
                placeholder={`Responder a ${post.author?.name ?? 'este mensaje'}…`}
                submitLabel="Responder"
                busy={posting}
                autoFocus
                onSubmit={(body) => onReply(body, post.id)}
              />
            </div>
          )}
        </div>
      </div>

      {post.replies.map((child) => (
        <PostNode
          key={child.id}
          post={child}
          depth={depth + 1}
          currentUserId={currentUserId}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          onReply={onReply}
          posting={posting}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply composer
// ---------------------------------------------------------------------------

interface ReplyComposerProps {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string) => void | Promise<void>;
}

function ReplyComposer({
  placeholder,
  submitLabel,
  busy,
  autoFocus,
  onSubmit,
}: ReplyComposerProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const body = draft.trim();
    if (!body) {
      setError('El mensaje no puede estar vacío.');
      return;
    }
    if (body.length > 5000) {
      setError('El mensaje es demasiado largo (máx. 5000 caracteres).');
      return;
    }
    setError(null);
    try {
      await onSubmit(body);
      setDraft('');
    } catch {
      setError('No se pudo publicar el mensaje.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          value={draft}
          autoFocus={autoFocus}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={5000}
          style={{
            flex: 1,
            minHeight: 44,
            resize: 'vertical',
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 11,
            padding: '12px 14px',
            fontSize: 14,
            fontFamily: 'inherit',
            color: 'var(--color-text-primary)',
            outline: 'none',
            background: 'var(--color-bg-secondary)',
            boxSizing: 'border-box',
          }}
        />
        <Button
          variant="primary"
          loading={busy}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
      </div>
      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 12.5, margin: '6px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border-secondary)',
  color: 'var(--color-text-secondary)',
  fontSize: 12.5,
  fontWeight: 600,
  padding: '7px 13px',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
