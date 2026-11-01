import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Field, PageHeader } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useTitle } from '../../lib/hooks.js';

export default function Contact() {
  useTitle('Contact');
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/public/contact', form);
      toast.success('Message sent. We will get back to you soon.');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader title="Contact BLC" subtitle="Questions about the club or the site? Send us a note." />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" htmlFor="c-name"><input id="c-name" className="input" required maxLength={80} value={form.name} onChange={set('name')} /></Field>
          <Field label="Email" htmlFor="c-email"><input id="c-email" type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Message" htmlFor="c-msg"><textarea id="c-msg" className="input min-h-[140px]" required minLength={10} maxLength={4000} value={form.message} onChange={set('message')} /></Field>
          <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
        </form>
      </Card>
    </div>
  );
}
