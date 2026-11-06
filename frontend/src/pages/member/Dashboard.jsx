import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, ErrorNote, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtDateTime, fmtNumber } from '../../lib/format.js';

const quick = [
  ['/app/forums', 'Forums'],
  ['/app/maintenance', 'Maintenance'],
  ['/app/donations', 'Donations'],
  ['/app/weekly-donations', 'Weekly donations'],
  ['/app/documents', 'Document vault'],
];

export default function Dashboard() {
  useTitle('Dashboard');
  const { user, hasRole } = useAuth();
  const { data, error, loading, reload } = useFetch('/dashboard');
  // Only the admin is asked for the weekly maintenance total.
  const totals = useFetch(hasRole('ADMIN') ? '/maintenance-expenses' : null);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.inGameName}`}
        subtitle={`You are signed in as ${user.role.charAt(0) + user.role.slice(1).toLowerCase()}.`}
      />
      {totals.data?.promptWeek && (
        <div role="status" className="mb-4 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm">
          Enter the total maintenance cash and coins for the week of {fmtDate(totals.data.promptWeek)}.{' '}
          <Link to="/app/maintenance" className="text-gold underline">Open maintenance</Link>
        </div>
      )}
      {loading && <SkeletonBlock rows={8} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card><div className="label">Cooperative power</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(data.stats?.power)}</div></Card>
            <Card><div className="label">Weekly money cost</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(data.offices.totalWeeklyMoneyCost)}</div></Card>
            <Card><div className="label">Weekly coin cost</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(data.offices.totalWeeklyCoinCost)}</div></Card>
            <Card><div className="label">This week ends</div><div className="font-display text-xl font-extrabold gold-text">{fmtDate(data.nextMaintenanceDue)}</div></Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-display text-lg font-bold">My weekly donation</h2>
              <p className="text-sm">
                This week: <Badge value={data.myDonationMet ? 'Donated' : 'Not donated'} tone={data.myDonationMet ? 'gold' : 'muted'} />
              </p>
              <p className="mt-2 text-sm text-muted">Officers and the admin mark whether you gave the minimum donation.</p>
              <Link to="/app/weekly-donations" className="mt-3 inline-block text-sm text-gold underline">See everyone&apos;s status</Link>
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-lg font-bold">Pending votes</h2>
              {data.pendingVotes.length === 0 ? (
                <EmptyState>You have voted on everything open.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {data.pendingVotes.map((v) => (
                    <li key={v.id} className="py-2 text-sm">
                      <Link to="/app/votes" className="font-semibold hover:text-gold">{v.title}</Link>
                      <div className="text-muted">Closes {fmtDateTime(v.endTime)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-lg font-bold">Offices</h2>
              <ul className="divide-y divide-line">
                {data.offices.list.map((o) => (
                  <li key={o.id} className="flex justify-between py-2 text-sm">
                    <span>{o.name}</span>
                    <span className="text-muted">Lv {o.level} · {fmtNumber(o.weeklyMoneyCost)}{o.weeklyCoinCost ? ` + ${fmtNumber(o.weeklyCoinCost)} coins` : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quick.map(([to, label]) => (
              <Link key={to} to={to} className="btn-outline py-3">{label}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
