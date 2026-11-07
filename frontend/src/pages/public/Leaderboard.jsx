import { Card, EmptyState, ErrorNote, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtNumber } from '../../lib/format.js';

function Board({ title, entries, scoreLabel }) {
  return (
    <Card>
      <h2 className="mb-3 font-display text-lg font-bold tracking-wide text-gold-soft text-gold">{title}</h2>
      {entries.length === 0 ? (
        <EmptyState>No entries published yet.</EmptyState>
      ) : (
        <Table>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-line">
              <th className="th" scope="col">Rank</th>
              <th className="th" scope="col">Member</th>
              <th className="th text-right" scope="col">{scoreLabel}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={`${e.rank}-${e.name}`} className="border-b border-line/60">
                <td className="td font-bold text-gold">#{e.rank}</td>
                <td className="td">{e.name}</td>
                <td className="td text-right">{fmtNumber(e.score)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export default function Leaderboard() {
  useTitle('Leaderboard');
  const { data, error, loading, reload } = useFetch('/public/leaderboard');
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Public Leaderboard" subtitle="Top BLC donors by cash and coins. Updated automatically from the donations BLC officers record." />
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Board title="Top cash donors" entries={data.cash || []} scoreLabel="Cash donated" />
          <Board title="Top coin donors" entries={data.coins || []} scoreLabel="Coins donated" />
        </div>
      )}
    </div>
  );
}
