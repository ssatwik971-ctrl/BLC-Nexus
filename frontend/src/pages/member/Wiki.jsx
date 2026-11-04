import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, EmptyState, ErrorNote, Field, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate } from '../../lib/format.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function WikiList() {
  useTitle('Wiki');
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch('/wiki');
  const [title, setTitle] = useState('');

  const create = (e) => {
    e.preventDefault();
    const slug = slugify(title);
    if (slug) navigate(`/app/wiki/${slug}?new=${encodeURIComponent(title)}`);
  };

  return (
    <>
      <PageHeader title="Strategy wiki" subtitle="Persistent guides maintained by BLC officers." />
      {loading && <SkeletonBlock rows={4} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && data.pages.length === 0 && <EmptyState>No wiki pages yet.</EmptyState>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(data?.pages || []).map((p) => (
          <Link key={p.id} to={`/app/wiki/${p.slug}`} className="card transition hover:border-gold/60">
            <h2 className="font-semibold text-gold">{p.title}</h2>
            <p className="text-xs text-muted">Updated {fmtDate(p.updatedAt)}</p>
          </Link>
        ))}
      </div>
      {hasRole('OFFICER') && (
        <Card className="mt-6">
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1"><Field label="New page title" htmlFor="wk-new"><input id="wk-new" className="input" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field></div>
            <button type="submit" className="btn-gold">Create page</button>
          </form>
        </Card>
      )}
    </>
  );
}

export function WikiPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isNew = new URLSearchParams(window.location.search).get('new');
  const { data, error, loading, reload } = useFetch(isNew ? null : `/wiki/${slug}`);
  const [editing, setEditing] = useState(Boolean(isNew));
  const [form, setForm] = useState({ title: isNew || '', content: '' });
  const [busy, setBusy] = useState(false);
  const page = data?.page;
  useTitle(page?.title || 'Wiki');

  const officer = hasRole('OFFICER');

  const startEdit = () => {
    setForm({ title: page.title, content: page.content });
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/wiki/${slug}`, form);
      toast.success('Page saved');
      setEditing(false);
      if (isNew) navigate(`/app/wiki/${slug}`, { replace: true });
      else reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4"><Link to="/app/wiki" className="btn-ghost">← All pages</Link></div>
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}

      {editing ? (
        <Card>
          <form onSubmit={save} className="space-y-4">
            <Field label="Title" htmlFor="wk-title"><input id="wk-title" className="input" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Content" htmlFor="wk-content" hint="Plain text. Line breaks are preserved."><textarea id="wk-content" className="input min-h-[300px] font-mono" required maxLength={40000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => (isNew ? navigate('/app/wiki') : setEditing(false))}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Saving…' : 'Save page'}</button>
            </div>
          </form>
        </Card>
      ) : (
        page && (
          <>
            <PageHeader
              title={page.title}
              subtitle={`Last updated ${fmtDate(page.updatedAt)}`}
              actions={officer && (
                <>
                  <button type="button" className="btn-outline" onClick={startEdit}>Edit</button>
                  {officer && (
                    <button type="button" className="btn-danger" onClick={async () => {
                      if (!window.confirm('Delete this page?')) return;
                      try { await api.del(`/wiki/${slug}`); navigate('/app/wiki'); } catch (err) { toast.error(errorMessage(err)); }
                    }}>Delete</button>
                  )}
                </>
              )}
            />
            <Card><p className="whitespace-pre-wrap break-words leading-relaxed">{page.content}</p></Card>
          </>
        )
      )}
    </>
  );
}
