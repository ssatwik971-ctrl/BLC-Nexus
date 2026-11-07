import { Link } from 'react-router-dom';
import { Card, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtNumber } from '../../lib/format.js';

const features = [
  ['Weekly maintenance & donations', 'See what the coop paid for maintenance each week and who gave the minimum donation.'],
  ['Cash & coin donations', 'Every cash and coin donation to the cooperative is recorded openly, with a top-donor board for each.'],
  ['Strategy forums & wiki', 'Production chains, market trends and office strategy — shared, searchable, permanent.'],
  ['Transparent governance', 'Members vote on tags, strategy and officer elections. Every decision on the record.'],
  ['Document vault', 'Charter, rules and meeting minutes, with access controlled by role.'],
];

function Stat({ label, value, loading }) {
  return (
    <Card className="card-lift text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      {loading ? <Skeleton className="mx-auto mt-2 h-8 w-24" /> : <div className="mt-2 font-display text-3xl font-bold gold-text">{value}</div>}
    </Card>
  );
}

export default function Home() {
  useTitle('');
  const site = useFetch('/public/site');
  const board = useFetch('/public/leaderboard');
  const settings = site.data?.settings;
  const stats = settings?.stats || {};
  const topCash = (board.data?.cash || []).slice(0, 5);
  const topCoins = (board.data?.coins || []).slice(0, 5);

  return (
    <>
      <section className="relative overflow-hidden border-b border-gold/20">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-14 text-center sm:py-24">
          <div className="plaque animate-fade-up w-56 sm:w-72">
            <img src="/crest.png" width="640" height="492" alt="Billionaires Club crest: a griffin holding a key on a shield" />
          </div>
          <h1 className="animate-fade-up mt-10 font-display text-3xl font-bold leading-tight tracking-wide sm:text-5xl" style={{ animationDelay: '0.1s' }}>
            BLC Nexus <span className="gold-text shimmer-text block sm:mt-2">The Command Center of the Billionaires Club</span>
          </h1>
          <p className="animate-fade-up mt-5 max-w-2xl text-base text-muted sm:text-lg" style={{ animationDelay: '0.2s' }}>
            {settings?.home?.intro || 'A command center for the BILLIONAIRES CLUB (BLC) cooperative in Ticarium: Business Tycoon.'}
          </p>
          <div className="animate-fade-up mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.3s' }}>
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
        <h2 id="stats-h" className="mb-5 font-display text-xl font-bold tracking-wide text-gold">Cooperative at a glance</h2>
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
          <h2 id="top-h" className="font-display text-xl font-bold tracking-wide text-gold">Top donors</h2>
          <Link to="/leaderboard" className="text-sm text-gold underline">Full leaderboard</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[['Cash', topCash], ['Coins', topCoins]].map(([label, list]) => (
            <Card key={label}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gold-soft">{label}</h3>
              {board.loading && <Skeleton className="h-24 w-full" />}
              {!board.loading && list.length === 0 && <p className="text-sm text-muted">No donations recorded yet.</p>}
              <ol className="divide-y divide-line">
                {list.map((e) => (
                  <li key={`${e.rank}-${e.name}`} className="flex items-center justify-between py-2 text-sm">
                    <span><span className="mr-3 inline-block w-6 font-bold text-gold">#{e.rank}</span>{e.name}</span>
                    <span className="text-muted">{fmtNumber(e.score)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="feat-h">
        <h2 id="feat-h" className="mb-5 font-display text-xl font-bold tracking-wide text-gold">Everything BLC needs in one place</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, text]) => (
            <Card key={title} className="card-lift">
              <span className="mb-3 block h-1.5 w-1.5 rotate-45 bg-gold shadow-glow" aria-hidden="true" />
              <h3 className="font-display font-semibold tracking-wide text-gold-soft">{title}</h3>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
