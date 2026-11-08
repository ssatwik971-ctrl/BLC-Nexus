import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, EmptyState, ErrorNote, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtCompact, fmtDate, fmtFull, fmtNumber } from '../../lib/format.js';

const axis = { fill: 'rgb(var(--c-muted))', fontSize: 12 };
const tooltipStyle = { background: 'rgb(var(--c-surface))', border: '1px solid rgb(var(--c-gold))', color: 'rgb(var(--c-text))' };

export default function Performance() {
  useTitle('Performance');
  const { data, error, loading, reload } = useFetch('/audit/snapshots');
  // Oldest first, numbers coerced (the API can return them as strings), one point per date.
  const rows = (data?.snapshots || [])
    .map((s) => ({
      ...s,
      power: Number(s.power),
      rank: s.rank === null || s.rank === undefined ? null : Number(s.rank),
      memberCount: s.memberCount === null || s.memberCount === undefined ? null : Number(s.memberCount),
      label: fmtDate(s.date),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = rows[rows.length - 1];

  return (
    <>
      <PageHeader title="Cooperative performance" subtitle="Power, rank and membership over time (snapshots entered by officers)." />
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && rows.length === 0 && <EmptyState>No snapshots recorded yet. Officers can add them under Management → Content.</EmptyState>}
      {rows.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="card-lift"><div className="label">Latest power</div><div className="font-display text-2xl font-bold gold-text">{fmtNumber(latest.power)}</div></Card>
            <Card className="card-lift"><div className="label">Latest rank</div><div className="font-display text-2xl font-bold gold-text">{latest.rank ? `#${latest.rank}` : '—'}</div></Card>
            <Card className="card-lift"><div className="label">Members</div><div className="font-display text-2xl font-bold gold-text">{fmtNumber(latest.memberCount)}</div></Card>
          </div>

          <Card>
            <h2 className="mb-3 font-display text-lg font-bold tracking-wide text-gold-soft">Power over time</h2>
            <div className="h-72" role="img" aria-label="Line chart of cooperative power over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="rgb(var(--c-line))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={axis} stroke="rgb(var(--c-line))" minTickGap={24} />
                  <YAxis tick={axis} stroke="rgb(var(--c-line))" width={72} domain={['auto', 'auto']} tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${fmtCompact(v)} (${fmtFull(v)})`, 'Power']} />
                  <Line type="monotone" dataKey="power" name="Power" stroke="rgb(var(--c-gold))" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg font-bold tracking-wide text-gold-soft">Leaderboard rank &amp; members</h2>
            <p className="mb-2 text-xs text-muted">A lower rank number is better.</p>
            <div className="h-64" role="img" aria-label="Line chart of leaderboard rank and member count over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="rgb(var(--c-line))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={axis} stroke="rgb(var(--c-line))" minTickGap={24} />
                  <YAxis yAxisId="rank" reversed tick={axis} stroke="rgb(var(--c-line))" width={48} allowDecimals={false} domain={['auto', 'auto']} tickFormatter={(v) => fmtCompact(v)} />
                  <YAxis yAxisId="members" orientation="right" tick={axis} stroke="rgb(var(--c-line))" width={48} allowDecimals={false} domain={['auto', 'auto']} tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [fmtFull(v), name]} />
                  <Legend />
                  <Line yAxisId="rank" type="monotone" dataKey="rank" name="Rank" stroke="rgb(var(--c-gold-soft))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="members" type="monotone" dataKey="memberCount" name="Members" stroke="rgb(var(--c-ok))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0">
            <Table>
              <caption className="sr-only">Snapshot history</caption>
              <thead>
                <tr className="border-b border-line">
                  <th className="th" scope="col">Date</th><th className="th" scope="col">Power</th><th className="th" scope="col">Rank</th><th className="th" scope="col">Members</th><th className="th" scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-line/60">
                    <td className="td">{s.label}</td><td className="td">{fmtNumber(s.power)}</td><td className="td">{s.rank ? `#${s.rank}` : '—'}</td><td className="td">{fmtNumber(s.memberCount)}</td><td className="td text-muted">{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
