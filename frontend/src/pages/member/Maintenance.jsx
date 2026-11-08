import { useState } from 'react';
import toast from 'react-hot-toast';
import ResourceManager from '../../components/ResourceManager.jsx';
import { Card, EmptyState, ErrorNote, Field, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { downloadCsv } from '../../lib/csv.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtFull, fmtNumber, isoWeekStart } from '../../lib/format.js';

const OFFICE_NAMES = ['Headquarters', 'Side Job Office', 'Quality Office', 'Energy Office', 'Media Office', 'R&D Office'];
const MAX_LEVEL = { Headquarters: 10, 'Side Job Office': 5, 'Quality Office': 5, 'Energy Office': 5, 'Media Office': 5, 'R&D Office': 3 };

/** Weekly maintenance totals. Everyone can see them; only the admin enters them. */
function MaintenanceTotals({ admin }) {
  const { data, error, loading, reload } = useFetch('/maintenance-expenses');
  // Current coop balances, used to warn the admin before the balance would go negative.
  const cashBal = useFetch(admin ? '/donations?type=CASH' : null);
  const coinBal = useFetch(admin ? '/donations?type=COINS' : null);
  const [form, setForm] = useState({ weekStart: '', cash: '', coins: '', note: '' });
  const [busy, setBusy] = useState(false);
  const expenses = data?.expenses || [];
  const promptWeek = data?.promptWeek || null;
  const weekValue = form.weekStart || promptWeek || isoWeekStart();

  const latest = expenses[0];
  const useLast = () => latest && setForm({ ...form, cash: String(latest.cash), coins: String(latest.coins) });

  const save = async (e) => {
    e.preventDefault();
    // Entering a week again replaces it, so add that week's old amounts back before comparing.
    const old = expenses.find((x) => String(x.weekStart).slice(0, 10) === weekValue);
    const cashAfter = (cashBal.data?.balance ?? Infinity) + (old?.cash || 0) - Number(form.cash || 0);
    const coinsAfter = (coinBal.data?.balance ?? Infinity) + (old?.coins || 0) - Number(form.coins || 0);
    if ((cashAfter < 0 || coinsAfter < 0)
      && !window.confirm('This is more than the coop currently holds, so the balance will go negative. Save anyway?')) return;
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
      cashBal.reload();
      coinBal.reload();
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
      cashBal.reload();
      coinBal.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const exportCsv = () => downloadCsv('maintenance-totals.csv', [
    ['Week of', 'Cash', 'Coins', 'Note'],
    ...expenses.map((x) => [String(x.weekStart).slice(0, 10), x.cash, x.coins, x.note || '']),
  ]);

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
          {latest && (
            <button type="button" className="btn-ghost mt-2 px-2 py-1 text-sm" onClick={useLast}>
              Use the last saved amounts ({fmtNumber(latest.cash)} cash, {fmtNumber(latest.coins)} coins)
            </button>
          )}
          <p className="mt-2 text-xs text-muted">Saving again for the same week replaces that week&apos;s total.</p>
        </Card>
      )}

      {expenses.length > 0 && (
        <div className="mb-2 text-right"><button type="button" className="btn-outline px-3 py-1 text-sm" onClick={exportCsv}>Download CSV</button></div>
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
  const { hasRole } = useAuth();
  const admin = hasRole('ADMIN');
  // One fetch feeds the power note and the read-only table; the admin editor reloads it after each change.
  const offices = useFetch('/offices');
  const officeList = offices.data?.offices || [];

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Weekly maintenance totals paid by the coop, plus the office costs."
      />

      <MaintenanceTotals admin={admin} />

      {offices.data && (
        <div role="status" className="mb-4 rounded-lg border border-line bg-surface p-3 text-sm">
          Office cash costs use the coop power of <strong>{fmtNumber(offices.data.power)}</strong> ({fmtFull(offices.data.power)})
          {offices.data.powerDate ? <> recorded on {fmtDate(offices.data.powerDate)}</> : null}. They are 0.5% of power, split by office
          and level, and update by themselves when a new power snapshot is added under Management → Content.
          Total per week: <strong>{fmtNumber(offices.data.totalWeeklyMoneyCost)}</strong>.
        </div>
      )}

      {admin ? (
        <ResourceManager
          title="Offices"
          endpoint="/offices"
          listKey="offices"
          canDelete
          onChange={offices.reload}
          defaults={{ name: OFFICE_NAMES[0], level: 1, sortOrder: 0 }}
          columns={[
            { key: 'name', label: 'Office' },
            { key: 'level', label: 'Level', render: (o) => (o.maxLevel ? `${o.level} / ${o.maxLevel}` : o.level) },
            { key: 'weeklyMoneyCost', label: 'Weekly cash', render: (o) => fmtNumber(o.weeklyMoneyCost) },
          ]}
          fields={[
            { name: 'name', label: 'Office', type: 'select', required: true, options: OFFICE_NAMES },
            { name: 'level', label: 'Level', type: 'number', required: true },
            { name: 'sortOrder', label: 'Sort order', type: 'number' },
          ]}
          toForm={(o) => ({ name: o.name, level: o.level, sortOrder: o.sortOrder })}
          toPayload={(f) => {
            const max = MAX_LEVEL[f.name];
            if (max && Number(f.level) > max) throw new Error(`${f.name} has a maximum level of ${max}.`);
            return { name: f.name, level: Number(f.level), sortOrder: Number(f.sortOrder || 0) };
          }}
        />
      ) : (
        <section aria-labelledby="off-h">
          <h2 id="off-h" className="mb-2 font-display text-xl font-bold">Offices</h2>
          {offices.loading && <SkeletonBlock rows={3} />}
          {offices.error && <ErrorNote error={offices.error} retry={offices.reload} />}
          {offices.data && officeList.length === 0 && <EmptyState>No offices yet.</EmptyState>}
          {officeList.length > 0 && (
            <div className="card p-0">
              <Table>
                <thead>
                  <tr className="border-b border-line">
                    <th className="th" scope="col">Office</th>
                    <th className="th" scope="col">Level</th>
                    <th className="th" scope="col">Weekly cash</th>
                  </tr>
                </thead>
                <tbody>
                  {officeList.map((o) => (
                    <tr key={o.id} className="border-b border-line/60">
                      <td className="td font-semibold">{o.name}</td>
                      <td className="td">{o.maxLevel ? `${o.level} / ${o.maxLevel}` : o.level}</td>
                      <td className="td">{fmtNumber(o.weeklyMoneyCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
