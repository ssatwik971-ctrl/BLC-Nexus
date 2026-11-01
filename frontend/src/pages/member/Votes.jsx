import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Card, EmptyState, ErrorNote, Field, Modal, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDateTime, fromLocalInput } from '../../lib/format.js';

function Results({ vote }) {
  const total = vote.totalVotes || 0;
  return (
    <ul className="mt-3 space-y-2" aria-label="Results">
      {vote.results.map((r) => {
        const pct = total ? Math.round((r.votes / total) * 100) : 0;
        return (
          <li key={r.option}>
            <div className="flex justify-between text-sm"><span>{r.option}</span><span className="text-muted">{r.votes} ({pct}%)</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full bg-gold" style={{ width: `${pct}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Votes() {
  useTitle('Votes');
  const { hasRole } = useAuth();
  const admin = hasRole('ADMIN');
  const { data, error, loading, reload } = useFetch('/votes');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', options: 'Yes\nNo', eligibleRole: 'MEMBER', endTime: '' });
  const [busy, setBusy] = useState(false);

  const cast = async (id, option) => {
    if (!window.confirm(`Cast your vote for "${option}"? Votes cannot be changed.`)) return;
    try {
      await api.post(`/votes/${id}/cast`, { option });
      toast.success('Vote recorded');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/votes', {
        title: form.title,
        description: form.description || null,
        options: form.options.split('\n').map((s) => s.trim()).filter(Boolean),
        eligibleRole: form.eligibleRole,
        endTime: fromLocalInput(form.endTime),
      });
      toast.success('Vote created');
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const votes = data?.votes || [];
  const openVotes = votes.filter((v) => v.status === 'OPEN');
  const closed = votes.filter((v) => v.status !== 'OPEN');

  const renderVote = (v) => (
    <Card key={v.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{v.title}</h3>
          <p className="text-xs text-muted">{v.status === 'OPEN' ? `Closes ${fmtDateTime(v.endTime)}` : `Closed ${fmtDateTime(v.endTime)}`} · {v.eligibleRole === 'OFFICER' ? 'Officers only' : 'All members'} · {v.totalVotes} vote{v.totalVotes === 1 ? '' : 's'}</p>
        </div>
        <Badge value={v.status} />
      </div>
      {v.description && <p className="mt-2 whitespace-pre-wrap text-sm">{v.description}</p>}

      {v.status === 'OPEN' && v.eligible && !v.hasVoted && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Options for ${v.title}`}>
          {v.options.map((o) => <button key={o} type="button" className="btn-outline" onClick={() => cast(v.id, o)}>{o}</button>)}
        </div>
      )}
      {v.hasVoted && <p className="mt-3 text-sm text-ok">You voted: <strong>{v.myChoice}</strong>. Results appear when the vote closes.</p>}
      {v.status === 'OPEN' && !v.eligible && <p className="mt-3 text-sm text-muted">You are not eligible for this vote.</p>}
      {v.results && <Results vote={v} />}

      {admin && v.status === 'OPEN' && (
        <button type="button" className="btn-danger mt-3" onClick={async () => {
          if (!window.confirm('Close this vote now?')) return;
          try { await api.patch(`/votes/${v.id}`, { status: 'CLOSED' }); reload(); } catch (err) { toast.error(errorMessage(err)); }
        }}>Close vote now</button>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Votes & governance"
        subtitle="One vote per member. Results are revealed when a vote closes."
        actions={admin && <button type="button" className="btn-gold" onClick={() => setOpen(true)}>New vote</button>}
      />
      {loading && <SkeletonBlock rows={5} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && votes.length === 0 && <EmptyState>No votes yet.</EmptyState>}

      {openVotes.length > 0 && <section aria-labelledby="ov"><h2 id="ov" className="mb-3 font-display text-lg font-bold">Open</h2><div className="space-y-3">{openVotes.map(renderVote)}</div></section>}
      {closed.length > 0 && <section aria-labelledby="cv" className="mt-8"><h2 id="cv" className="mb-3 font-display text-lg font-bold">Closed</h2><div className="space-y-3">{closed.map(renderVote)}</div></section>}

      {open && (
        <Modal title="Create a vote" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Title" htmlFor="v-title"><input id="v-title" className="input" required minLength={3} maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Description" htmlFor="v-desc"><textarea id="v-desc" className="input min-h-[80px]" maxLength={1500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Options (one per line, 2–10)" htmlFor="v-opts"><textarea id="v-opts" className="input min-h-[90px]" required value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Eligible voters" htmlFor="v-role">
                <select id="v-role" className="input" value={form.eligibleRole} onChange={(e) => setForm({ ...form, eligibleRole: e.target.value })}>
                  <option value="MEMBER">All members</option>
                  <option value="OFFICER">Officers only</option>
                </select>
              </Field>
              <Field label="Closes at" htmlFor="v-end"><input id="v-end" type="datetime-local" className="input" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Creating…' : 'Create vote'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
