# BLC Nexus — Netlify final release checklist

This is the consolidated source package for the Netlify migration. It is not a claim that the live Netlify site has been configured or verified.

## Included

- Netlify Functions adapter for the existing Express API.
- Netlify Identity session verification and mapping to approved BLC database members.
- Database-backed MEMBER / OFFICER / ADMIN authorization and suspension checks.
- Private Netlify Blobs document storage; files are served only through authenticated, role-checked API routes.
- Separate Blob store names for production and non-production deploy contexts.
- Login synchronization errors surfaced to the user instead of silently treating Identity sign-in as a completed BLC login.

## Required before first deploy

1. Use Node.js 20.12.2 or newer and run `npm install` from the repository root.
2. Run `npm run prisma:generate`.
3. Generate the initial SQL baseline with `npm run db:generate-sql`. Review the generated `netlify/database/migrations/202611010001_initial_schema.sql`; it is intentionally not fabricated in this package because Prisma CLI could not be installed in the build environment.
4. Confirm the baseline includes the `netlifyIdentityId` column and unique index. If not, adjust the baseline so it represents the complete current `schema.prisma` before applying migrations. Do not apply the separate identity-link migration twice if the baseline already includes that column; the provided migration uses `IF NOT EXISTS` and is safe after the baseline.
5. Create a disposable Netlify Database and apply migrations with the Netlify CLI. Verify the schema before using any real member data.
6. Enable Netlify Identity in the Netlify project, set Registration preferences to **Open**, and leave email confirmation on (no auto-confirm). Access is gated by the approved BLC member row, not by Identity.
7. Enable Netlify Blobs and set `FRONTEND_URL`. Configure the SMTP variables: they are now required for the "you're approved, create your account" email and for decision emails.
8. Deploy a Deploy Preview and test every flow below.

## Deploy Preview test matrix

- Health endpoint returns 200.
- Confirmed Identity account with matching approved BLC member can sign in and load `/auth/me`.
- Unknown Identity email cannot claim a BLC membership.
- An already-linked member cannot be linked to a second Identity subject.
- Suspended users are denied even if their Identity session is valid.
- MEMBER / OFFICER / ADMIN permissions are enforced by the API, not just the UI.
- Approving an application emails the applicant a `/signup?email=…` link; signing up with that email, confirming it, and signing in activates the member.
- Signing up with an email that was never approved: confirmation works, but the member area stays closed (403 from `/auth/identity/link`).
- Signing up with the admin email does not grant admin access.
- Password recovery callbacks complete successfully.
- Typing in the leaderboard, donation, vote, forum and member dialogs keeps focus in the field (no jump to the ✕ button).
- Admin document upload, role-visible download, metadata update, and deletion work.
- Non-admin upload/delete attempts are rejected; hidden documents return 404.
- Preview Blob writes do not affect production Blob storage.
- Email delivery is tested with the configured SMTP provider, if enabled.

## Known operational limitation

The `@netlify/identity` admin SDK provides server-side user management, but its documented operations do not include sending an invitation email. BLC Nexus therefore sends its own "you're approved, create your account" email through SMTP when an application is approved or a member is created, and Netlify sends the account confirmation and password-recovery emails. If SMTP is not configured the approval email is only written to the function log, and the admin should tell the person to use `/signup` with their approved email.

## Migration / cutover safety

- Keep Railway and its database running and unchanged during all preview checks.
- Existing local-disk document files are not copied into Blobs automatically. Export and migrate those files separately, then verify each document before cutover.
- Export/restore the existing database into the Netlify Database only after rehearsing the process on a disposable database and validating row counts and relationships.
- Do not use `prisma db push` against the managed Netlify database. Use reviewed SQL migrations.
- Do not commit `.env`, database URLs, SMTP credentials, Netlify personal access tokens, or other secrets.
- Only switch production traffic after all preview checks pass and a rollback plan is ready.

## Validation performed in the source-authoring environment

- Node syntax checks for `.js` / `.mjs` backend and Netlify function files.
- JSON parsing for root and workspace package manifests.
- ZIP archive integrity.

Dependency installation timed out because the npm registry was unreachable from the environment. Consequently the Vite build, Prisma generation/schema validation, Vitest suite, database migrations, and live Netlify Identity/Blobs/email tests were not run. These are release gates, not optional polish.
