# Phase 2 — Netlify Identity integration

## Included in this code change

- Frontend uses `@netlify/identity` for login, logout, session lookup, password recovery, and callback processing.
- Browser API requests send Identity cookies and no longer persist the old bearer token in localStorage.
- Netlify API wrapper uses the modern Functions runtime via `@netlify/aws-lambda-compat`, then verifies the Identity cookie with `getUser()` before injecting a server-trusted subject header into the existing Express adapter.
- Express auth middleware maps the verified Identity subject to `User.netlifyIdentityId` and checks the current database status/role on every request.
- Identity signup event assigns only the least-privilege `member` Identity role.
- Existing password/JWT login and password-management endpoints are disabled in Identity mode.
- A nullable unique `netlifyIdentityId` mapping column is added by the included SQL migration.

## Required Netlify dashboard configuration (manual)

1. Deploy this branch as a **Deploy Preview** first; do not switch production traffic.
2. In Project configuration → Identity, enable Identity.
3. Set Registration preferences to **Invite only**. This is essential: the BLC Nexus database is the membership approval source, and open self-registration must not be enabled.
4. Use Identity → Users to invite each already-approved member. The invitation email is sent by Netlify. Existing custom JWT invitation emails are intentionally disabled in Identity mode.
5. Existing member records must be `ACTIVE` or `INVITED` in the database. After an invited user accepts their Netlify invitation and confirms the email, the first API call links the verified Identity subject to the matching email and activates the invited database row.
6. Test member, officer, admin, suspended, unlinked, wrong-email, expired-session, and logout scenarios on the Deploy Preview.

## Role mapping and security

BLC Nexus authorization remains database-backed (`MEMBER`, `OFFICER`, `ADMIN`). Do not trust browser-provided role values or Identity metadata for app permissions. The API reads the user row by the verified Identity subject on every protected request, so role changes and suspensions take effect immediately. Netlify Identity `member` role is a coarse platform role only; app authorization remains in PostgreSQL.

## Important limitations / not yet production-verified

- Netlify Identity dashboard settings cannot be enabled from repository code.
- The existing admin UI's invite action creates the pending BLC record, but Netlify Identity invitation delivery must currently be completed in Identity → Users. No undocumented Identity API is called.
- Netlify's Identity callbacks and session endpoints do not complete under `netlify dev`; test on a real Deploy Preview.
- Password reset callback UX, invite acceptance UX, role synchronization, and all API routes must be verified on a Deploy Preview before production cutover.
- Dependency installation/build/tests and database migration application have not been confirmed in this environment. Do not treat this as a production-ready release.
- Keep the Railway deployment and its database unchanged until all checks pass.


Phase 3 follow-up: login now surfaces profile-sync errors rather than swallowing them. See `NETLIFY-PHASE3-STORAGE-OPERATIONS.md` for Blobs-backed document storage and deployment checks.
