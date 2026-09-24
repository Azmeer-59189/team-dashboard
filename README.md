# Team Dashboard

Role-based daily task tracker for multi-department teams (Design, Dev, Content, Grants, etc).

- **Admins**: manage departments and members, view all tasks, filter by department/member/status/date, see per-member and per-department stats.
- **Members**: log daily tasks (text or link) with a status, see their own history.

Built with **Next.js 14 (App Router)** + **Neon (serverless Postgres)** + **Prisma (ORM)** + **NextAuth.js (Credentials login)**. Designed to run on **Vercel** (app) + **Neon** (database), free tiers first.

---

## 1. Set up Neon

1. Create a free project at [neon.tech](https://neon.tech).
2. On the project dashboard, open **Connection Details** and copy two connection strings:
   - The **pooled** one (host contains `-pooler`) → this is your `DATABASE_URL`
   - The **direct** one (no `-pooler`) → this is your `DIRECT_URL` (Prisma migrations need a direct connection)

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```
Fill in `DATABASE_URL` and `DIRECT_URL` from step 1. Generate a `NEXTAUTH_SECRET` with:
```bash
openssl rand -base64 32
```
(On Windows without openssl, any random 32+ character string works fine for testing.)

## 3. Install dependencies and push the schema

```bash
npm install
npx prisma db push
```
`db push` reads `prisma/schema.prisma` and creates the `Department`, `User`, and `Task` tables in your Neon database — no separate SQL file to run.

## 4. Create your first admin account

Since there's no public sign-up (admin creates every account), seed the first one:

```bash
npm run seed
```
This creates an admin using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env.local` (defaults to `admin@company.com` / `changeme123` if you don't set them). Log in with these once the app is running, then create every other user (admin or member) from the **Members** page — no more scripts needed.

## 5. Run locally

```bash
npm run dev
```
Visit `http://localhost:3000` and log in.

## 6. Deploy (testing phase)

- **Frontend + API**: push this repo to GitHub, import it into [Vercel](https://vercel.com), and add the same environment variables in Vercel's project settings. Vercel's free tier is enough for testing.
- **Database**: nothing extra to deploy — Neon's free tier hosts the Postgres database. In production, run `npx prisma db push` (or migrations) once against your Neon database before first deploy.

## 7. Moving to production later

- Upgrade the Neon project to a paid plan when you need more compute/storage or want to remove branch/compute limits — no code changes needed.
- Upgrade Vercel to a paid plan if you need more bandwidth/build minutes or a custom domain.

## KPI Goals (new)

Admins can set targets under **KPI Goals**:
- A **department default** (e.g. "Designers: 12 done tasks/month") applies to everyone in that department.
- An **individual override** for a specific member replaces the department default for that person, for that period (weekly/monthly independently).

Progress counts only tasks marked **done**, within the current week (Mon–Sun) or current calendar month. Admins see every member's progress under **KPI Progress**; members see their own on their dashboard.

**If you already ran `npx prisma db push` before this feature was added**, run it again to create the new `Goal` table:
```bash
npx prisma db push
```
No data is lost — this only adds the new table.

## Phase 2 features (new)

**If you already had this project running, run `npx prisma db push` again** — this phase adds a `LEAD` role and an `AuditLog` table. No existing data is touched.

### Department Lead role
A third role, alongside Admin and Member. A Lead:
- Lands on the same admin-style dashboard as an Admin, but every page (Overview, All Tasks, KPI Progress, KPI Goals, Consistency, Members) is locked to their own department only — the department filter is hidden, not just defaulted.
- Can add/remove **members** (not leads or admins) only within their own department.
- Can set the department's KPI default and individual overrides only for their own department/members.
- Cannot manage the department list itself, and cannot see the Audit Log — both stay Admin-only.

Create one from **Members → Role → Lead**, same flow as creating a regular member.

### Bulk member import (CSV)
On the **Members** page, under "Bulk import". Upload a CSV with header row:
```
full_name,email,password,department,role
```
`department` must match an existing department name exactly (case-insensitive); `role` defaults to `member` if omitted. A Lead's CSV always creates plain members in their own department regardless of what the `department`/`role` columns say. Results (created/skipped per row) show right after upload. Note: this is a simple parser — don't use commas inside any field value.

### Audit log
**Admin → Audit Log**. Records who created/removed which department or member, and bulk-import summaries, newest first. Admin-only.

### CSV export
**Admin → All Tasks → Export CSV** downloads the currently filtered task list (respects department/member/status/date filters) as a CSV file.

### Consistency view
**Admin/Lead → Consistency**. Shows, per member, how many of the last 30 days had at least one task logged (any status) — a quick way to spot who's going quiet, independent of the KPI "done" target.

### Charts on the Overview page
Two charts, deliberately minimal:
- **Status breakdown** (pie chart: pending/in-progress/done) — always reflects whatever the current filters show.
- **A second, adaptive chart** that changes with your filter selection:
  - No department/member selected → bar chart comparing tasks **across departments**
  - A department selected (or a Lead's locked view) → bar chart comparing tasks **across members in that department**
  - A specific member selected → line chart of that person's **tasks per day**

## Migrating to your own MySQL database (instead of Neon)

**Status: on hold.** The project is currently back on PostgreSQL/Neon (the schema's `datasource` says `postgresql`) while remote MySQL access is confirmed with the hosting provider. The steps below are kept for when/if that migration resumes — don't follow them against the current schema as-is.

The database layer now uses MySQL (converted from the original PostgreSQL/Neon setup) so it can run against an organization-owned database, e.g. on SiteGround shared hosting.

**Before anything else**, confirm your MySQL database allows remote connections:
1. In SiteGround Site Tools → Databases → MySQL → Remote MySQL, add an allowed host. Adding `%` allows any IP (needed since Vercel doesn't provide a fixed IP without an enterprise add-on). If your host's policy won't allow wildcard remote access, this whole approach is blocked regardless of code — worth confirming with your host/IT first.
2. Note the actual **remote hostname** SiteGround gives you for the database — it is *not* `localhost` (that only works for apps running on the same server).

**Then:**
1. Set `DATABASE_URL` to `mysql://user:password@remote-host:3306/database_name` in both your local `.env` and in Vercel's project environment variables. There's no separate `DIRECT_URL` needed for MySQL (that was a Neon-specific pooling detail) — remove it from Vercel's env vars if it's still there.
2. Run `npx prisma db push` to create the tables in the new database.
3. Run `npm run seed` to create your first admin account (fresh start — no data is carried over from Neon).
4. Redeploy on Vercel (push to GitHub, or trigger a redeploy) so it picks up the new `DATABASE_URL`.

The app itself still runs on Vercel — only the database moved. Vercel + a self-hosted database is a normal, supported setup.

## Public demo deployment (for portfolio/sharing)

Your real deployment stays private with real organization data. For a portfolio link, deploy a **second, separate instance** with fake sample data instead:

1. **Separate database**: create a second free database just for this (a new free Neon project is easiest, since it's just sample data — no org policy involved). Do not point this at your real organization's database.
2. **Separate Vercel project**: import the same GitHub repo again as a new Vercel project (e.g. `team-dashboard-demo`). Give it its own environment variables:
   - `DATABASE_URL` → the new demo-only database
   - `NEXTAUTH_SECRET` → a fresh one (different from your real deployment)
   - `NEXTAUTH_URL` → this demo project's URL
   - `NEXT_PUBLIC_DEMO_MODE` → `true` (this turns on the demo credentials banner on the login page and the "Reset Demo Data" button)
3. After the first deploy, run `npx prisma db push` against the demo database, then `npm run seed:demo` (locally, with your `.env` pointed at the demo database) to fill it with realistic fake departments, members, and tasks.
4. Share the demo project's URL in your portfolio/GitHub. The login page will show one-click buttons to fill in demo admin/lead/member credentials — visitors never need real credentials, and never touch your organization's actual data.
5. Since visitors can edit/delete things in the demo, log in as the demo admin any time and click **"Reset Demo Data"** in the sidebar to wipe it back to the original sample state.

## Objectives (new)

Sits above KPI Goals to give them a strategic "why". Each department can have its own Objectives, tracked monthly, with progress from **two combined sources**:
1. **Linked KPIs** — on the KPI Goals page, optionally link any department or individual KPI to an Objective. Its progress rolls into the Objective as an average completion % across whoever the KPI applies to.
2. **Directly-tagged tasks** — when submitting a task, members can optionally tag it to an Objective (only objectives for their own department show up). If the Objective has a monthly task target set, progress shows as done-tagged-tasks vs. that target.

An Objective's overall progress is the average of whichever of these two are actually in use — if only one is set up, that one is the whole picture; if neither, it just shows "no progress data yet" rather than a misleading number.

Manage them under **Objectives** in the sidebar (Admin sees/creates for any department, Lead is locked to their own).

## Passwords (change & reset)

- Any logged-in user (any role) can change their own password from **Account** in the sidebar — requires knowing the current password.
- An Admin (or a Lead, for members in their own department) can reset someone else's password from the **Members** page → "Reset password" → enter a new temporary password. This does **not** delete the account or its task history — unlike earlier versions of this project, you never need to recreate a user just to change their password.

## Project structure

```
prisma/schema.prisma                -- Department, User, Task models + enums
prisma/seed.ts                      -- creates the first admin account
src/lib/prisma.ts                   -- Prisma client singleton
src/lib/auth.ts                     -- NextAuth config (Credentials provider, bcrypt password check)
src/lib/session.ts                  -- getSession() helper for Server Components/routes
src/lib/format.ts                   -- converts between Prisma's UPPER_SNAKE enums and the UI's lowercase values
src/middleware.ts                   -- session check + role-based route protection (admin vs member)
src/app/login/                      -- login page (NextAuth signIn)
src/app/admin/                      -- admin-only pages (overview, tasks, members, departments)
src/app/member/                     -- member pages (submit + view own tasks)
src/app/api/                        -- route handlers (auth, departments, members, tasks)
src/components/                     -- Sidebar, TaskForm, TaskTable, FilterBar, StatCard, StatusBadge
```

## How role-based access works now

Unlike the Supabase version, Neon has no built-in Row-Level Security tied to your app's users, so access control lives entirely in the application code, at two points:

1. **Middleware** (`src/middleware.ts`) redirects non-admins away from `/admin/*` and vice versa, and redirects logged-out users to `/login`.
2. **Every API route** re-checks the session itself before touching the database (e.g. `if (session.user.role !== "ADMIN") return 403`, or "does this task belong to this user or is the caller an admin"). This is what actually stops a member from editing someone else's tasks or hitting an admin-only endpoint directly — the middleware alone is just UX, not security.

If you add new API routes later, make sure each one repeats this check — there's no database-level backstop like there was with Supabase's RLS.

## Adding/removing departments & members

Both are done from the **Departments** and **Members** pages in the admin panel. Removing a member deletes their login and their task history (cascade delete); removing a department just unlinks members and their past tasks from it (their task history is kept, just without a department label).
