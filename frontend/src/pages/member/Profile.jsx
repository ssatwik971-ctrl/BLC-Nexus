import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Card, EmptyState, ErrorNote, Field, PageHeader, SkeletonBlock, Table } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';
import { fmtDate, fmtNumber } from '../../lib/format.js';

const HIDEABLE = [
  ['playerId', 'Player ID'],
  ['timezone', 'Timezone'],
  ['contact', 'Contact'],
  ['avatarUrl', 'Avatar'],
];

export default function Profile() {
  useTitle('Profile');
  const { user, refresh } = useAuth();
  const { data, error, loading, reload } = useFetch('/users/me');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.user) {
      const u = data.user;
      setForm({
        inGameName: u.inGameName,
        avatarUrl: u.avatarUrl || '',
        timezone: u.timezone || 'UTC',
        contact: u.contact || '',
        hiddenFields: u.hiddenFields || [],
        notifyEmail: u.notifyEmail,
      });
    }
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me', { ...form, contact: form.contact || null });
      toast.success('Profile saved');
      await refresh();
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };



  const toggleHidden = (field) =>
    setForm((f) => ({ ...f, hiddenFields: f.hiddenFields.includes(field) ? f.hiddenFields.filter((x) => x !== field) : [...f.hiddenFields, field] }));

  const c = data?.contributions;

  return (
    <>
      <PageHeader title="My profile" subtitle="Update your details, privacy and notification settings." />

      {loading && <SkeletonBlock rows={6} />}
      {error && <ErrorNote error={error} retry={reload} />}

      {form && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-display text-lg font-bold">Details</h2>
            <form onSubmit={save} className="space-y-4">
              <Field label="In-game name" htmlFor="p-name"><input id="p-name" className="input" required minLength={2} maxLength={40} value={form.inGameName} onChange={(e) => setForm({ ...form, inGameName: e.target.value })} /></Field>
              <Field label="Avatar URL (https)" htmlFor="p-av"><input id="p-av" type="url" className="input" placeholder="https://…" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} /></Field>
              <Field label="Timezone" htmlFor="p-tz" hint="IANA name, e.g. Asia/Kolkata or America/New_York."><input id="p-tz" className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
              <Field label="Contact (optional)" htmlFor="p-contact" hint="e.g. your Discord handle."><input id="p-contact" className="input" maxLength={120} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>

              <fieldset>
                <legend className="label">Hide from the roster</legend>
                <div className="flex flex-wrap gap-4">
                  {HIDEABLE.map(([f, label]) => (
                    <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-gold))]" checked={form.hiddenFields.includes(f)} onChange={() => toggleHidden(f)} />{label}</label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-gold))]" checked={form.notifyEmail} onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })} />Email me maintenance reminders</label>
              <button type="submit" className="btn-gold" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-lg font-bold">Account security</h2>
            <p className="text-sm text-muted">
              {user?.role === 'ADMIN'
                ? 'The admin account signs in with the email and PIN set in the site environment variables. To change the PIN, change ADMIN_PIN in Netlify and redeploy; every old admin session is signed out.'
                : 'Passwords are managed by Netlify Identity. To change yours, sign out and use “Forgot password?” on the login page.'}
            </p>
          </Card>
        </div>
      )}

      {c && (
        <section className="mt-8" aria-labelledby="contrib">
          <h2 id="contrib" className="mb-3 font-display text-lg font-bold">My contributions</h2>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card><div className="label">Cash donated</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(c.totalCash)}</div></Card>
            <Card><div className="label">Coins donated</div><div className="font-display text-2xl font-extrabold gold-text">{fmtNumber(c.totalCoins)}</div></Card>
            <Card><div className="label">Maintenance paid</div><div className="font-display text-2xl font-extrabold gold-text">{c.maintenancePaid}</div></Card>
            <Card><div className="label">Forum posts</div><div className="font-display text-2xl font-extrabold gold-text">{c.forumPosts}</div></Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-2 font-semibold">Recent donations</h3>
              {c.donations.length === 0 ? <EmptyState>No donations recorded yet.</EmptyState> : (
                <Table><tbody>{c.donations.slice(0, 8).map((d) => (
                  <tr key={d.id} className="border-b border-line/60"><td className="td">{d.type === 'CASH' ? 'Cash' : 'Coins'}</td><td className="td">{fmtNumber(d.amount)}</td><td className="td text-muted">{fmtDate(d.donatedAt)}</td></tr>
                ))}</tbody></Table>
              )}
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Recent maintenance</h3>
              {c.maintenance.length === 0 ? <EmptyState>No maintenance assignments yet.</EmptyState> : (
                <Table><tbody>{c.maintenance.slice(0, 8).map((a) => (
                  <tr key={a.id} className="border-b border-line/60"><td className="td">{a.office.name}</td><td className="td text-muted">{fmtDate(a.weekStart)}</td><td className="td"><Badge value={a.status} /></td></tr>
                ))}</tbody></Table>
              )}
            </Card>
          </div>
        </section>
      )}
    </>
  );
}
