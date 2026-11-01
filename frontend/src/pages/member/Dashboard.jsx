import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, ErrorNote, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtDateTime, fmtNumber } from '../../lib/format.js';

const quick = [
  ['/app/forums', 'Forums'],
  ['/app/calendar', 'Calendar'],
  ['/app/donations', 'Donations'],
  ['/app/documents', 'Document vault'],
];

export default function Dashboard() {
  useTitle('Dashboard');
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch('/dashboard');

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.inGameName}`}
        subtitle={`You are signed in as ${user.role.charAt(0) + user.role.slice(1).toLowerCase()}.`}
      />
      {loading && <SkeletonBlock rows={8} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card><div className="label">Cooperative power</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(data.stats?.power)}</div></Card>
            <Card><div className="label">Weekly money cost</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(data.offices.totalWeeklyMoneyCost)}</div></Card>
            <Card><div className="label">Weekly coin cost</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(data.offices.totalWeeklyCoinCost)}</div></Card>
            <Card><div className="label">Next maintenance due</div><div className="font-display text-xl font-extrabold gold-text">{fmtDate(data.nextMaintenanceDue)}</div></Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-display text-lg font-bold">My maintenance assignments</h2>
              {data.myAssignments.length === 0 ? (
                <EmptyState>No assignments this week or later.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {data.myAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{a.office.name} <span className="text-muted">· week of {fmtDate(a.weekStart)}</span></span>
                      <Badge value={a.status} />
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/maintenance" className="mt-3 inline-block text-sm text-gold underline">Open maintenance tracker</Link>
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-lg font-bold">Upcoming events</h2>
              {data.upcomingEvents.length === 0 ? (
                <EmptyState>No upcoming events.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {data.upcomingEvents.map((e) => (
                    <li key={e.id} className="py-2 text-sm">
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-muted">{fmtDateTime(e.startTime)}</div>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/calendar" className="mt-3 inline-block text-sm text-gold underline">Open calendar</Link>
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
