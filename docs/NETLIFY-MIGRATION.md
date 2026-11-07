# BLC Nexus — Netlify migration (Phase 1 foundation)

This phase prepares a single-site Netlify deployment while preserving the current
Express routers, Prisma schema, JWT authentication and existing feature behavior.
It does not yet migrate Identity, Blobs, email delivery, or the local-disk vault.

## Architecture

- React + Vite is built from `frontend/` and published from `frontend/dist`.
- `/api/*` is rewritten to the `netlify/functions/api` serverless adapter.
- The adapter wraps the existing Express app with `serverless-http`.
- Prisma continues to use the existing PostgreSQL schema and reads the Netlify
  Database connection from `NETLIFY_DB_URL` at runtime.
- Netlify Database migrations live under `netlify/database/migrations/`.

## Setup

Requirements: Node.js 20.12.2+ and Netlify CLI 26+.

1. Connect the GitHub repository to Netlify; set the repository root as the base.
2. Install dependencies from the repository root: `npm install`.
3. Authenticate and link the site: `npx netlify login`, then `npx netlify link`.
4. Initialize the managed database: `npm run db:init`.
5. Generate the SQL baseline from the Prisma schema: `npm run db:generate-sql`.
6. Review the SQL file in `netlify/database/migrations/` before committing it.
7. Run `npm run db:migrations:apply` locally through Netlify CLI to verify it.
8. Deploy a Deploy Preview and verify `/.netlify/functions/api/health` and `/api/health`.

Netlify Database provides `NETLIFY_DB_URL` in supported Netlify runtimes. The
Function uses that variable explicitly because it runs in Lambda compatibility
mode. Never print or commit the connection string.

## Important unfinished work

- Netlify Identity is not integrated yet. Existing JWT auth is intentionally retained.
- The vault still uses Multer disk storage; do not use uploads in production until
  Phase 3 migrates storage to Netlify Blobs.
- Existing SMTP mail delivery remains configured as before.
- Existing rate limiting uses in-memory state and is not globally coordinated
  across Function instances.
- Data migration from the old PostgreSQL instance is not part of this foundation.

## Release safety

- Keep the original Railway service and database unchanged during migration.
- Do not deploy the generated baseline until reviewed and tested on a preview DB.
- Do not use `prisma db push` against Netlify Database; use committed SQL migrations.
- Never commit `.env`, database URLs, SMTP credentials, or JWT secrets.
- There are no sample admin credentials. Set `ADMIN_EMAIL` and a strong `ADMIN_PIN` (8+ characters) in the Netlify environment variables (scope them to Functions) before using the site.

### Required Netlify environment variables

Set these two in Site configuration → Environment variables (scope: Functions), then redeploy:

| Variable | Value |
| --- | --- |
| `ADMIN_EMAIL` | Email used to unlock the admin account at `/admin-login` |
| `ADMIN_PIN` | Admin PIN or passphrase (at least 6 characters, 8+ recommended) |

`NETLIFY_DB_URL` is provided automatically by Netlify Database.


## Phase 2: Netlify Identity
See [NETLIFY-IDENTITY-PHASE2.md](./NETLIFY-IDENTITY-PHASE2.md). Identity configuration is dashboard-only. Enable it on a Deploy Preview, choose Invite only, and test all roles before production cutover.
