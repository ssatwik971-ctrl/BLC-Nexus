import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui.jsx';
import { useFetch, useTitle } from '../../lib/hooks.js';

const offices = [
  ['HQ', 'The cooperative headquarters. Its level gates and boosts the other offices.'],
  ['Sidejob', 'Side jobs for cooperative members — extra income and activity.'],
  ['Quality', 'Quality boosts that improve what members produce.'],
  ['Energy', 'Energy supply that keeps jobs and production running.'],
  ['Media', 'Media reach that supports sales and growth.'],
  ['R&D', 'Research and development teams for long-term advantages.'],
];

export default function About() {
  useTitle('About');
  const { data } = useFetch('/public/site');
  const about = data?.settings?.about;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <PageHeader title="About BLC" subtitle="BILLIONAIRES CLUB — a Ticarium: Business Tycoon cooperative" />

      <Card>
        <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft text-gold">Our mission</h2>
        <p className="mt-2 text-muted">{about?.mission || 'Coordinate, compete and climb — together.'}</p>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft text-gold">Club rules</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
          {(about?.rules || []).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft text-gold">Benefits of joining</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          {(about?.benefits || []).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="off-h">
        <h2 id="off-h" className="mb-3 font-display text-lg font-bold text-gold">Cooperative offices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {offices.map(([name, desc]) => (
            <Card key={name}>
              <h3 className="font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft text-gold">Maintenance costs &amp; donations</h2>
        <p className="mt-2 text-muted">
          Every office has a weekly maintenance cost in in-game money and/or coins. The admin records the total maintenance paid each
          week and it is deducted from the coop's total balance. Cash and coin donations to the cooperative are recorded by BLC officers and shown
          in separate cash and coin sections. Everything is tracked manually in BLC Nexus; nothing here involves real money.
        </p>
      </Card>

      <Card className="border-gold/50">
        <h2 className="font-display text-lg font-bold tracking-wide text-gold-soft">Unofficial fan site</h2>
        <p className="mt-2 text-sm text-muted">
          BLC Nexus is an <strong>unofficial fan companion site</strong> for Ticarium: Business Tycoon. It is not affiliated with
          or endorsed by the game's developers or publisher. "Billionaires Club" is the name of an in-game cooperative and does not
          imply real-world wealth or financial services.
        </p>
      </Card>

      <div className="text-center">
        <Link to="/apply" className="btn-gold px-6 py-3">Apply to join BLC</Link>
      </div>
    </div>
  );
}
