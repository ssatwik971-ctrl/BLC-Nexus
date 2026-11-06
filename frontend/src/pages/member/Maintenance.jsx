import { useState } from 'react';
import toast from 'react-hot-toast';
import ResourceManager from '../../components/ResourceManager.jsx';
import { Badge, Card, EmptyState, ErrorNote, Field, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { addDays, fmtDate, fmtNumber, isoWeekStart } from '../../lib/format.js';

const STATUSES = ['UNPAID', 'PAID', 'LATE', 'WAIVED'];

/** Weekly maintenance totals. Everyone can see them; only the admin enters them. */
function MaintenanceTotals({ admin }) {
  const { data, error, loading, reload } = useFetch('/maintenance-expenses');
  const [form, setForm] = useState({ weekStart: '', cash: '', coins: '', note: '' });
  const [busy, setBusy] = useState(false);
  const expenses = data?.expenses || [];
  const promptWeek = data?.promptWeek || null;
  const weekValue = form.weekStart || promptWeek || isoWeekStart();

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/maintenance-expenses', {
        weekStart: weekValue,
        cash: Number(form.cash || 0),
        coins: Number(form.coins || 0),
        note: form.note || undefined,
      });
      toast.success('Maintenance total saved and deducted from the coop balance');
      setForm({ weekStart: '', cash: '', coins: '', note: '' });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (x) => {
    if (!window.confirm(`Delete the maintenance total for the week of ${fmtDate(x.weekStart)}? It will be added back to the coop balance.`)) return;
    try {
      await api.del(`/maintenance-expenses/${x.id}`);
      toast.success('Deleted');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <section aria-labelledby="mt-h" className="mb-8">
      <h2 id="mt-h" className="mb-1 font-display text-xl font-bold">Weekly maintenance totals</h2>
      <p className="mb-3 text-sm text-muted">
        The cash and coins the coop paid for maintenance each week. The admin enters these at the end of the week and they are
        deducted from the coop&apos;s total balance.
      </p>

      {error && <ErrorNote error={error} retry={reload} />}

      {admin && promptWeek && (
        <div role="status" className="mb-4 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm">
          <strong>The week of {fmtDate(promptWeek)} is ending or has ended.</strong> Enter the total maintenance cash and coins below.
        </div>
      )}

      {admin && (
        <Card className="mb-4">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-5">
            <Field label="Week starting (Monday)" htmlFor="mt-week">
              <input id="mt-week" type="date" className="input" required value={weekValue} max={isoWeekStart()} onChange={(e) => setForm({ ...form, weekStart: e.target.value })} />
            </Field>
            <Field label="Total cash" htmlFor="mt-cash">
              <input id="mt-cash" type="number" min="0" step="any" required className="input" value={form.cash} onChange={(e) => setForm({ ...form, cash: e.target.value })} />
            </Field>
            <Field label="Total coins" htmlFor="mt-coins">
              <input id="mt-coins" type="number" min="0" step="1" required className="input" value={form.coins} onChange={(e) => setForm({ ...form, coins: e.target.value })} />
            </Field>
            <Field label="Note (optional)" htmlFor="mt-note">
              <input id="mt-note" maxLength={200} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="flex items-end"><button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Saving…' : 'Save total'}</button></div>
          </form>
          <p className="mt-2 text-xs text-muted">Saving again for the same week replaces that week&apos;s total.</p>
        </Card>
      )}

      {loading && !data && <SkeletonBlock rows={3} />}
      {data && expenses.length === 0 && <EmptyState>No weekly maintenance totals recorded yet.</EmptyState>}
      {expenses.length > 0 && (
        <div className="card p-0">
          <Table>
            <thead>
              <tr className="border-b border-line">
                <th className="th" scope="col">Week of</th>
                <th className="th" scope="col">Cash</th>
                <th className="th" scope="col">Coins</th>
                <th className="th" scope="col">Note</th>
                {admin && <th className="th text-right" scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((x) => (
                <tr key={x.id} className="border-b border-line/60">
                  <td className="td font-semibold">{fmtDate(x.weekStart)}</td>
                  <td className="td">{fmtNumber(x.cash)}</td>
                  <td className="td">{fmtNumber(x.coins)}</td>
                  <td className="td text-muted">{x.note || '—'}</td>
                  {admin && <td className="td text-right"><button type="button" className="btn-danger px-2 py-1" onClick={() => remove(x)}>Delete</button></td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}

export default function Maintenance() {
  useTitle('Maintenance');
  const { user, hasRole } = useAuth();
  const officer = hasRole('OFFICER');
  const admin = hasRole('ADMIN');
  const [week, setWeek] = useState(isoWeekStart());
  const [tab, setTab] = useState('week');

  const current = useFetch(`/maintenance?week=${week}`);
  const history = useFetch(tab === 'history' ? '/maintenance/history' : null);

  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      current.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const assignments = current.data?.assignments || [];

  return (
    <>
      <PageHeader
        title="Office & maintenance tracker"
        subtitle="Who pays which office each week. Mark yours as paid once done — an officer verifies."
        actions={
          officer && (
            <>
              <button type="button" className="btn-outline" onClick={() => act(async () => {
                const res = await api.post('/maintenance/remind', { week });
                toast.success(`Reminded ${res.reminded} member(s)`);
              })}>Send reminders</button>
            </>
          )
        }
      />

      <MaintenanceTotals admin={admin} />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Maintenance views">
        {[['week', 'This week'], ['history', 'History']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" className={tab === id ? 'btn-gold' : 'btn-ghost'} onClick={() => setTab(id)}>{label}</button>
        ))}
        {tab === 'week' && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="btn-ghost px-2" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}>←</button>
            <span className="text-sm">Week of <strong>{fmtDate(week)}</strong></span>
            <button type="button" className="btn-ghost px-2" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}>→</button>
          </div>
        )}
      </div>

      {tab === 'week' && (
        <>
          {current.loading && <SkeletonBlock rows={5} />}
          {current.error && <ErrorNote error={current.error} retry={current.reload} />}
          {current.data && assignments.length === 0 && <EmptyState>No per-member maintenance records for this week.</EmptyState>}
          {current.data && assignments.length > 0 && (
            <div className="card p-0">
              <Table>
                <thead>
                  <tr className="border-b border-line">
                    <th className="th" scope="col">Office</th>
                    <th className="th" scope="col">Assigned to</th>
                    <th className="th" scope="col">Cost</th>
                    <th className="th" scope="col">Status</th>
                    <th className="th text-right" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const mine = a.userId === user.id;
                    return (
                      <tr key={a.id} className="border-b border-line/60">
                        <td className="td font-semibold">{a.office.name}</td>
                        <td className="td">{a.user.inGameName}{mine && <span className="text-gold"> (you)</span>}</td>
                        <td className="td text-muted">{fmtNumber(a.office.weeklyMoneyCost)}{a.office.weeklyCoinCost ? ` + ${a.office.weeklyCoinCost} coins` : ''}</td>
                        <td className="td"><Badge value={a.status} /></td>
                        <td className="td text-right">
                          {officer ? (
                            <>
                              <label className="sr-only" htmlFor={`st-${a.id}`}>Status</label>
                              <select id={`st-${a.id}`} className="input inline-block w-auto py-1" value={a.status} onChange={(e) => act(() => api.patch(`/maintenance/${a.id}`, { status: e.target.value }), 'Updated')}>
                                {STATUSES.map((s) => <option key={s}>{s}</option>)}
                              </select>
                              <button type="button" className="btn-danger ml-1 px-2 py-1" onClick={() => window.confirm('Remove this assignment?') && act(() => api.del(`/maintenance/${a.id}`), 'Removed')}>Remove</button>
                            </>
                          ) : (
                            mine && a.status !== 'PAID' && (
                              <button type="button" className="btn-gold px-3 py-1" onClick={() => act(() => api.patch(`/maintenance/${a.id}`, { status: 'PAID' }), 'Marked as paid')}>Mark paid</button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}

        </>
      )}

      {tab === 'history' && (
        <>
          {history.loading && <SkeletonBlock rows={5} />}
          {history.error && <ErrorNote error={history.error} retry={history.reload} />}
          {history.data && history.data.assignments.length === 0 && <EmptyState>No past maintenance records yet.</EmptyState>}
          {history.data && history.data.assignments.length > 0 && (
            <div className="card p-0">
              <Table>
                <thead>
                  <tr className="border-b border-line">
                    <th className="th" scope="col">Week of</th>
                    <th className="th" scope="col">Office</th>
                    <th className="th" scope="col">Member</th>
                    <th className="th" scope="col">Result</th>
                    <th className="th" scope="col">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.assignments.map((a) => (
                    <tr key={a.id} className="border-b border-line/60">
                      <td className="td">{fmtDate(a.weekStart)}</td>
                      <td className="td">{a.office.name}</td>
                      <td className="td">{a.user.inGameName}</td>
                      <td className="td"><Badge value={a.status} /></td>
                      <td className="td text-muted">{a.paidAt ? fmtDate(a.paidAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}

      {officer && (
        <div className="mt-8">
          <ResourceManager
            title="Offices"
            endpoint="/offices"
            listKey="offices"
            canDelete
            defaults={{ level: 1, weeklyMoneyCost: 0, weeklyCoinCost: 0, sortOrder: 0 }}
            columns={[
              { key: 'name', label: 'Office' },
              { key: 'level', label: 'Level' },
              { key: 'weeklyMoneyCost', label: 'Weekly money', render: (o) => fmtNumber(o.weeklyMoneyCost) },
              { key: 'weeklyCoinCost', label: 'Weekly coins', render: (o) => fmtNumber(o.weeklyCoinCost) },
            ]}
            fields={[
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'level', label: 'Level', type: 'number', required: true },
              { name: 'weeklyMoneyCost', label: 'Weekly money cost', type: 'number', required: true },
              { name: 'weeklyCoinCost', label: 'Weekly coin cost', type: 'number', required: true },
              { name: 'sortOrder', label: 'Sort order', type: 'number' },
            ]}
            toForm={(o) => ({ ...o, description: o.description || '' })}
          />
        </div>
      )}
    </>
  );
}
