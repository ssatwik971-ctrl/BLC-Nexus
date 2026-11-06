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
| Auth | Netlify Identity sessions + database-backed BLC roles in the Netlify deployment; legacy JWT mode remains for the standalone backend |
| Tests | Vitest (API integration tests run against an in-memory fake database) |
| Hosting | Netlify Functions + Netlify Database + Netlify Blobs (migration target); standalone deployment guide remains available |

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
npm run db:seed                 # offices, forum categories, starter wiki and settings (no accounts)
npm run dev                     # http://localhost:4000

# 3. Web app (new terminal)
cd frontend
cp .env.example .env            # leave VITE_API_URL empty locally; Vite proxies /api
npm install
npm run dev                     # http://localhost:5173
```

Emails are printed to the API console when `SMTP_HOST` is empty, so invites and password-reset links are visible in the log during development.

### Admin sign-in (email + PIN)

There are **no demo or seeded accounts**. The single admin account is defined by two environment variables (in Netlify: Project configuration → Environment variables; locally: `backend/.env`):

| Variable | What it is |
|---|---|
| `ADMIN_EMAIL` | The admin's Gmail (or any email) address |
| `ADMIN_PIN` | The PIN / passphrase that unlocks the account (**at least 6 characters; 8+ letters and digits recommended**) |
| `ADMIN_NAME` | Optional display name (default `BLC Admin`) |
| `ADMIN_SESSION_HOURS` | Optional session length (default `12`) |

Open `/admin-login` (there is a link under the normal login form), enter that email and PIN, and the admin account unlocks. If either variable is missing, or the PIN is shorter than 6 characters, admin sign-in is switched off. Changing `ADMIN_PIN` (or `ADMIN_EMAIL`) and redeploying signs every existing admin session out. After 5 wrong attempts from one address (or 20 from all addresses) admin sign-in pauses for 15 minutes; failures show up in the Action Log.

The admin cannot be created, edited or removed through the app or Netlify Identity, and nobody else can be given the admin role.

### Tests

```bash
cd backend && npm test
```

Covers authentication (login, suspended accounts, token tampering, reset anti-enumeration), the admin email + PIN sign-in (wrong PIN, lockout, session expiry, PIN change, not configured), role-based access (public / member / officer / admin, admin-only promotion and approvals, officer permissions, HTML stripping), cash and coin donations, and the full application flow (submit → token status → admin approval → invite email → activation → login, plus duplicates, rejection and single-use invites).

## Features

**Public:** home with live cooperative stats and top members, About (mission, rules, offices, maintenance/donation explainer, disclaimer), recruitment form with private status link, public leaderboard (activity + donations), contact form.

**Members:** dashboard, roster with privacy controls, weekly maintenance totals (cash and coins, entered by the admin at the end of each week), separate cash and coin donation sections (coop's total balance after maintenance, total donated, your total, top donors, history), a weekly donation status page (who gave the minimum donation; officers and the admin update it, everyone sees it), strategy forums (threads, replies, upvotes, pin/lock) and wiki, one-vote-per-member governance, role-gated document vault, performance charts, profile with notification preferences and contribution history.

**Management:** application review and role changes (admin only), member management (suspend, remove), editable home/about/stats/rules, manual leaderboard entry, forum categories, performance snapshots, offices, maintenance, donations, votes, documents, wiki and an action log. **Only the admin** approves applications, invites members and makes a member an officer (the admin is the only person with the Netlify account that sends invitations). **Officers do all the rest.**

### User roles

| Role | How they get it | Can do |
|---|---|---|
| Public visitor | — | Home, About, Leaderboard, Apply, Contact |
| Applicant | Submits the form | Check status via private token link only |
| Member | Application approved by the admin (or admin invite) | Everything in the member area; mark own maintenance paid; vote; post |
| Officer | Made an officer **by the admin only** | + offices, record cash/coin donations, set the weekly minimum-donation status, wiki, forum moderation and categories, votes, document vault, site settings, leaderboard, performance snapshots, action log, suspend/remove regular members |
| Admin | `ADMIN_EMAIL` + `ADMIN_PIN` (Netlify environment variables) | + review/approve applications, invite members, make members officers, manage officers, admin-only documents |

## Security notes

- Passwords hashed with bcrypt (12 rounds); login responses are identical for unknown email vs wrong password.
- Roles are re-read from the database on **every** request, so demotions and suspensions apply immediately.
- RBAC middleware on every route; the management API needs an officer, and applications, invites and role changes need the admin.
- The admin signs in with `ADMIN_EMAIL` + `ADMIN_PIN` (constant-time comparison, lockout after repeated failures, random server-side session in an HttpOnly, SameSite=Strict cookie; only a hash of the session token is stored). A user row with the ADMIN role can never sign in through Identity or a password.
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
- **Netlify Identity is required for the Netlify deployment.** The browser does not persist bearer tokens; Identity manages its session cookies. The standalone legacy backend retains JWT authentication.
- Tests use an in-memory fake Prisma (no database needed) and cover the critical auth/RBAC/application flows; forums, votes, maintenance and uploads are not yet covered by tests.
- Uploaded file types are checked by extension and declared MIME type, not by content sniffing or antivirus.
- Offices are the six named in the brief (HQ, Sidejob, Quality, Energy, Media, R&D); costs and levels are placeholders until an admin edits them.
- Maintenance weeks start on Monday (UTC).

## Documentation

- [API reference](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md)


## Netlify migration status

Phase 1 foundation and Phase 2 Netlify Identity integration are available in the migration package. Read `docs/NETLIFY-MIGRATION.md` and `docs/NETLIFY-IDENTITY-PHASE2.md` before deploying. Identity must be enabled and set to Invite only in the Netlify dashboard; invitations are currently issued there manually. This package has not yet passed a dependency install, production build, live database migration, or Deploy Preview authentication test. Keep the existing deployment unchanged until those checks pass.


### Netlify migration — final source package

This repository includes the Phase 1 hosting/database foundation, Phase 2 Netlify Identity integration, and Phase 3 private document storage. Read `docs/NETLIFY-MIGRATION.md`, `docs/NETLIFY-IDENTITY-PHASE2.md`, and `docs/NETLIFY-PHASE3-STORAGE-OPERATIONS.md`. The first SQL baseline must be generated from the Prisma schema after dependencies install, then reviewed and applied to a disposable Netlify Database. Netlify Identity invitations are still issued from the Netlify dashboard because the supported Identity admin SDK does not expose a send-invitation operation. This source package has not passed a production build or live Deploy Preview checks; do not cut over from Railway until those checks pass.
