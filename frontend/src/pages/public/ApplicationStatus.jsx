import { Link, useParams } from 'react-router-dom';
import { Badge, Card, ErrorNote, SkeletonBlock } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate } from '../../lib/format.js';

const messages = {
  PENDING: 'Your application is in the queue. An officer will review it soon.',
  APPROVED: 'Approved! Check your email for the activation link to set your password.',
  WAITLISTED: 'You are on the waitlist. We will reach out when a spot opens.',
  REJECTED: 'Your application was not accepted this time. You can contact us with questions.',
};

export default function ApplicationStatus() {
  useTitle('Application status');
  const { token } = useParams();
  const { data, error, loading } = useFetch(`/applications/status/${encodeURIComponent(token)}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <h1 className="font-display text-2xl font-extrabold">Application status</h1>
        {loading && <div className="mt-4"><SkeletonBlock rows={3} /></div>}
        {error && <div className="mt-4"><ErrorNote error={{ message: error.status === 404 ? 'We could not find an application for this link.' : error.message }} /></div>}
        {data && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">Applicant: <strong className="text-main">{data.inGameName}</strong></p>
            <p><Badge value={data.status} /></p>
            <p className="text-sm">{messages[data.status]}</p>
            {data.note && <p className="rounded-lg border border-line bg-canvas p-3 text-sm">{data.note}</p>}
            <p className="text-xs text-muted">Submitted {fmtDate(data.submittedAt)}{data.reviewedAt ? ` · Reviewed ${fmtDate(data.reviewedAt)}` : ''}</p>
            {data.status === 'APPROVED' && <Link to="/login" className="btn-gold">Go to login</Link>}
          </div>
        )}
      </Card>
    </div>
  );
}
