import { useEffect, useState } from 'react';
import { Badge, EmptyState, ErrorNote, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate } from '../../lib/format.js';

export default function Roster() {
  useTitle('Roster');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useFetch(`/users${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`);
  const members = (data?.members || []).filter((m) => !role || m.role === role);

  return (
    <>
      <PageHeader title="Member roster" subtitle="Everyone in BLC. Members control which profile fields are visible." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="sr-only" htmlFor="r-search">Search members</label>
          <input id="r-search" className="input" placeholder="Search by in-game name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="sr-only" htmlFor="r-role">Filter by role</label>
          <select id="r-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="ADMIN">Admins</option>
            <option value="OFFICER">Officers</option>
            <option value="MEMBER">Members</option>
          </select>
        </div>
      </div>
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && members.length === 0 && <EmptyState>No members match your search.</EmptyState>}
      {data && members.length > 0 && (
        <div className="card p-0">
          <Table>
            <thead>
              <tr className="border-b border-line">
                <th className="th" scope="col">Member</th>
                <th className="th" scope="col">Role</th>
                <th className="th" scope="col">Offices this week</th>
                <th className="th" scope="col">Timezone</th>
                <th className="th" scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-line/60">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-xs font-bold text-gold" aria-hidden="true">
                          {m.inGameName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="font-semibold">{m.inGameName}</span>
                    </div>
                  </td>
                  <td className="td"><Badge value={m.role} tone={m.role === 'MEMBER' ? 'muted' : 'gold'} /></td>
                  <td className="td text-muted">{m.offices.length ? m.offices.join(', ') : '—'}</td>
                  <td className="td text-muted">{m.timezone || '—'}</td>
                  <td className="td text-muted">{fmtDate(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}
