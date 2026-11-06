import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Card, EmptyState, ErrorNote, Field, Modal, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDateTime } from '../../lib/format.js';

export function ForumHome() {
  useTitle('Forums');
  const { data, error, loading, reload } = useFetch('/forum/categories');
  return (
    <>
      <PageHeader title="Strategy forums" subtitle="Production chains, market trends, office strategy and general chat." />
      {loading && <SkeletonBlock rows={4} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && data.categories.length === 0 && <EmptyState>No categories yet. An officer can create them under Management → Content.</EmptyState>}
      <div className="grid gap-4 sm:grid-cols-2">
        {(data?.categories || []).map((c) => (
          <Link key={c.id} to={`/app/forums/category/${c.id}`} className="card block transition hover:border-gold/60">
            <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft text-gold">{c.name}</h2>
            <p className="mt-1 text-sm text-muted">{c.description}</p>
            <p className="mt-3 text-xs text-muted">{c._count.threads} thread{c._count.threads === 1 ? '' : 's'}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

export function ForumCategory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(`/forum/categories/${id}/threads`);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [busy, setBusy] = useState(false);
  useTitle(data?.category?.name || 'Forums');

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/forum/threads', { categoryId: id, ...form });
      navigate(`/app/forums/thread/${res.thread.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={data?.category?.name || 'Forum'}
        subtitle={data?.category?.description}
        actions={
          <>
            <Link to="/app/forums" className="btn-ghost">← All categories</Link>
            <button type="button" className="btn-gold" onClick={() => setOpen(true)}>New thread</button>
          </>
        }
      />
      {loading && <SkeletonBlock rows={5} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && data.threads.length === 0 && <EmptyState>No threads yet — start the conversation.</EmptyState>}
      <div className="space-y-2">
        {(data?.threads || []).map((t) => (
          <Link key={t.id} to={`/app/forums/thread/${t.id}`} className="card flex items-center justify-between gap-3 transition hover:border-gold/60">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {t.pinned && <Badge value="PINNED" tone="gold" />}
                {t.locked && <Badge value="LOCKED" tone="muted" />}
                <span className="truncate font-semibold">{t.title}</span>
              </div>
              <p className="text-xs text-muted">by {t.user.inGameName} · {fmtDateTime(t.updatedAt)}</p>
            </div>
            <span className="shrink-0 text-sm text-muted">{t._count.posts} post{t._count.posts === 1 ? '' : 's'}</span>
          </Link>
        ))}
      </div>
      {open && (
        <Modal title="New thread" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Title" htmlFor="th-title"><input id="th-title" className="input" required minLength={3} maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Message" htmlFor="th-body"><textarea id="th-body" className="input min-h-[140px]" required maxLength={8000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Posting…' : 'Post thread'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ForumThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { data, error, loading, reload } = useFetch(`/forum/threads/${id}`);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const thread = data?.thread;
  useTitle(thread?.title || 'Thread');

  const officer = hasRole('OFFICER');
  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    await run(async () => {
      await api.post(`/forum/threads/${id}/posts`, { content: reply });
      setReply('');
    });
    setBusy(false);
  };

  return (
    <>
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {thread && (
        <>
          <PageHeader
            title={thread.title}
            subtitle={`in ${thread.category.name} · started by ${thread.user.inGameName}`}
            actions={
              <>
                <Link to={`/app/forums/category/${thread.categoryId}`} className="btn-ghost">← Back</Link>
                {officer && (
                  <>
                    <button type="button" className="btn-outline" onClick={() => run(() => api.patch(`/forum/threads/${id}`, { pinned: !thread.pinned }), thread.pinned ? 'Unpinned' : 'Pinned')}>{thread.pinned ? 'Unpin' : 'Pin'}</button>
                    <button type="button" className="btn-outline" onClick={() => run(() => api.patch(`/forum/threads/${id}`, { locked: !thread.locked }), thread.locked ? 'Unlocked' : 'Locked')}>{thread.locked ? 'Unlock' : 'Lock'}</button>
                  </>
                )}
                {(officer || thread.userId === user.id) && (
                  <button type="button" className="btn-danger" onClick={async () => {
                    if (!window.confirm('Delete this whole thread?')) return;
                    try { await api.del(`/forum/threads/${id}`); navigate(`/app/forums/category/${thread.categoryId}`); } catch (err) { toast.error(errorMessage(err)); }
                  }}>Delete</button>
                )}
              </>
            }
          />
          <div className="space-y-3">
            {thread.posts.map((p) => (
              <Card key={p.id}>
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span><strong className="text-sm text-main">{p.user.inGameName}</strong> {p.user.role !== 'MEMBER' && <Badge value={p.user.role} />} · {fmtDateTime(p.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{p.content}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" aria-pressed={p.upvoted} className={p.upvoted ? 'btn-gold px-3 py-1' : 'btn-outline px-3 py-1'} onClick={() => run(() => api.post(`/forum/posts/${p.id}/upvote`))}>
                    ▲ {p.upvoteCount}
                  </button>
                  {(officer || p.userId === user.id) && thread.posts.length > 1 && (
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => window.confirm('Delete this post?') && run(() => api.del(`/forum/posts/${p.id}`), 'Post deleted')}>Delete</button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            {thread.locked && !officer ? (
              <p className="text-sm text-muted">This thread is locked.</p>
            ) : (
              <form onSubmit={send} className="space-y-3">
                <Field label={thread.locked ? 'Reply (locked — officer override)' : 'Reply'} htmlFor="reply"><textarea id="reply" className="input min-h-[100px]" required maxLength={8000} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
                <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Posting…' : 'Post reply'}</button>
              </form>
            )}
          </Card>
        </>
      )}
    </>
  );
}
