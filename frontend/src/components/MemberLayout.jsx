import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import { ThemeToggle } from './PublicLayout.jsx';
import { Badge } from './ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useFetch } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { fmtDateTime } from '../lib/format.js';

const memberNav = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/roster', label: 'Roster' },
  { to: '/app/maintenance', label: 'Maintenance' },
  { to: '/app/donations', label: 'Donations' },
  { to: '/app/forums', label: 'Forums' },
  { to: '/app/wiki', label: 'Wiki' },
  { to: '/app/votes', label: 'Votes' },
  { to: '/app/documents', label: 'Documents' },
  { to: '/app/performance', label: 'Performance' },
  { to: '/app/profile', label: 'Profile' },
];

const manageNav = [
  { to: '/app/admin/members', label: 'Members' },
  { to: '/app/admin/resources', label: 'Content' },
  { to: '/app/admin/site', label: 'Site & Leaderboard' },
  { to: '/app/admin/logs', label: 'Action Log' },
];

function Bell() {
  const [open, setOpen] = useState(false);
  const { data, reload } = useFetch('/notifications');
  const items = data?.notifications || [];
  const unread = items.filter((n) => !n.read).length;

  const markAll = async () => {
    await api.post('/notifications/read-all');
    reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-ghost relative px-2 py-1"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) reload();
        }}
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-gold px-1.5 text-[10px] font-bold text-canvas">{unread}</span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-80 max-w-[85vw] shadow-gold" role="region" aria-label="Notifications">
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-sm">Notifications</strong>
            {unread > 0 && (
              <button type="button" className="text-xs text-gold underline" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <p className="text-sm text-muted">You are all caught up.</p>}
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={`rounded-lg border p-2 text-sm ${n.read ? 'border-line text-muted' : 'border-gold/50'}`}>
                {n.link ? (
                  <Link to={n.link} onClick={() => setOpen(false)} className="hover:text-gold">
                    {n.message}
                  </Link>
                ) : (
                  n.message
                )}
                <div className="mt-1 text-xs text-muted">{fmtDateTime(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function MemberLayout() {
  const { user, logout, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  // Officers get the management pages; only the admin also reviews applications.
  const manageLinks = isAdmin ? [{ to: '/app/admin/applications', label: 'Applications' }, ...manageNav] : manageNav;
  const [sidebar, setSidebar] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close the mobile sidebar after navigating.
  useEffect(() => setSidebar(false), [location.pathname]);

  const item = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-gold/15 text-gold' : 'text-muted hover:bg-raised hover:text-main'}`;

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-canvas">
        Skip to content
      </a>

      {sidebar && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebar(false)} aria-hidden="true" />}

      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-line bg-surface p-4 transition-transform lg:static lg:translate-x-0 ${sidebar ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Member navigation"
      >
        <Link to="/" className="mb-6 flex justify-center" aria-label="BLC Nexus public site">
          <Logo size="md" />
        </Link>
        <nav className="space-y-1">
          {memberNav.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={item}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        {hasRole('OFFICER') && (
          <nav className="mt-6 space-y-1 border-t border-line pt-4" aria-label="Management">
            <p className="label px-3">{isAdmin ? 'Admin' : 'Management'}</p>
            {manageLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={item}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
        <button
          type="button"
          className="btn-ghost mt-6 w-full justify-start"
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          Logout
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="btn-ghost lg:hidden"
            aria-controls="sidebar"
            aria-expanded={sidebar}
            onClick={() => setSidebar(!sidebar)}
          >
            ☰ Menu
          </button>
          <div className="hidden text-sm text-muted lg:block">
            Signed in as <strong className="text-main">{user.inGameName}</strong> <Badge value={user.role} />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Bell />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
