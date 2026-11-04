import ResourceManager from '../../components/ResourceManager.jsx';
import { PageHeader } from '../../components/ui.jsx';
import { useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtNumber, toDateInput } from '../../lib/format.js';

export default function AdminResources() {
  useTitle('Content');
  return (
    <>
      <PageHeader title="Content management" subtitle="Forum categories and performance snapshots. Offices, donations, votes and documents are managed on their own pages." />
      <div className="space-y-8">
        <ResourceManager
          title="Forum categories"
          endpoint="/forum/categories"
          listKey="categories"
          canDelete
          defaults={{ order: 0 }}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'description', label: 'Description' },
            { key: 'order', label: 'Order' },
            { key: 'threads', label: 'Threads', render: (c) => c._count?.threads ?? 0 },
          ]}
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'order', label: 'Display order', type: 'number' },
          ]}
          toForm={(c) => ({ name: c.name, description: c.description || '', order: c.order })}
        />

        <ResourceManager
          title="Performance snapshots"
          endpoint="/audit/snapshots"
          listKey="snapshots"
          canDelete
          defaults={{ date: new Date().toISOString().slice(0, 10) }}
          columns={[
            { key: 'date', label: 'Date', render: (s) => fmtDate(s.date) },
            { key: 'power', label: 'Power', render: (s) => fmtNumber(s.power) },
            { key: 'rank', label: 'Rank', render: (s) => (s.rank ? `#${s.rank}` : '—') },
            { key: 'memberCount', label: 'Members', render: (s) => fmtNumber(s.memberCount) },
            { key: 'notes', label: 'Notes' },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'power', label: 'Power', type: 'number', required: true },
            { name: 'rank', label: 'Leaderboard rank', type: 'number' },
            { name: 'memberCount', label: 'Member count', type: 'number' },
            { name: 'notes', label: 'Notes', type: 'text' },
          ]}
          toForm={(s) => ({ date: toDateInput(s.date), power: s.power, rank: s.rank ?? '', memberCount: s.memberCount ?? '', notes: s.notes || '' })}
          toPayload={(f) => ({
            date: f.date,
            power: Number(f.power),
            rank: f.rank === '' || f.rank == null ? null : Number(f.rank),
            memberCount: f.memberCount === '' || f.memberCount == null ? null : Number(f.memberCount),
            notes: f.notes || null,
          })}
        />
      </div>
    </>
  );
}
