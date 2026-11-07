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
| GET | `/public/leaderboard` | `{ cash: [], coins: [] }` (top 10 active donors per type, calculated from recorded donations) |
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
| POST | `/auth/admin-login` | `{ email, pin }` → sets the `blc_admin` session cookie. Compared with `ADMIN_EMAIL` / `ADMIN_PIN`; `429` after repeated failures, `503` if not configured |
| POST | `/auth/admin-logout` | Ends the admin session |

## Member+

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Stats, offices summary, my weekly donation status, pending votes |
| GET | `/users?q=` | Roster (respects each member's hidden fields) |
| GET / PATCH | `/users/me` | Own profile + contribution history / update profile and privacy |
| GET | `/notifications` | Own notifications |
| POST | `/notifications/read-all`, `/notifications/:id/read` | Mark read |
| GET | `/offices` | List offices |
| GET | `/donations?type=cash\|coins` | Donation history, `total` donated, `spent` on maintenance, coop `balance` (total − spent) and your total for that type |
| GET | `/maintenance-expenses` | Weekly maintenance totals (cash + coins); `promptWeek` is set only for the admin when a week's total is due |
| GET | `/donation-status?week=YYYY-MM-DD` | Every player (admin, officers, members) with whether they gave the minimum donation that week |
| GET | `/donations/leaderboard?type=cash\|coins` | Top donors for that type |
| GET | `/forum/categories`, `/forum/categories/:id/threads`, `/forum/threads/:id` | Read forums |
| POST | `/forum/threads` | `{ categoryId, title, content }` — rate limited |
| POST | `/forum/threads/:id/posts` | `{ content }` — rate limited; blocked on locked threads (except officers) |
| POST | `/forum/posts/:id/upvote` | Toggle upvote |
| DELETE | `/forum/threads/:id`, `/forum/posts/:id` | Author or officer+ |
| GET | `/wiki`, `/wiki/:slug` | Read wiki |
| GET | `/votes`, `/votes/history/mine` | Votes (results only after close, or for officers and the admin) |
| POST | `/votes/:id/cast` | `{ option }` — one vote per member, eligibility enforced |
| GET | `/documents` | Only documents visible to your role |
| GET | `/documents/:id/download` | Role-checked file download |
| GET | `/audit/snapshots` | Performance history (for charts) |

## Officer+

| Method | Path | Notes |
|---|---|---|
| POST / PATCH | `/offices`, `/offices/:id` | Create / edit offices |
| PUT | `/maintenance-expenses` | **Admin only.** `{ weekStart?, cash, coins, note? }` replaces that week's total; deducted from the coop balance |
| DELETE | `/maintenance-expenses/:id` | **Admin only.** |
| PUT | `/donation-status` | Officer/admin: `{ userId, met, weekStart? }` (officers cannot change their own) |
| POST | `/auth/admin-logout-all` | Admin only: removes every admin session |
| POST | `/donations` | `{ userId, type: CASH\|COINS, amount, note?, donatedAt? }` — coins must be whole numbers; notifies the member |
| DELETE | `/donations/:id` | Remove a mistaken entry |
| DELETE | `/offices/:id`, `/wiki/:slug` | Delete content |
| POST / PATCH / DELETE | `/forum/categories`, `/forum/categories/:id` | Manage categories |
| POST / PATCH | `/votes`, `/votes/:id` | Create votes / close early |
| POST | `/documents` | `multipart/form-data`: `file`, `title`, `description?`, `category?`, `visibleToRole?` (`ADMIN` visibility is admin-only) |
| PATCH / DELETE | `/documents/:id` | Edit metadata / delete file (admin-only documents need the admin) |
| POST / DELETE | `/audit/snapshots`, `/audit/snapshots/:id` | Record performance snapshots |
| PATCH | `/forum/threads/:id` | `{ pinned?, locked?, title? }` moderation |
| PUT | `/wiki/:slug` | `{ title, content }` create/update page |
| GET | `/admin/users` | List all accounts |
| PATCH / DELETE | `/admin/users/:id` | Suspend / reactivate / remove **regular members** (officers and the admin account are protected from officers) |
| POST | `/admin/users/:id/reset-password` | Sends reset email (or resends invite) |
| PUT | `/admin/settings/:key` | `key` ∈ `home`, `about`, `stats`, `recruiting`; body `{ value }` |
| GET | `/admin/logs` | Last 200 admin/officer actions |

## Admin only

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/applications?status=` | Review queue |
| PATCH | `/admin/applications/:id` | `{ status: APPROVED\|REJECTED\|WAITLISTED\|PENDING, note? }` — approving creates the member and emails an invite |
| POST | `/admin/users` | Invite a member directly: `{ email, inGameName, playerId?, role: MEMBER\|OFFICER }` |
| PATCH | `/admin/users/:id` | `{ role: MEMBER\|OFFICER }` — **only the admin can make someone an officer**; the `ADMIN` role cannot be assigned |
| PATCH / DELETE | `/admin/users/:id` | Manage officers as well as members (never the admin account itself) |
