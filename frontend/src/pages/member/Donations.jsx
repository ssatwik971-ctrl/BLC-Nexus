import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, EmptyState, ErrorNote, Field, Modal, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtNumber } from '../../lib/format.js';

const todayInput = () => new Date().toISOString().slice(0, 10);

const SECTIONS = {
  CASH: {
    title: 'Cash donations',
    unit: 'cash',
    hint: 'In-game cash given to the cooperative.',
    step: 'any',
    empty: 'No cash donations recorded yet.',
  },
  COINS: {
    title: 'Coin donations',
    unit: 'coins',
    hint: 'Coins given to the cooperative (whole numbers).',
    step: '1',
    empty: 'No coin donations recorded yet.',
  },
};

/** One self-contained section (summary, top donors, history) per donation type. */
function DonationSection({ type, officer, members }) {
  const cfg = SECTIONS[type];
  const list = useFetch(`/donations?type=${type}`);
  const board = useFetch(`/donations/leaderboard?type=${type}`);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ userId: '', amount: '', note: '', donatedAt: todayInput() });

  const reload = () => {
    list.reload();
    board.reload();
  };

  const record = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/donations', {
        userId: form.userId,
        type,
        amount: Number(form.amount),
        note: form.note || undefined,
        donatedAt: form.donatedAt || undefined,
      });
      toast.success(`${cfg.title.replace(' donations', '')} donation recorded`);
      setOpen(false);
      setForm({ userId: '', amount: '', note: '', donatedAt: todayInput() });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete this ${cfg.unit} donation from ${d.user?.inGameName || 'this member'}?`)) return;
    try {
      await api.del(`/donations/${d.id}`);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const id = type.toLowerCase();
  const donations = list.data?.donations || [];

  return (
    <section aria-labelledby={`${id}-h`} className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${id}-h`} className="font-display text-xl font-bold">{cfg.title}</h2>
          <p className="text-sm text-muted">{cfg.hint}</p>
        </div>
        {officer && (
          <button type="button" className="btn-gold" onClick={() => setOpen(true)}>
            Record {cfg.unit} donation
          </button>
        )}
      </div>

      {list.error && <ErrorNote error={list.error} retry={reload} />}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <div className="label">Coop&apos;s total balance</div>
          <div className="font-display text-2xl font-extrabold gold-text">{list.data ? fmtNumber(list.data.balance) : '—'}</div>
        </Card>
        <Card>
          <div className="label">Total donated</div>
          <div className="font-display text-2xl font-extrabold gold-text">{list.data ? fmtNumber(list.data.total) : '—'}</div>
        </Card>
        <Card>
          <div className="label">Paid for maintenance</div>
          <div className="font-display text-2xl font-extrabold gold-text">{list.data ? fmtNumber(list.data.spent) : '—'}</div>
        </Card>
        <Card>
          <div className="label">My total</div>
          <div className="font-display text-2xl font-extrabold gold-text">{list.data ? fmtNumber(list.data.mine) : '—'}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-3 font-display text-lg font-bold">Recent {cfg.unit} donations</h3>
          {list.loading && !list.data && <SkeletonBlock rows={4} />}
          {list.data && donations.length === 0 && <EmptyState>{cfg.empty}</EmptyState>}
          {donations.length > 0 && (
            <Table>
              <thead>
                <tr className="border-b border-line">
                  <th className="th" scope="col">Member</th>
                  <th className="th" scope="col">Amount</th>
                  <th className="th" scope="col">Date</th>
                  <th className="th" scope="col">Note</th>
                  {officer && <th className="th text-right" scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="td font-semibold">{d.user?.inGameName || '—'}</td>
                    <td className="td">{fmtNumber(d.amount)}</td>
                    <td className="td text-muted">{fmtDate(d.donatedAt)}</td>
                    <td className="td text-muted">{d.note || '—'}</td>
                    {officer && (
                      <td className="td whitespace-nowrap text-right">
                        <button type="button" className="btn-danger px-2 py-1" onClick={() => remove(d)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-display text-lg font-bold">Top {cfg.unit} donors</h3>
          {board.loading && !board.data && <SkeletonBlock rows={4} />}
          {board.data && board.data.leaderboard.length === 0 && <EmptyState>No donors yet.</EmptyState>}
          <ol className="divide-y divide-line">
            {(board.data?.leaderboard || []).map((d) => (
              <li key={d.userId} className="flex justify-between py-2 text-sm">
                <span><span className="mr-2 font-bold text-gold">#{d.rank}</span>{d.name}</span>
                <span className="text-muted">{fmtNumber(d.total)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {open && (
        <Modal title={`Record ${cfg.unit} donation`} onClose={() => setOpen(false)}>
          <form onSubmit={record} className="space-y-4">
            <Field label="Member" htmlFor={`${id}-member`}>
              <select id={`${id}-member`} className="input" required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                <option value="" disabled>Select a member…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.inGameName}</option>)}
              </select>
            </Field>
            <Field label={`Amount (${cfg.unit})`} htmlFor={`${id}-amount`} hint={cfg.hint}>
              <input id={`${id}-amount`} type="number" min="1" step={cfg.step} required className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date" htmlFor={`${id}-date`}>
              <input id={`${id}-date`} type="date" className="input" value={form.donatedAt} onChange={(e) => setForm({ ...form, donatedAt: e.target.value })} />
            </Field>
            <Field label="Note (optional)" htmlFor={`${id}-note`}>
              <input id={`${id}-note`} maxLength={200} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? 'Saving…' : 'Record donation'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

export default function Donations() {
  useTitle('Donations');
  const { hasRole } = useAuth();
  const officer = hasRole('OFFICER');
  // Only officers record donations, so only they need the member list.
  const roster = useFetch(officer ? '/users' : null);
  const members = roster.data?.members || [];

  return (
    <>
      <PageHeader
        title="Donations"
        subtitle="Cash and coins donated to the cooperative, tracked in separate sections. Officers record each donation after it is made in-game."
      />
      {roster.error && <ErrorNote error={roster.error} retry={roster.reload} />}
      <DonationSection type="CASH" officer={officer} members={members} />
      <DonationSection type="COINS" officer={officer} members={members} />
    </>
  );
}
