import { useState } from 'react';
import toast from 'react-hot-toast';
import ResourceManager from '../../components/ResourceManager.jsx';
import { Badge, Card, EmptyState, ErrorNote, Field, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { addDays, fmtDate, fmtNumber, isoWeekStart } from '../../lib/format.js';

const STATUSES = ['UNPAID', 'PAID', 'LATE', 'WAIVED'];

export default function Maintenance() {
  useTitle('Maintenance');
  const { user, hasRole } = useAuth();
  const officer = hasRole('OFFICER');
  const [week, setWeek] = useState(isoWeekStart());
  const [tab, setTab] = useState('week');
  const [form, setForm] = useState({ officeId: '', userId: '' });

  const current = useFetch(`/maintenance?week=${week}`);
  const history = useFetch(tab === 'history' ? '/maintenance/history' : null);
  const offices = useFetch(officer ? '/offices' : null);
  const members = useFetch(officer ? '/users' : null);

  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      current.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const assign = (e) => {
    e.preventDefault();
    act(() => api.post('/maintenance', { ...form, weekStart: week }), 'Assigned');
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
                const res = await api.post('/maintenance/copy-week', { from: addDays(week, -7), to: week });
                toast(`Copied ${res.created} assignment(s) from last week`);
              })}>Copy last week</button>
              <button type="button" className="btn-outline" onClick={() => act(async () => {
                const res = await api.post('/maintenance/remind', { week });
                toast.success(`Reminded ${res.reminded} member(s)`);
              })}>Send reminders</button>
            </>
          )
        }
      />

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
          {current.data && assignments.length === 0 && <EmptyState>No assignments for this week yet.</EmptyState>}
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

          {officer && (
            <Card className="mt-6">
              <h2 className="mb-3 font-display text-lg font-bold">Assign maintenance for the week of {fmtDate(week)}</h2>
              <form onSubmit={assign} className="grid gap-4 sm:grid-cols-3">
                <Field label="Office" htmlFor="m-office">
                  <select id="m-office" className="input" required value={form.officeId} onChange={(e) => setForm({ ...form, officeId: e.target.value })}>
                    <option value="">Select…</option>
                    {(offices.data?.offices || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </Field>
                <Field label="Member" htmlFor="m-user">
                  <select id="m-user" className="input" required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                    <option value="">Select…</option>
                    {(members.data?.members || []).map((m) => <option key={m.id} value={m.id}>{m.inGameName}</option>)}
                  </select>
                </Field>
                <div className="flex items-end"><button type="submit" className="btn-gold w-full">Assign</button></div>
              </form>
            </Card>
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
