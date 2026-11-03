import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Card, EmptyState, ErrorNote, Field, Modal, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate } from '../../lib/format.js';

const FILTERS = ['PENDING', 'WAITLISTED', 'APPROVED', 'REJECTED'];

export default function AdminApplications() {
  useTitle('Applications');
  const [status, setStatus] = useState('PENDING');
  const { data, error, loading, reload } = useFetch(`/admin/applications?status=${status}`);
  const [deciding, setDeciding] = useState(null); // { app, status }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/admin/applications/${deciding.app.id}`, { status: deciding.status, note: note || null });
      toast.success(deciding.status === 'APPROVED' ? 'Approved. Send the Identity invitation from Netlify → Identity → Users.' : 'Updated');
      setDeciding(null);
      setNote('');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Applications" subtitle="Approving creates a member account and emails an activation link." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Application status">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={status === f} type="button" className={status === f ? 'btn-gold' : 'btn-ghost'} onClick={() => setStatus(f)}>{f.charAt(0) + f.slice(1).toLowerCase()}</button>
        ))}
      </div>
      {loading && <SkeletonBlock rows={5} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && data.applications.length === 0 && <EmptyState>No {status.toLowerCase()} applications.</EmptyState>}
      <div className="space-y-3">
        {(data?.applications || []).map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{a.inGameName} <span className="text-sm font-normal text-muted">· ID {a.playerId}</span></h2>
                <p className="text-xs text-muted">{a.email} · applied {fmtDate(a.createdAt)}</p>
              </div>
              <Badge value={a.status} />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="label">Level</dt><dd>{a.level ?? '—'}</dd></div>
              <div><dt className="label">Power</dt><dd>{a.power || '—'}</dd></div>
              <div><dt className="label">Activity</dt><dd>{a.weeklyActivity || '—'}</dd></div>
            </dl>
            <p className="mt-3 whitespace-pre-wrap text-sm">{a.reason}</p>
            {a.references && <p className="mt-2 text-sm text-muted">References: {a.references}</p>}
            {a.decisionNote && <p className="mt-2 text-sm text-muted">Note: {a.decisionNote}</p>}
            {a.status !== 'APPROVED' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-gold" onClick={() => setDeciding({ app: a, status: 'APPROVED' })}>Approve</button>
                {a.status !== 'WAITLISTED' && <button type="button" className="btn-outline" onClick={() => setDeciding({ app: a, status: 'WAITLISTED' })}>Waitlist</button>}
                {a.status !== 'REJECTED' && <button type="button" className="btn-danger" onClick={() => setDeciding({ app: a, status: 'REJECTED' })}>Reject</button>}
              </div>
            )}
          </Card>
        ))}
      </div>

      {deciding && (
        <Modal title={`${deciding.status.charAt(0) + deciding.status.slice(1).toLowerCase()} ${deciding.app.inGameName}`} onClose={() => setDeciding(null)}>
          <form onSubmit={decide} className="space-y-4">
            <Field label="Note to applicant (optional)" htmlFor="ap-note"><textarea id="ap-note" className="input min-h-[90px]" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDeciding(null)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
