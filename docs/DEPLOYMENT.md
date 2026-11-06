> **Note:** this guide describes the older Vercel + Railway setup. The current target is Netlify only; follow `docs/NETLIFY-MIGRATION.md` and `docs/NETLIFY-FINAL-RELEASE-CHECKLIST.md` instead.

# Deploying BLC Nexus (Vercel + Railway)

Frontend → **Vercel**, API + PostgreSQL → **Railway**. Render, Fly.io or a plain VPS work the same way: you need Node 20+, a PostgreSQL database, a persistent folder for uploads, and two environment files.

## 1. Database + API on Railway

1. Create a Railway project → **New → Database → PostgreSQL**.
2. **New → GitHub Repo →** pick `blc-nexus`. In the service settings:
   - **Root Directory:** `backend`
   - **Build command:** `npm install` (this also runs `prisma generate`)
   - **Start command:** `npm run start:prod` (syncs the schema with `prisma db push`, then starts the API)
3. Add a **Volume** to the API service mounted at `/data` so uploaded documents survive redeploys.
4. Set these variables on the API service:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Reference the Postgres service's `DATABASE_URL` |
| `JWT_SECRET` | Output of `openssl rand -hex 48` |
| `FRONTEND_URL` | Your Vercel URL, e.g. `https://blcnexus.com` |
| `CORS_ORIGINS` | Same as `FRONTEND_URL` (add preview URLs comma-separated if needed) |
| `UPLOAD_DIR` | `/data/uploads` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | e.g. SendGrid: `smtp.sendgrid.net`, `587`, `apikey`, your API key |
| `MAIL_FROM` | `BLC Nexus <no-reply@your-domain>` (must be a verified sender) |
| `CONTACT_EMAIL` | Inbox for the Contact form |
| `DISCORD_WEBHOOK_URL` | Optional |

5. Deploy, then **seed once** (Railway shell, or locally with the production `DATABASE_URL`):
   ```bash
   cd backend && npm run db:seed
   ```
6. Generate a public domain for the service. Check `https://<api-domain>/api/health` → `{"ok":true,...}`.

HTTPS is enforced automatically in production (HTTP requests are redirected; Railway terminates TLS and sets `X-Forwarded-Proto`).

## 2. Frontend on Vercel

1. **Add New → Project →** import `blc-nexus`.
2. **Root Directory:** `frontend`. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Environment variable: `VITE_API_URL` = your API origin, e.g. `https://blc-nexus-api.up.railway.app` (no trailing slash, no `/api`).
4. Deploy. `frontend/vercel.json` already rewrites all paths to `index.html` so deep links like `/app/forums` work.
5. Add your custom domain (e.g. `blcnexus.com`) in Vercel, then update `FRONTEND_URL` / `CORS_ORIGINS` on Railway to match and redeploy the API.

## 3. First login

Set `ADMIN_EMAIL` and `ADMIN_PIN` in the environment, redeploy, then open `/admin-login` and unlock the admin account with that email and PIN (see the README). Then:

1. Admin → **Site & Leaderboard**: set headline, stats, rules, recruitment on/off.
2. Update the six offices (Maintenance page) with your real levels and weekly costs.
3. Invite your members (Admin → Members → Invite member) and make your officers officers; only the admin can do this.

## 4. Migrations

The repo ships the Prisma schema (`backend/prisma/schema.prisma`) and uses `prisma db push` so a fresh deploy just works. Once you have real data, switch to versioned migrations:

```bash
cd backend
npx prisma migrate dev --name init      # creates backend/prisma/migrations (commit it)
# then change the start command to:  npx prisma migrate deploy && node src/server.js
```

## 5. Backups

`scripts/backup.sh` dumps PostgreSQL (`pg_dump`, custom format) and archives the uploads folder, keeping the 14 newest of each.

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db" UPLOAD_DIR=/data/uploads ./scripts/backup.sh ./backups
# cron (daily 03:00):  0 3 * * * cd /srv/blc-nexus && DATABASE_URL=... ./scripts/backup.sh
# restore:             pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/blc-nexus-db-<stamp>.dump
```

Railway also offers managed Postgres backups on paid plans — use both.

## 6. Other hosts

- **Render:** Web Service (root `backend`, start `npm run start:prod`) + Render PostgreSQL + a Persistent Disk for `UPLOAD_DIR`; Static Site for `frontend` (build `npm run build`, publish `dist`, rewrite `/*` → `/index.html`).
- **VPS:** `npm ci && npm run build` in `frontend` and serve `dist` with nginx (SPA fallback to `index.html`); run the API with `pm2` or systemd behind nginx with a Let's Encrypt certificate.
