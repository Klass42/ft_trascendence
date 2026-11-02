import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import {
  ApiError,
  useAuth,
  useForumThread,
  useCreatePost,
  useDeletePost,
  useDeleteThread,
  usePinThread,
  useUpdatePost,
  useUpdateThread,
} from '@/lib/api';
import type { ForumPostDTO } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { UserLink } from '@/features/profile/UserLink';
import { CharCounter } from './CharCounter';
import {
  FORUM_BODY_MAX,
  FORUM_TITLE_MAX,
  bodyError,
  initialsOf,
  isStaffRole,
  titleError,
} from './helpers';
import styles from './ThreadPage.module.css';

/** What the delete ConfirmDialog is about to remove. */
type PendingDelete =
  | { kind: 'thread' }
  | { kind: 'post'; id: string; replies: number };

/** Whether any post in the tree (at any depth) has an author matching `test`. */
function anyPostBy(posts: ForumPostDTO[], test: (authorId: string | null) => boolean): boolean {
  return posts.some((post) => test(post.authorId ?? null) || anyPostBy(post.replies, test));
}

/** Total number of replies nested (at any depth) under a post. */
function countReplies(post: ForumPostDTO): number {
  return post.replies.reduce((sum, child) => sum + 1 + countReplies(child), 0);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * A forum thread with its posts rendered as a reply tree, connected to the real
 * API. Any member can reply (optionally nested under another post); authors can
 * edit/delete their own posts and rename their own thread; course staff and org
 * admins can pin and delete anything. The backend enforces every rule and
 * derives the tenant from the thread's course.
 */
export function ThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: thread, isLoading, error, refetch } = useForumThread(
    threadId ?? null,
  );
  const { create: createPost, isLoading: posting } = useCreatePost();
  const { togglePin, isLoading: pinning } = usePinThread();
  const { update: updateThread, isLoading: savingTitle } = useUpdateThread();
  const { update: updatePost, isLoading: savingPost } = useUpdatePost();
  const { remove: removePost, isLoading: deletingPost } = useDeletePost();
  const { remove: removeThread, isLoading: deletingThread } = useDeleteThread();

  // Which post we're replying to (null = top-level reply to the thread).
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  async function submitReply(body: string, parentId: string | null) {
    if (!threadId) return;
    await createPost(threadId, {
      body,
      parentId: parentId ?? undefined,
    });
    setReplyTo(null);
    refetch();
  }

  async function savePost(postId: string, body: string) {
    await updatePost(postId, { body });
    setEditingPostId(null);
    refetch();
  }

  async function saveTitle(title: string) {
    if (!threadId) return;
    await updateThread(threadId, { title });
    setEditingTitle(false);
    refetch();
  }

  async function confirmDelete() {
    if (!pendingDelete || !threadId) return;
    try {
      if (pendingDelete.kind === 'thread') {
        await removeThread(threadId);
        toast({ variant: 'success', message: 'Hilo eliminado.' });
        navigate('/forums');
        return;
      }
      await removePost(pendingDelete.id);
      toast({ variant: 'success', message: 'Mensaje eliminado.' });
      setPendingDelete(null);
      refetch();
    } catch (err) {
      setPendingDelete(null);
      toast({
        variant: 'error',
        message: errorMessage(err, 'No se pudo eliminar. Inténtalo de nuevo.'),
      });
    }
  }

  if (isLoading) {
    return (
      <div className={styles.stateBox}>
        <Spinner size="md" label="Cargando hilo…" />
      </div>
    );
  }

  // A deleted thread (e.g. opened from an old notification) is not an error.
  if (error instanceof ApiError && error.isNotFound) {
    return (
      <div className={styles.stateBox}>
        <EmptyState
          title="Este hilo ya no existe"
          description="Es posible que se haya eliminado."
          action={<Button as={Link} to="/forums">Volver a los foros</Button>}
        />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className={styles.stateBox}>
        <BackLink />
        <p className={styles.stateText}>
          {error ? 'No se pudo cargar el hilo.' : 'Hilo no encontrado.'}
        </p>
      </div>
    );
  }

  const currentUserId = user?.userId ?? null;
  const isThreadAuthor =
    thread.authorId != null && thread.authorId === currentUserId;
  // Server-computed: subject staff or org admin (not a guess from the global role).
  const canModerate = thread.canModerate;
  // Mirrors the backend: an author may delete their thread only while nobody
  // else has posted in it.
  const canDeleteThread =
    canModerate || (isThreadAuthor && !anyPostBy(thread.posts, (id) => id !== currentUserId));

  return (
    <div className={styles.page}>
      <BackLink />

      <div className={styles.header}>
        {editingTitle ? (
          <TitleEditor
            initialValue={thread.title}
            busy={savingTitle}
            onSubmit={saveTitle}
            onCancel={() => setEditingTitle(false)}
          />
        ) : (
          <>
            <h1 className={styles.title}>
              {thread.title}
              {thread.pinned && <span className={styles.pinned}>FIJADO</span>}
            </h1>
            <div className={styles.headerActions}>
              {isThreadAuthor && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTitle(true)}
                >
                  Editar
                </Button>
              )}
              {canModerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={pinning}
                  onClick={async () => {
                    try {
                      await togglePin(thread.id);
                      refetch();
                    } catch (err) {
                      toast({
                        variant: 'error',
                        message: errorMessage(err, 'No se pudo cambiar el estado fijado.'),
                      });
                    }
                  }}
                >
                  {thread.pinned ? 'Desfijar' : 'Fijar'}
                </Button>
              )}
              {canDeleteThread && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Eliminar hilo"
                  onClick={() => setPendingDelete({ kind: 'thread' })}
                >
                  Eliminar
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={styles.meta}>
        {thread.authorId && thread.author
          ? <UserLink userId={thread.authorId}>{thread.author.name}</UserLink>
          : 'Anónimo'} · {formatDateTime(thread.createdAt)}
      </div>

      {thread.posts.length === 0 && (
        <p className={styles.empty}>
          Aún no hay mensajes. ¡Sé el primero en responder!
        </p>
      )}

      {thread.posts.map((post) => (
        <PostNode
          key={post.id}
          post={post}
          depth={0}
          currentUserId={currentUserId}
          canModerate={canModerate}
          replyTo={replyTo}
          setReplyTo={(id) => {
            setReplyTo(id);
            if (id) setEditingPostId(null);
          }}
          onReply={submitReply}
          posting={posting}
          editingPostId={editingPostId}
          setEditingPostId={(id) => {
            setEditingPostId(id);
            if (id) setReplyTo(null);
          }}
          onSaveEdit={savePost}
          savingEdit={savingPost}
          onDelete={(target) =>
            setPendingDelete({
              kind: 'post',
              id: target.id,
              replies: countReplies(target),
            })
          }
        />
      ))}

      {/* Top-level reply to the thread. */}
      <div className={styles.topComposer}>
        <MessageEditor
          ariaLabel="Escribe una respuesta"
          placeholder="Escribe una respuesta…"
          submitLabel="Publicar"
          busy={posting && replyTo === null}
          clearOnSubmit
          onSubmit={(body) => submitReply(body, null)}
        />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'thread' ? 'Eliminar hilo' : 'Eliminar mensaje'}
        message={deleteMessage(pendingDelete)}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deletingPost || deletingThread}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function deleteMessage(pending: PendingDelete | null): string {
  if (!pending) return '';
  if (pending.kind === 'thread') {
    return 'Se eliminará el hilo con todos sus mensajes. Esta acción no se puede deshacer.';
  }
  if (pending.replies > 0) {
    const n = pending.replies;
    return `Se eliminará el mensaje y ${n === 1 ? 'su respuesta' : `sus ${n} respuestas`}. Esta acción no se puede deshacer.`;
  }
  return 'Se eliminará el mensaje. Esta acción no se puede deshacer.';
}

function BackLink() {
  return (
    <Button
      as={Link}
      to="/forums"
      variant="ghost"
      size="sm"
      leftIcon={<ArrowLeft size={16} />}
    >
      Foros
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Recursive post node
// ---------------------------------------------------------------------------

interface PostNodeProps {
  post: ForumPostDTO;
  depth: number;
  currentUserId: string | null;
  canModerate: boolean;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  onReply: (body: string, parentId: string | null) => Promise<void>;
  posting: boolean;
  editingPostId: string | null;
  setEditingPostId: (id: string | null) => void;
  onSaveEdit: (postId: string, body: string) => Promise<void>;
  savingEdit: boolean;
  onDelete: (post: ForumPostDTO) => void;
}

function PostNode(props: PostNodeProps) {
  const {
    post,
    depth,
    currentUserId,
    canModerate,
    replyTo,
    setReplyTo,
    onReply,
    posting,
    editingPostId,
    setEditingPostId,
    onSaveEdit,
    savingEdit,
    onDelete,
  } = props;
  const mine = post.authorId != null && post.authorId === currentUserId;
  const staff = isStaffRole(post.authorRole);
  const editing = editingPostId === post.id;
  // Cap the visual indent so deep threads stay readable.
  const depthVar = { '--depth': Math.min(depth, 5) } as CSSProperties;

  return (
    <div className={styles.post} style={depthVar}>
      <div className={styles.postRow}>
        <div className={styles.avatar}>{initialsOf(post.author?.name)}</div>
        <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}>
          <div className={styles.postHead}>
            <span className={`${styles.author} ${staff ? styles.authorStaff : ''}`}>
              {post.authorId && post.author
                ? <UserLink userId={post.authorId}>{post.author.name}</UserLink>
                : 'Anónimo'}
            </span>
            {staff && (
              <span className={styles.roleBadge}>
                {post.authorRole === 'ASSISTANT' ? 'AYUDANTE' : 'PROFESOR'}
              </span>
            )}
            <span className={styles.date}>{formatDateTime(post.createdAt)}</span>
          </div>

          {editing ? (
            <div className={styles.inlineForm}>
              <MessageEditor
                ariaLabel="Editar mensaje"
                initialValue={post.body}
                placeholder="Edita tu mensaje…"
                submitLabel="Guardar"
                busy={savingEdit}
                autoFocus
                onSubmit={(body) => onSaveEdit(post.id, body)}
                onCancel={() => setEditingPostId(null)}
              />
            </div>
          ) : (
            <div className={styles.body}>{post.body}</div>
          )}

          {!editing && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.linkAction}
                onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
              >
                {replyTo === post.id ? 'Cancelar' : 'Responder'}
              </button>
              {mine && (
                <button
                  type="button"
                  className={styles.linkAction}
                  onClick={() => setEditingPostId(post.id)}
                >
                  Editar
                </button>
              )}
              {((mine && post.replies.length === 0) || canModerate) && (
                <button
                  type="button"
                  className={`${styles.linkAction} ${styles.linkActionDanger}`}
                  aria-label="Eliminar mensaje"
                  onClick={() => onDelete(post)}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}

          {replyTo === post.id && !editing && (
            <div className={styles.inlineForm}>
              <MessageEditor
                ariaLabel={`Responder a ${post.author?.name ?? 'este mensaje'}`}
                placeholder={`Responder a ${post.author?.name ?? 'este mensaje'}…`}
                submitLabel="Responder"
                busy={posting}
                autoFocus
                clearOnSubmit
                onSubmit={(body) => onReply(body, post.id)}
              />
            </div>
          )}
        </div>
      </div>

      {post.replies.map((child) => (
        <PostNode key={child.id} {...props} post={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message editor (new reply, nested reply and inline edit)
// ---------------------------------------------------------------------------

interface MessageEditorProps {
  ariaLabel: string;
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  initialValue?: string;
  autoFocus?: boolean;
  /** Empty the field after a successful submit (composers, not edits). */
  clearOnSubmit?: boolean;
  onSubmit: (body: string) => void | Promise<void>;
  onCancel?: () => void;
}

function MessageEditor({
  ariaLabel,
  placeholder,
  submitLabel,
  busy,
  initialValue = '',
  autoFocus,
  clearOnSubmit,
  onSubmit,
  onCancel,
}: MessageEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const invalid = bodyError(draft);
  // Blank is only reported once the user has interacted; submit stays disabled
  // meanwhile, so there is never a silent no-op click.
  const shownError = (touched ? invalid : null) ?? serverError ?? undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setServerError(null);
    try {
      await onSubmit(draft.trim());
      if (clearOnSubmit) {
        setDraft('');
        setTouched(false);
      }
    } catch (err) {
      setServerError(errorMessage(err, 'No se pudo publicar el mensaje.'));
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit} noValidate>
      <Textarea
        aria-label={ariaLabel}
        value={draft}
        autoFocus={autoFocus}
        rows={3}
        maxLength={FORUM_BODY_MAX}
        placeholder={placeholder}
        error={shownError}
        onChange={(e) => {
          setDraft(e.target.value);
          setTouched(true);
          setServerError(null);
        }}
      />
      <div className={styles.composerFooter}>
        <div className={styles.formActions}>
          <Button type="submit" size="sm" loading={busy} disabled={invalid !== null}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
          )}
        </div>
        <CharCounter length={draft.length} max={FORUM_BODY_MAX} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Title editor
// ---------------------------------------------------------------------------

interface TitleEditorProps {
  initialValue: string;
  busy: boolean;
  onSubmit: (title: string) => Promise<void>;
  onCancel: () => void;
}

function TitleEditor({ initialValue, busy, onSubmit, onCancel }: TitleEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const invalid = titleError(draft);
  const shownError = (touched ? invalid : null) ?? serverError ?? undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setServerError(null);
    try {
      await onSubmit(draft.trim());
    } catch (err) {
      setServerError(errorMessage(err, 'No se pudo guardar el título.'));
    }
  }

  return (
    <form className={styles.editTitle} onSubmit={handleSubmit} noValidate>
      <Input
        aria-label="Título del hilo"
        value={draft}
        maxLength={FORUM_TITLE_MAX}
        autoFocus
        error={shownError}
        onChange={(e) => {
          setDraft(e.target.value);
          setTouched(true);
          setServerError(null);
        }}
      />
      <div className={styles.composerFooter}>
        <div className={styles.formActions}>
          <Button type="submit" size="sm" loading={busy} disabled={invalid !== null}>
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        </div>
        <CharCounter length={draft.length} max={FORUM_TITLE_MAX} />
      </div>
    </form>
  );
}
