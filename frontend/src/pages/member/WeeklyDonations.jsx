import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, EmptyState, ErrorNote, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { addDays, fmtDate, isoWeekStart } from '../../lib/format.js';

const GROUPS = [
  ['ADMIN', 'Admin'],
  ['OFFICER', 'Officers'],
  ['MEMBER', 'Members'],
];

/** Everyone can see who gave the minimum weekly donation; officers and the admin set it. */
export default function WeeklyDonations() {
  useTitle('Weekly donations');
  const { hasRole } = useAuth();
  const canEdit = hasRole('OFFICER');
  const thisWeek = isoWeekStart();
  const [week, setWeek] = useState(thisWeek);
  const [busyId, setBusyId] = useState(null);
  const { data, error, loading, reload } = useFetch(`/donation-status?week=${week}`);
  const people = data?.people || [];

  const setStatus = async (p, met) => {
    setBusyId(p.id);
    try {
      await api.put('/donation-status', { userId: p.id, met, weekStart: week });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Weekly donation status"
        subtitle="Whether each player gave the minimum donation this week. Officers and the admin update it; everyone can see it."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost px-2" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}>←</button>
          <span className="text-sm">Week of <strong>{fmtDate(week)}</strong></span>
          <button type="button" className="btn-ghost px-2" aria-label="Next week" disabled={week >= thisWeek} onClick={() => setWeek(addDays(week, 7))}>→</button>
        </div>
        {data && <p className="text-sm text-muted">{data.metCount} of {people.length} gave the minimum</p>}
      </div>

      {loading && !data && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && people.length === 0 && <EmptyState>No players found.</EmptyState>}

      {data && people.length > 0 && (
        <div className="space-y-6">
          {GROUPS.map(([role, label]) => {
            const rows = people.filter((p) => p.role === role);
            if (!rows.length) return null;
            return (
              <section key={role} aria-labelledby={`wd-${role}`}>
                <h2 id={`wd-${role}`} className="mb-2 font-display text-lg font-bold">{label}</h2>
                <div className="card p-0">
                  <Table>
                    <thead>
                      <tr className="border-b border-line">
                        <th className="th" scope="col">Player</th>
                        <th className="th" scope="col">Minimum donation</th>
                        {canEdit && <th className="th text-right" scope="col">Update</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id} className="border-b border-line/60">
                          <td className="td font-semibold">{p.inGameName}</td>
                          <td className="td"><Badge value={p.met ? 'Donated' : 'Not donated'} tone={p.met ? 'gold' : 'muted'} /></td>
                          {canEdit && (
                            <td className="td text-right">
                              <button
                                type="button"
                                className={p.met ? 'btn-outline px-3 py-1' : 'btn-gold px-3 py-1'}
                                disabled={busyId === p.id}
                                onClick={() => setStatus(p, !p.met)}
                              >
                                {p.met ? 'Mark not donated' : 'Mark donated'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
