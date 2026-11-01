import { useState } from 'react';
import toast from 'react-hot-toast';
import ResourceManager from '../../components/ResourceManager.jsx';
import { Badge, Card, EmptyState, ErrorNote, Field, Modal, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtNumber } from '../../lib/format.js';

export default function Donations() {
  useTitle('Donations');
  const { user, hasRole } = useAuth();
  const officer = hasRole('OFFICER');
  const rewards = useFetch('/rewards');
  const pledges = useFetch('/pledges');
  const board = useFetch('/pledges/leaderboard');
  const [pledging, setPledging] = useState(null);
  const [form, setForm] = useState({ amount: '', note: '' });

  const reloadAll = () => {
    rewards.reload();
    pledges.reload();
    board.reload();
  };

  const submitPledge = async (e) => {
    e.preventDefault();
    try {
      await api.post('/pledges', { rewardItemId: pledging.id, amount: Number(form.amount), note: form.note || undefined });
      toast.success('Pledge recorded. Hand over the resources in-game and an officer will confirm.');
      setPledging(null);
      setForm({ amount: '', note: '' });
      reloadAll();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setPledge = async (id, status) => {
    try {
      await api.patch(`/pledges/${id}`, { status });
      toast.success('Updated');
      reloadAll();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Donations & rewards" subtitle="Pledge in-game resources or coins toward cooperative rewards — cheaper than the store. Tracked manually." />

      <section aria-labelledby="rw-h" className="mb-8">
        <h2 id="rw-h" className="mb-3 font-display text-lg font-bold">Available rewards</h2>
        {rewards.loading && <SkeletonBlock rows={3} />}
        {rewards.error && <ErrorNote error={rewards.error} retry={rewards.reload} />}
        {rewards.data && rewards.data.rewards.length === 0 && <EmptyState>No rewards configured yet.</EmptyState>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(rewards.data?.rewards || []).map((r) => {
            const pct = r.donationCost ? Math.min(100, Math.round((r.fulfilled / r.donationCost) * 100)) : 0;
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gold">{r.name}</h3>
                  <Badge value={r.status} />
                </div>
                <p className="mt-1 text-sm text-muted">{r.description}</p>
                <p className="mt-3 text-sm">Cost: <strong>{fmtNumber(r.donationCost)} {r.currency}</strong></p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} funding`}>
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">{fmtNumber(r.fulfilled)} received · {fmtNumber(r.pledged)} pledged</p>
                {r.status === 'AVAILABLE' && (
                  <button type="button" className="btn-gold mt-3 w-full" onClick={() => setPledging(r)}>Pledge</button>
                )}
                {officer && (
                  <div className="mt-3">
                    <label className="sr-only" htmlFor={`rs-${r.id}`}>Reward status</label>
                    <select id={`rs-${r.id}`} className="input py-1" value={r.status} onChange={async (e) => {
                      try { await api.patch(`/rewards/${r.id}`, { status: e.target.value }); reloadAll(); } catch (err) { toast.error(errorMessage(err)); }
                    }}>
                      {['AVAILABLE', 'PURCHASED', 'CLAIMED'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-bold">Pledges</h2>
          {pledges.loading && <SkeletonBlock rows={4} />}
          {pledges.data && pledges.data.pledges.length === 0 && <EmptyState>No pledges yet — be the first!</EmptyState>}
          {pledges.data && pledges.data.pledges.length > 0 && (
            <Table>
              <thead>
                <tr className="border-b border-line">
                  <th className="th" scope="col">Member</th>
                  <th className="th" scope="col">Reward</th>
                  <th className="th" scope="col">Amount</th>
                  <th className="th" scope="col">Status</th>
                  <th className="th text-right" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pledges.data.pledges.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="td">{p.user.inGameName}<div className="text-xs text-muted">{fmtDate(p.createdAt)}</div></td>
                    <td className="td">{p.reward.name}</td>
                    <td className="td">{fmtNumber(p.amount)}</td>
                    <td className="td"><Badge value={p.status} /></td>
                    <td className="td whitespace-nowrap text-right">
                      {officer && p.status === 'PENDING' && <button type="button" className="btn-gold px-2 py-1" onClick={() => setPledge(p.id, 'FULFILLED')}>Mark received</button>}
                      {(officer || p.userId === user.id) && p.status === 'PENDING' && <button type="button" className="btn-danger ml-1 px-2 py-1" onClick={() => setPledge(p.id, 'CANCELLED')}>Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold">Top donors</h2>
          {board.loading && <SkeletonBlock rows={4} />}
          {board.data && board.data.leaderboard.length === 0 && <EmptyState>No completed donations yet.</EmptyState>}
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

      {officer && (
        <div className="mt-8">
          <ResourceManager
            title="Manage rewards"
            endpoint="/rewards"
            listKey="rewards"
            canDelete={hasRole('ADMIN')}
            defaults={{ currency: 'coins', type: 'general', donationCost: 0 }}
            columns={[
              { key: 'name', label: 'Reward' },
              { key: 'donationCost', label: 'Cost', render: (r) => `${fmtNumber(r.donationCost)} ${r.currency}` },
              { key: 'type', label: 'Type' },
              { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            ]}
            fields={[
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'donationCost', label: 'Donation cost', type: 'number', required: true },
              { name: 'currency', label: 'Currency / resource', type: 'text', required: true },
              { name: 'type', label: 'Type', type: 'text', required: true },
            ]}
            toForm={(r) => ({ name: r.name, description: r.description || '', donationCost: r.donationCost, currency: r.currency, type: r.type })}
            onChange={reloadAll}
          />
        </div>
      )}

      {pledging && (
        <Modal title={`Pledge to ${pledging.name}`} onClose={() => setPledging(null)}>
          <form onSubmit={submitPledge} className="space-y-4">
            <Field label={`Amount (${pledging.currency})`} htmlFor="pl-amt"><input id="pl-amt" type="number" min="1" step="any" required className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Note (optional)" htmlFor="pl-note"><input id="pl-note" maxLength={200} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPledging(null)}>Cancel</button>
              <button type="submit" className="btn-gold">Confirm pledge</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
