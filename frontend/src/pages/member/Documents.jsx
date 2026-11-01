import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Card, EmptyState, ErrorNote, Field, Modal, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, downloadFile, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate } from '../../lib/format.js';

const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Documents() {
  useTitle('Documents');
  const { hasRole } = useAuth();
  const admin = hasRole('ADMIN');
  const { data, error, loading, reload } = useFetch('/documents');
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', visibleToRole: 'MEMBER' });
  const [busy, setBusy] = useState(false);

  const grouped = (data?.documents || []).reduce((acc, d) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Choose a file first');
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => v && body.append(k, v));
      body.append('file', file);
      await api.post('/documents', body);
      toast.success('Document uploaded');
      setOpen(false);
      setFile(null);
      setForm({ title: '', description: '', category: 'General', visibleToRole: 'MEMBER' });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const download = async (d) => {
    try {
      await downloadFile(d.fileUrl, d.fileName);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Document vault"
        subtitle="Charter, rules, meeting minutes and logs. Some documents are officer- or admin-only."
        actions={admin && <button type="button" className="btn-gold" onClick={() => setOpen(true)}>Upload document</button>}
      />
      {loading && <SkeletonBlock rows={5} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && data.documents.length === 0 && <EmptyState>No documents available to you yet.</EmptyState>}

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, docs]) => (
          <section key={category} aria-label={category}>
            <h2 className="mb-2 font-display text-lg font-bold text-gold">{category}</h2>
            <div className="space-y-2">
              {docs.map((d) => (
                <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.title}</span>
                      {d.visibleToRole !== 'MEMBER' && <Badge value={`${d.visibleToRole} only`} tone="gold" />}
                    </div>
                    {d.description && <p className="text-sm text-muted">{d.description}</p>}
                    <p className="text-xs text-muted">{d.fileName} · {size(d.size)} · {fmtDate(d.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-outline" onClick={() => download(d)}>Download</button>
                    {admin && (
                      <button type="button" className="btn-danger" onClick={async () => {
                        if (!window.confirm(`Delete "${d.title}" permanently?`)) return;
                        try { await api.del(`/documents/${d.id}`); toast.success('Deleted'); reload(); } catch (err) { toast.error(errorMessage(err)); }
                      }}>Delete</button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      {open && (
        <Modal title="Upload document" onClose={() => setOpen(false)}>
          <form onSubmit={upload} className="space-y-4">
            <Field label="File" htmlFor="d-file" hint="PDF, PNG, JPG, WEBP, TXT or MD — max 10 MB."><input id="d-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md" required className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
            <Field label="Title" htmlFor="d-title"><input id="d-title" className="input" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Description" htmlFor="d-desc"><input id="d-desc" className="input" maxLength={400} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category / folder" htmlFor="d-cat"><input id="d-cat" className="input" required maxLength={60} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Visible to" htmlFor="d-vis">
                <select id="d-vis" className="input" value={form.visibleToRole} onChange={(e) => setForm({ ...form, visibleToRole: e.target.value })}>
                  <option value="MEMBER">All members</option>
                  <option value="OFFICER">Officers &amp; admins</option>
                  <option value="ADMIN">Admins only</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
