import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, ErrorNote, Field, PageHeader, SkeletonBlock } from '../../components/ui.jsx';
import { api, errorMessage } from '../../lib/api.js';
import { useFetch, useTitle } from '../../lib/hooks.js';

const toLines = (entries) => (entries || []).map((e) => `${e.name}, ${e.score}`).join('\n');
function parseLines(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.lastIndexOf(',');
      if (i < 1) throw new Error(`Line "${l}" must look like: Name, score`);
      const score = Number(l.slice(i + 1).trim());
      if (Number.isNaN(score)) throw new Error(`Score in "${l}" is not a number`);
      return { name: l.slice(0, i).trim(), score };
    });
}

export default function AdminSite() {
  useTitle('Site & leaderboard');
  const site = useFetch('/public/site');
  const board = useFetch('/public/leaderboard');
  const [s, setS] = useState(null);
  const [activity, setActivity] = useState('');
  const [donation, setDonation] = useState('');

  useEffect(() => {
    if (site.data) {
      const { home, about, stats, recruiting } = site.data.settings;
      setS({
        headline: home?.headline || '',
        intro: home?.intro || '',
        mission: about?.mission || '',
        rules: (about?.rules || []).join('\n'),
        benefits: (about?.benefits || []).join('\n'),
        power: stats?.power ?? 0,
        rank: stats?.rank ?? '',
        officeLevels: stats?.officeLevels || '',
        note: stats?.note || '',
        recruiting: recruiting !== false,
      });
    }
  }, [site.data]);

  useEffect(() => {
    if (board.data) {
      setActivity(toLines(board.data.activity));
      setDonation(toLines(board.data.donation));
    }
  }, [board.data]);

  const lines = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);

  const saveSite = async (e) => {
    e.preventDefault();
    try {
      await Promise.all([
        api.put('/admin/settings/home', { value: { headline: s.headline, intro: s.intro } }),
        api.put('/admin/settings/about', { value: { mission: s.mission, rules: lines(s.rules), benefits: lines(s.benefits) } }),
        api.put('/admin/settings/stats', { value: { power: Number(s.power) || 0, rank: s.rank === '' ? null : Number(s.rank), officeLevels: s.officeLevels, note: s.note } }),
        api.put('/admin/settings/recruiting', { value: s.recruiting }),
      ]);
      toast.success('Site content saved');
      site.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveBoard = async (kind, text) => {
    try {
      const entries = parseLines(text);
      await api.put(`/admin/leaderboard/${kind}`, { entries });
      toast.success(`${kind === 'activity' ? 'Activity' : 'Donation'} leaderboard saved`);
      board.reload();
    } catch (err) {
      toast.error(err.status ? errorMessage(err) : err.message);
    }
  };

  return (
    <>
      <PageHeader title="Site content & leaderboard" subtitle="Edit public pages, cooperative stats and the public leaderboard. No code needed." />
      {(site.loading || !s) && !site.error && <SkeletonBlock rows={8} />}
      {site.error && <ErrorNote error={site.error} retry={site.reload} />}

      {s && (
        <form onSubmit={saveSite} className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft">Home page</h2>
            <Field label="Headline" htmlFor="s-head"><input id="s-head" className="input" value={s.headline} onChange={(e) => setS({ ...s, headline: e.target.value })} /></Field>
            <Field label="Intro" htmlFor="s-intro"><textarea id="s-intro" className="input min-h-[90px]" value={s.intro} onChange={(e) => setS({ ...s, intro: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-gold))]" checked={s.recruiting} onChange={(e) => setS({ ...s, recruiting: e.target.checked })} />Recruitment is open (shows the Apply button and accepts applications)</label>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft">Cooperative stats (shown on Home and the dashboard)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Power" htmlFor="s-power"><input id="s-power" type="number" min="0" className="input" value={s.power} onChange={(e) => setS({ ...s, power: e.target.value })} /></Field>
              <Field label="Leaderboard rank" htmlFor="s-rank"><input id="s-rank" type="number" min="1" className="input" value={s.rank} onChange={(e) => setS({ ...s, rank: e.target.value })} /></Field>
              <Field label="Office levels" htmlFor="s-ol"><input id="s-ol" className="input" value={s.officeLevels} onChange={(e) => setS({ ...s, officeLevels: e.target.value })} /></Field>
            </div>
            <Field label="Note" htmlFor="s-note"><input id="s-note" className="input" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} /></Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft">About page</h2>
            <Field label="Mission" htmlFor="s-mis"><textarea id="s-mis" className="input min-h-[90px]" value={s.mission} onChange={(e) => setS({ ...s, mission: e.target.value })} /></Field>
            <Field label="Rules (one per line)" htmlFor="s-rules"><textarea id="s-rules" className="input min-h-[120px]" value={s.rules} onChange={(e) => setS({ ...s, rules: e.target.value })} /></Field>
            <Field label="Benefits (one per line)" htmlFor="s-ben"><textarea id="s-ben" className="input min-h-[100px]" value={s.benefits} onChange={(e) => setS({ ...s, benefits: e.target.value })} /></Field>
          </Card>
          <button type="submit" className="btn-gold">Save site content</button>
        </form>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {[['activity', 'Activity leaderboard', activity, setActivity], ['donation', 'Donation leaderboard', donation, setDonation]].map(([kind, title, value, setter]) => (
          <Card key={kind} className="space-y-3">
            <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft">{title}</h2>
            <Field label="One entry per line: Name, score" htmlFor={`lb-${kind}`} hint="Ranks are assigned automatically by score (highest first). Saving replaces the list.">
              <textarea id={`lb-${kind}`} className="input min-h-[180px] font-mono" value={value} onChange={(e) => setter(e.target.value)} />
            </Field>
            <button type="button" className="btn-gold" onClick={() => saveBoard(kind, value)}>Save {kind} leaderboard</button>
          </Card>
        ))}
      </div>
    </>
  );
}
