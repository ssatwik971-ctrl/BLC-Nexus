# BLC Nexus API

Base URL: `/api` (e.g. `http://localhost:4000/api`). JSON in, JSON out.

**Auth:** `Authorization: Bearer <JWT>` (returned by `/auth/login` and `/auth/accept-invite`).
**Errors:** `{ "error": "message", "details": { ... } }` with status 400 (validation), 401 (not logged in), 403 (role too low), 404, 409 (conflict), 413/415 (upload), 429 (rate limited).

Roles, lowest to highest: `MEMBER` < `OFFICER` < `ADMIN`. "Member+" means any logged-in active user.
Applicants have no account; they use a private status token.

## Public (no login)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/public/site` | Site name, tagline, editable settings (home/about/stats/recruiting), member count |
| GET | `/public/leaderboard` | `{ activity: [], donation: [] }` |
| POST | `/public/contact` | `{ name, email, message }` — rate limited |
| POST | `/applications` | Submit an application. Returns `{ id, token, statusUrl }` — rate limited |
| GET | `/applications/status/:token` | Applicant status check |

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` — rate limited |
| POST | `/auth/accept-invite` | `{ token, password }` activates an invited account and logs in |
| POST | `/auth/forgot-password` | `{ email }` — always `200` |
| POST | `/auth/reset-password` | `{ token, password }` |
| GET | `/auth/me` | Current user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |

## Member+

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Stats, offices summary, my assignments, upcoming events, pending votes |
| GET | `/users?q=` | Roster (respects each member's hidden fields) |
| GET / PATCH | `/users/me` | Own profile + contribution history / update profile and privacy |
| GET | `/notifications` | Own notifications |
| POST | `/notifications/read-all`, `/notifications/:id/read` | Mark read |
| GET | `/offices` | List offices |
| GET | `/maintenance?week=YYYY-MM-DD` | Assignments for a week (Monday-normalised) |
| GET | `/maintenance/history?mine=1` | Past weeks |
| PATCH | `/maintenance/:id` | Member: own assignment → `PAID` only. Officer: any status/note |
| GET | `/rewards` | Rewards with pledged/fulfilled totals |
| GET | `/pledges?mine=1`, `/pledges/leaderboard` | Pledges / top donors |
| POST | `/pledges` | `{ rewardItemId, amount, note? }` |
| PATCH | `/pledges/:id` | Member: cancel own pending. Officer: any status |
| GET | `/events?from=&to=` | Calendar events with RSVP counts |
| POST | `/events/:id/rsvp` | `{ status: GOING\|MAYBE\|NOT_GOING }` |
| GET | `/forum/categories`, `/forum/categories/:id/threads`, `/forum/threads/:id` | Read forums |
| POST | `/forum/threads` | `{ categoryId, title, content }` — rate limited |
| POST | `/forum/threads/:id/posts` | `{ content }` — rate limited; blocked on locked threads (except officers) |
| POST | `/forum/posts/:id/upvote` | Toggle upvote |
| DELETE | `/forum/threads/:id`, `/forum/posts/:id` | Author or officer+ |
| GET | `/wiki`, `/wiki/:slug` | Read wiki |
| GET | `/votes`, `/votes/history/mine` | Votes (results only after close, or for admins) |
| POST | `/votes/:id/cast` | `{ option }` — one vote per member, eligibility enforced |
| GET | `/documents` | Only documents visible to your role |
| GET | `/documents/:id/download` | Role-checked file download |
| GET | `/audit/snapshots` | Performance history (for charts) |

## Officer+

| Method | Path | Notes |
|---|---|---|
| POST / PATCH | `/offices`, `/offices/:id` | Create / edit offices |
| POST | `/maintenance` | `{ officeId, userId, weekStart?, dueAt?, note? }` |
| POST | `/maintenance/copy-week` | `{ from, to }` copy last week's assignments |
| POST | `/maintenance/remind` | `{ week? }` in-app + email reminders for unpaid |
| DELETE | `/maintenance/:id` | Remove assignment |
| POST / PATCH | `/rewards`, `/rewards/:id` | Manage rewards (incl. `status` AVAILABLE/PURCHASED/CLAIMED) |
| POST / PATCH / DELETE | `/events`, `/events/:id` | Manage events |
| PATCH | `/forum/threads/:id` | `{ pinned?, locked?, title? }` moderation |
| PUT | `/wiki/:slug` | `{ title, content }` create/update page |

## Admin

| Method | Path | Notes |
|---|---|---|
| DELETE | `/offices/:id`, `/rewards/:id`, `/wiki/:slug` | Delete content |
| POST / PATCH / DELETE | `/forum/categories`, `/forum/categories/:id` | Manage categories |
| POST / PATCH | `/votes`, `/votes/:id` | Create votes / close early |
| POST | `/documents` | `multipart/form-data`: `file`, `title`, `description?`, `category?`, `visibleToRole?` |
| PATCH / DELETE | `/documents/:id` | Edit metadata / delete file |
| POST / DELETE | `/audit/snapshots`, `/audit/snapshots/:id` | Record performance snapshots |
| GET | `/admin/applications?status=` | Review queue |
| PATCH | `/admin/applications/:id` | `{ status: APPROVED\|REJECTED\|WAITLISTED\|PENDING, note? }` — approving creates the member and emails an invite |
| GET / POST | `/admin/users` | List all accounts / invite a member directly |
| PATCH / DELETE | `/admin/users/:id` | Change role/status/name; remove (cannot remove yourself or the last admin) |
| POST | `/admin/users/:id/reset-password` | Sends reset email (or resends invite) |
| PUT | `/admin/settings/:key` | `key` ∈ `home`, `about`, `stats`, `recruiting`; body `{ value }` |
| PUT | `/admin/leaderboard/:kind` | `kind` ∈ `activity`, `donation`; body `{ entries: [{ name, score }] }` replaces the list |
| GET | `/admin/logs` | Last 200 admin/officer actions |
