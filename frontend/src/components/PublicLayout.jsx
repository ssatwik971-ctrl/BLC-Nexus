import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/hooks.js';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/apply', label: 'Apply' },
  { to: '/contact', label: 'Contact' },
];

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      className="btn-ghost px-2 py-1"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-gold' : 'text-muted hover:text-main'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-canvas">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
          <Link to="/" aria-label="BLC Nexus home">
            <Logo size="sm" />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="btn-gold ml-2">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="btn-outline ml-2">
                Member Login
              </Link>
            )}
          </div>
          <button
            type="button"
            className="btn-ghost md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </nav>
        {open && (
          <div id="mobile-menu" className="border-t border-line px-4 pb-4 md:hidden" key={location.pathname}>
            <div className="flex flex-col gap-1 pt-2">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                  {l.label}
                </NavLink>
              ))}
              <Link to={user ? '/app' : '/login'} className="btn-gold mt-2" onClick={() => setOpen(false)}>
                {user ? 'Dashboard' : 'Member Login'}
              </Link>
              <div className="mt-1">
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-2">
        <div>
          <p className="font-display font-bold gold-text">BLC Nexus — The Command Center of the Billionaires Club</p>
          <p className="mt-2 max-w-md text-xs text-muted">
            BLC Nexus is an unofficial fan companion site for Ticarium: Business Tycoon. It is not affiliated with or endorsed
            by the game's developers. All costs, donations and rewards are in-game resources tracked manually — no real money
            is handled here, and "Billionaires Club" is a game cooperative name, not a financial service.
          </p>
        </div>
        <ul className="flex flex-wrap content-start gap-x-5 gap-y-2 sm:justify-end">
          <li><Link className="text-muted hover:text-gold" to="/">Home</Link></li>
          <li><Link className="text-muted hover:text-gold" to="/about">About &amp; Rules</Link></li>
          <li><Link className="text-muted hover:text-gold" to="/leaderboard">Leaderboard</Link></li>
          <li><Link className="text-muted hover:text-gold" to="/apply">Apply</Link></li>
          <li><Link className="text-muted hover:text-gold" to="/contact">Contact</Link></li>
        </ul>
      </div>
    </footer>
  );
}
