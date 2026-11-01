import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ResourceManager from '../../components/ResourceManager.jsx';
import { Badge, Card, EmptyState, ErrorNote, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDateTime, fromLocalInput, titleCase, toLocalInput } from '../../lib/format.js';

const TYPES = ['CEO_RACE', 'LEADERBOARD', 'CHALLENGE', 'MEETING', 'OTHER'].map((v) => ({ value: v, label: titleCase(v) }));
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Calendar() {
  useTitle('Calendar');
  const { hasRole } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState(null);

  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString();
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const { data, error, loading, reload } = useFetch(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const events = data?.events || [];

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const k = dayKey(new Date(e.startTime));
      map.set(k, [...(map.get(k) || []), e]);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))];
  }, [cursor]);

  const shown = selected ? byDay.get(selected) || [] : events;

  const rsvp = async (id, status) => {
    try {
      await api.post(`/events/${id}/rsvp`, { status });
      toast.success('RSVP saved');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Events & competitions" subtitle="CEO Races, leaderboard pushes, challenges and meetings. Times are shown in your local timezone." />

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="btn-ghost" aria-label="Previous month" onClick={() => { setSelected(null); setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); }}>←</button>
          <h2 className="font-display text-lg font-bold">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button type="button" className="btn-ghost" aria-label="Next month" onClick={() => { setSelected(null); setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); }}>→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const k = dayKey(d);
            const count = byDay.get(k)?.length || 0;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(selected === k ? null : k)}
                aria-pressed={selected === k}
                aria-label={`${d.toLocaleDateString(undefined, { dateStyle: 'full' })}${count ? `, ${count} event${count > 1 ? 's' : ''}` : ''}`}
                className={`flex h-12 flex-col items-center justify-center rounded-lg border text-sm transition sm:h-14 ${selected === k ? 'border-gold bg-gold/15' : 'border-line hover:bg-raised'}`}
              >
                <span>{d.getDate()}</span>
                {count > 0 && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </Card>

      {loading && <SkeletonBlock rows={4} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && shown.length === 0 && <EmptyState>No events {selected ? 'on this day' : 'this month'}.</EmptyState>}
      <div className="space-y-3">
        {shown.map((e) => (
          <Card key={e.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{e.title}</h3>
                <p className="text-sm text-muted">{fmtDateTime(e.startTime)}{e.endTime ? ` → ${fmtDateTime(e.endTime)}` : ''}</p>
              </div>
              <Badge value={e.type} tone="gold" />
            </div>
            {e.description && <p className="mt-2 whitespace-pre-wrap text-sm">{e.description}</p>}
            {e.rsvpEnabled && (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`RSVP for ${e.title}`}>
                {['GOING', 'MAYBE', 'NOT_GOING'].map((s) => (
                  <button key={s} type="button" aria-pressed={e.myRsvp === s} className={e.myRsvp === s ? 'btn-gold px-3 py-1' : 'btn-outline px-3 py-1'} onClick={() => rsvp(e.id, s)}>
                    {titleCase(s)}
                  </button>
                ))}
                <span className="text-xs text-muted">{e.going} going · {e.maybe} maybe</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {hasRole('OFFICER') && (
        <div className="mt-8">
          <ResourceManager
            title="Manage events"
            endpoint="/events"
            listKey="events"
            canDelete
            defaults={{ type: 'OTHER', rsvpEnabled: true }}
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'startTime', label: 'Starts', render: (e) => fmtDateTime(e.startTime) },
              { key: 'type', label: 'Type', render: (e) => titleCase(e.type) },
            ]}
            fields={[
              { name: 'title', label: 'Title', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'startTime', label: 'Start', type: 'datetime', required: true },
              { name: 'endTime', label: 'End (optional)', type: 'datetime' },
              { name: 'type', label: 'Type', type: 'select', options: TYPES, required: true },
              { name: 'rsvpEnabled', label: 'Enable RSVP', type: 'checkbox' },
            ]}
            toForm={(e) => ({ ...e, description: e.description || '', startTime: toLocalInput(e.startTime), endTime: toLocalInput(e.endTime) })}
            toPayload={(f) => ({
              title: f.title,
              description: f.description || null,
              startTime: fromLocalInput(f.startTime),
              endTime: fromLocalInput(f.endTime),
              type: f.type || 'OTHER',
              rsvpEnabled: Boolean(f.rsvpEnabled),
            })}
            onChange={reload}
          />
        </div>
      )}
    </>
  );
}
