# BLC Nexus — Phase 3: Storage, email and operations

## Implemented in this package

- Document uploads in Netlify Functions use Multer memory storage instead of writing to ephemeral function disk.
- The API stores file bytes in a private, site-scoped Netlify Blobs store and stores only metadata plus the opaque storage key in Postgres.
- Downloads still pass through the authenticated Express API and existing role visibility checks; there are no public blob URLs.
- Deleting a document removes its blob as well as its database record. Failed database writes trigger best-effort blob cleanup.
- Deploy Preview and branch-deploy contexts use separate store names so test uploads do not overwrite production documents. Production uses `blc-nexus-private-documents`.
- Login now surfaces member-profile synchronization failures instead of silently treating an Identity sign-in as a completed BLC Nexus login. The Identity session is retained so a temporary database outage does not force a password re-entry.
- SMTP configuration is documented for existing application-decision and operational emails. Netlify Identity remains responsible for invitation and password-recovery emails in this phase.

## Netlify configuration

1. Enable Netlify Blobs for the site (Data & Storage → Blobs). The SDK receives site credentials automatically inside Functions.
2. Enable Netlify Database and apply the baseline schema followed by `202611010002_identity_link.sql`.
3. Enable Identity and set registration to **Invite only**. Do not use open registration for this membership site.
4. Set `FRONTEND_URL` to the production site URL. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` only if application-decision emails should be sent through your SMTP provider.
5. Keep the existing Railway service and database untouched until production-like Deploy Preview checks pass.

## File handling notes

- The existing 10 MB upload limit and extension/MIME allowlist remain in force.
- Blobs are private at the platform layer, but authorization is enforced by the API route. Do not add public blob URLs or expose store keys in client responses.
- Site-wide Blobs are shared across deploy contexts by default. This implementation uses distinct store names for non-production contexts to avoid preview writes reaching the production document store.
- Local `netlify dev` uses a local/sandboxed Blobs store; it cannot verify production data persistence.
- Existing records created by the standalone backend point to local disk filenames. Those files are not automatically copied to Blobs. Before cutover, export and migrate existing document files and verify every record.

## Still requires deployment-side verification

- Dependency install and production build.
- Prisma generation/schema validation and application of both SQL migrations on a disposable Netlify Database first.
- Deploy Preview checks for login, profile linking, invitation acceptance, recovery, role enforcement, document upload/download/delete, and application email delivery.
- Verify Blobs persistence after a new deploy and verify preview uploads remain isolated.
- Confirm SMTP provider delivery and configure DNS sender authentication as required by the provider.
- Automated Identity invitations from the admin interface are not implemented yet; administrators must send the invitation from the Netlify Identity dashboard and then ensure the matching BLC member record exists.

Do not declare production-ready until all deployment-side checks above pass.
