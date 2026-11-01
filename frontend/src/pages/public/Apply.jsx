import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, ErrorNote, Field, PageHeader } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useFetch, useTitle } from '../../lib/hooks.js';

const empty = { inGameName: '', playerId: '', email: '', level: '', power: '', weeklyActivity: '', reason: '', references: '' };

export default function Apply() {
  useTitle('Apply');
  const site = useFetch('/public/site');
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, level: form.level ? Number(form.level) : undefined };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      setDone(await api.post('/applications', body));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const link = `${window.location.origin}/apply/status/${done.token}`;
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card className="border-gold/50">
          <h1 className="font-display text-2xl font-extrabold gold-text">Application received</h1>
          <p className="mt-3 text-sm text-muted">
            Keep this private link — it is the only way to check your application status. We also emailed it to you.
          </p>
          <p className="mt-4 break-all rounded-lg border border-line bg-canvas p-3 text-sm">{link}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link copied'))}
            >
              Copy link
            </button>
            <Link to={`/apply/status/${done.token}`} className="btn-gold">Check status</Link>
          </div>
        </Card>
      </div>
    );
  }

  if (site.data?.settings?.recruiting === false) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <h1 className="font-display text-2xl font-extrabold">Recruitment is closed</h1>
          <p className="mt-2 text-sm text-muted">BLC is not accepting applications right now. Check back soon or use the contact page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="Apply to BLC" subtitle="Tell us about your company. Officers review every application." />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorNote error={{ message: errorMessage(error) }} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="In-game name" htmlFor="a-name"><input id="a-name" className="input" required minLength={2} maxLength={40} value={form.inGameName} onChange={set('inGameName')} /></Field>
            <Field label="Player ID" htmlFor="a-pid"><input id="a-pid" className="input" required maxLength={60} value={form.playerId} onChange={set('playerId')} /></Field>
          </div>
          <Field label="Email" htmlFor="a-email" hint="Used for your confirmation and invite. Never shown publicly.">
            <input id="a-email" type="email" className="input" required value={form.email} onChange={set('email')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Company level" htmlFor="a-level"><input id="a-level" type="number" min="1" className="input" value={form.level} onChange={set('level')} /></Field>
            <Field label="Power" htmlFor="a-power"><input id="a-power" className="input" maxLength={40} value={form.power} onChange={set('power')} /></Field>
            <Field label="Weekly activity" htmlFor="a-act"><input id="a-act" className="input" placeholder="e.g. daily" maxLength={200} value={form.weeklyActivity} onChange={set('weeklyActivity')} /></Field>
          </div>
          <Field label="Why do you want to join?" htmlFor="a-reason" hint="At least 20 characters.">
            <textarea id="a-reason" className="input min-h-[120px]" required minLength={20} maxLength={2000} value={form.reason} onChange={set('reason')} />
          </Field>
          <Field label="References (optional)" htmlFor="a-ref"><input id="a-ref" className="input" maxLength={500} placeholder="A BLC member who knows you" value={form.references} onChange={set('references')} /></Field>
          <button type="submit" className="btn-gold w-full py-3" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
        </form>
      </Card>
    </div>
  );
}
