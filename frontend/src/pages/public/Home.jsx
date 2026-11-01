import { Link } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';
import { Card, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtNumber } from '../../lib/format.js';

const features = [
  ['Office & maintenance tracker', 'Know exactly who pays which cooperative office each week — with deadlines and reminders.'],
  ['Donation logistics', 'Pledge resources toward cheaper cooperative rewards and watch the top donors climb.'],
  ['Events & competitions', 'One calendar for CEO Races, leaderboard pushes and internal challenges, with RSVP.'],
  ['Strategy forums & wiki', 'Production chains, market trends and office strategy — shared, searchable, permanent.'],
  ['Transparent governance', 'Members vote on tags, strategy and officer elections. Every decision on the record.'],
  ['Document vault', 'Charter, rules and meeting minutes, with access controlled by role.'],
];

function Stat({ label, value, loading }) {
  return (
    <Card className="text-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {loading ? <Skeleton className="mx-auto mt-2 h-8 w-24" /> : <div className="mt-1 font-display text-3xl font-extrabold gold-text">{value}</div>}
    </Card>
  );
}

export default function Home() {
  useTitle('');
  const site = useFetch('/public/site');
  const board = useFetch('/public/leaderboard');
  const settings = site.data?.settings;
  const stats = settings?.stats || {};
  const top = (board.data?.activity || []).slice(0, 5);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface to-canvas">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:py-24">
          <Logo size="lg" />
          <h1 className="mt-8 font-display text-3xl font-extrabold sm:text-5xl">
            BLC Nexus — <span className="gold-text">The Command Center of the Billionaires Club</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted sm:text-lg">
            {settings?.home?.intro || 'A command center for the BILLIONAIRES CLUB (BLC) cooperative in Ticarium: Business Tycoon.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {settings?.recruiting !== false && (
              <Link to="/apply" className="btn-gold px-6 py-3 text-base">
                Apply to Join
              </Link>
            )}
            <Link to="/login" className="btn-outline px-6 py-3 text-base">
              Member Login
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="stats-h">
        <h2 id="stats-h" className="mb-5 font-display text-xl font-bold">Cooperative at a glance</h2>
        {site.error && <ErrorNote error={site.error} retry={site.reload} />}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Members" value={fmtNumber(site.data?.memberCount)} loading={site.loading} />
          <Stat label="Cooperative power" value={fmtNumber(stats.power)} loading={site.loading} />
          <Stat label="Leaderboard rank" value={stats.rank ? `#${stats.rank}` : '—'} loading={site.loading} />
          <Stat label="Office levels" value={stats.officeLevels || '—'} loading={site.loading} />
        </div>
        {stats.note && <p className="mt-3 text-xs text-muted">{stats.note}</p>}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12" aria-labelledby="top-h">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="top-h" className="font-display text-xl font-bold">Top members</h2>
          <Link to="/leaderboard" className="text-sm text-gold underline">Full leaderboard</Link>
        </div>
        <Card>
          {board.loading && <Skeleton className="h-24 w-full" />}
          {!board.loading && top.length === 0 && <p className="text-sm text-muted">The leaderboard has not been published yet.</p>}
          <ol className="divide-y divide-line">
            {top.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="mr-3 inline-block w-6 font-bold text-gold">#{e.rank}</span>{e.name}</span>
                <span className="text-muted">{fmtNumber(e.score)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="feat-h">
        <h2 id="feat-h" className="mb-5 font-display text-xl font-bold">Everything BLC needs in one place</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, text]) => (
            <Card key={title}>
              <h3 className="font-semibold text-gold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
