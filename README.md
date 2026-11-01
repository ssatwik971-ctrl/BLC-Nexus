# BLC Nexus

**The Command Center of the Billionaires Club**

BLC Nexus is the companion website for **BILLIONAIRES CLUB (BLC)**, a cooperative in the mobile business simulation game **Ticarium: Business Tycoon**. It gives members one place to coordinate cooperative office maintenance, donations, events, strategy and votes — and gives the public a place to learn about BLC and apply.

> **BLC Nexus is an unofficial fan companion site** for Ticarium: Business Tycoon. It is not affiliated with or endorsed by the game's developers. All costs, donations and rewards are in-game resources tracked manually. There are no real-money features, and "Billionaires Club" is a game cooperative name, not a financial service.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Router, Recharts, react-hot-toast |
| Backend | Node.js (ESM) + Express 4, zod validation, helmet, express-rate-limit, multer, nodemailer, winston |
| Database | PostgreSQL via Prisma |
| Auth | JWT (bearer) + bcrypt (bcryptjs) password hashing, role-based access control |
| Tests | Vitest (API integration tests run against an in-memory fake database) |
| Hosting | Vercel (frontend) + Railway (API + Postgres) — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

## Repository layout

```
blc-nexus/
├── backend/            Express API
│   ├── prisma/         schema.prisma + seed.js
│   ├── src/            app, config, middleware/, routes/, utils/
│   └── tests/          auth, RBAC and application-flow tests (+ fake Prisma)
├── frontend/           React app (public site, member area, admin panel)
├── docs/               API.md, DEPLOYMENT.md
├── scripts/backup.sh   Database + uploads backup
├── docker-compose.yml  Local PostgreSQL
└── .env.example
```

## Quick start (local)

Requirements: Node 20+, Docker (or any PostgreSQL 14+).

```bash
# 1. Database
docker compose up -d

# 2. API
cd backend
cp .env.example .env            # set JWT_SECRET to any long random string
npm install                     # also runs `prisma generate`
npm run db:push                 # create tables from prisma/schema.prisma
npm run db:seed                 # admin user, offices, forum categories, rewards, wiki, sample data
npm run dev                     # http://localhost:4000

# 3. Web app (new terminal)
cd frontend
cp .env.example .env            # leave VITE_API_URL empty locally; Vite proxies /api
npm install
npm run dev                     # http://localhost:5173
```

Emails are printed to the API console when `SMTP_HOST` is empty, so invites and password-reset links are visible in the log during development.

### Default admin credentials (first login)

| | |
|---|---|
| Email | `admin@blcnexus.local` |
| Password | `ChangeMe!2026` |

Override with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` before seeding. The seeded admin is **forced to change the password** on first login. Never deploy with the default password.

### Tests

```bash
cd backend && npm test
```

Covers authentication (login, suspended accounts, token tampering, reset anti-enumeration), role-based access (public / member / officer / admin, immediate role-change effect, last-admin protection, HTML stripping) and the full application flow (submit → token status → admin approval → invite email → activation → login, plus duplicates, rejection and single-use invites).

## Features

**Public:** home with live cooperative stats and top members, About (mission, rules, offices, maintenance/donation explainer, disclaimer), recruitment form with private status link, public leaderboard (activity + donations), contact form.

**Members:** dashboard, roster with privacy controls, office & weekly maintenance tracker (assignments, paid/unpaid/late, reminders, history), donation pledges toward cooperative rewards with top-donor board, event calendar with RSVP, strategy forums (threads, replies, upvotes, pin/lock) and wiki, one-vote-per-member governance, role-gated document vault, performance charts, profile with notification preferences and contribution history.

**Admin panel:** application review (approve → account + invite email), member management (roles, suspend, remove, resend invite / reset password), editable home/about/stats/rules, manual leaderboard entry, forum categories, performance snapshots, votes, documents, and an action log. Officers can manage offices, maintenance, rewards, events and wiki; admins do everything.

### User roles

| Role | How they get it | Can do |
|---|---|---|
| Public visitor | — | Home, About, Leaderboard, Apply, Contact |
| Applicant | Submits the form | Check status via private token link only |
| Member | Application approved (or admin invite) | Everything in the member area; mark own maintenance paid; pledge; vote; post |
| Officer | Set by an admin | + events, offices, maintenance assignments & reminders, rewards, wiki, forum moderation, verify pledges |
| Leader / Admin | Seeded / set by an admin | + members, applications, votes, documents, settings, leaderboard, categories, snapshots, logs |

## Security notes

- Passwords hashed with bcrypt (12 rounds); login responses are identical for unknown email vs wrong password.
- Roles are re-read from the database on **every** request, so demotions and suspensions apply immediately.
- RBAC middleware on every route; the admin API is mounted behind an admin gate.
- All input validated with zod; text is stripped of HTML/control characters and always rendered escaped (no `dangerouslySetInnerHTML`); Prisma uses parameterised queries.
- Invite/reset/application tokens are random and only their SHA-256 hash is stored.
- Rate limits on login, password flows, applications, contact and forum posts.
- Uploads: extension + MIME allowlist, size cap, random server-side filenames, role-checked downloads, `nosniff`.
- HTTPS redirect, helmet headers, strict CORS allowlist, graceful JSON error handling with winston logging.

## Assumptions and known limitations

Honest notes on what this version does **not** do, so nothing surprises you:

- **Not run end-to-end where it was written.** The code was authored in a sandbox with no access to the npm registry, so `npm install`, the test suite, the Vite build and a real Postgres run were **not executed**. The backend passes a Node syntax check and the frontend parses and resolves all imports (esbuild), but expect to fix small issues on first run. Run `npm test` first.
- **No Ticarium API integration.** There is no known public API, so power, rank and leaderboards are entered manually by admins (as the spec allows).
- **No committed SQL migrations.** `prisma db push` creates the schema; run `npx prisma migrate dev --name init` once to generate versioned migrations (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).
- **MFA is not implemented** (marked optional). Admin accounts should use strong unique passwords.
- **JWT is kept in `localStorage`** to keep a cross-domain Vercel + Railway deploy simple. This is acceptable because the app never injects raw HTML, but httpOnly cookies are a reasonable hardening step if you host both on one domain.
- Tests use an in-memory fake Prisma (no database needed) and cover the critical auth/RBAC/application flows; forums, votes, maintenance and uploads are not yet covered by tests.
- Uploaded file types are checked by extension and declared MIME type, not by content sniffing or antivirus.
- Offices are the six named in the brief (HQ, Sidejob, Quality, Energy, Media, R&D); costs and levels are placeholders until an admin edits them.
- Maintenance weeks start on Monday (UTC).

## Documentation

- [API reference](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md)
