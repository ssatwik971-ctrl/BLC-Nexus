import { EmptyState, ErrorNote, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDateTime } from '../../lib/format.js';

export default function AdminLogs() {
  useTitle('Action log');
  const { data, error, loading, reload } = useFetch('/admin/logs');
  return (
    <>
      <PageHeader title="Action log" subtitle="The 200 most recent admin and officer actions." />
      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}
      {data && data.logs.length === 0 && <EmptyState>Nothing logged yet.</EmptyState>}
      {data && data.logs.length > 0 && (
        <div className="card p-0">
          <Table>
            <thead>
              <tr className="border-b border-line">
                <th className="th" scope="col">When</th>
                <th className="th" scope="col">Action</th>
                <th className="th" scope="col">Details</th>
                <th className="th" scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id} className="border-b border-line/60 align-top">
                  <td className="td whitespace-nowrap text-muted">{fmtDateTime(l.createdAt)}</td>
                  <td className="td font-semibold">{l.action}</td>
                  <td className="td break-all font-mono text-xs text-muted">{l.detail ? JSON.stringify(l.detail) : '—'}</td>
                  <td className="td text-muted">{l.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}
