# Backend rules and deployment

These changes extend commit `7084d48` and retain its permission checks, password fingerprint validation, normalized emails and organization timezone behavior.

## Deploy the schema before running the new application

The new application requires the migration. `prisma db push` is insufficient: it does not run the data backfills or custom constraints.

For a **new empty database**, configure `DATABASE_URL` and `DIRECT_URL`, then:

```sh
npm run db:deploy
npm run seed
```

For an **existing database originally created with db push**:

1. Back up the database and first test the upgrade on a database branch or copy.
2. Confirm that its schema matches the pre-upgrade baseline in `prisma/migrations/20261021000000_baseline/migration.sql`. Do not mark this baseline applied if the database is empty or has incompatible schema changes.
3. Record the existing schema as the baseline, once:

   ```sh
   npx prisma migrate resolve --applied 20261021000000_baseline
   npm run db:deploy
   ```

4. Deploy the application after migration succeeds. Pause application writes during migration/deployment so the old application cannot bypass the new history and assessment rules. Later releases use only `npm run db:deploy`.

Prisma CLI reads shell variables and `.env`; Next.js also reads `.env.local`. Export the database variables into the migration shell or use a local, ignored `.env` file. Never commit database credentials. No live migration was executed as part of this implementation.

The upgrade is wrapped in a database transaction. It retains existing task and assessment records, normalizes email addresses, and creates initial goal/assignment history from the values currently stored. Case-insensitive email collisions make migration fail instead of merging accounts. Resolve those accounts explicitly before retrying. On a failed Prisma migration, inspect the failure and use Prisma's migration recovery workflow; do not mark an unsuccessful upgrade applied.

Historical information that was already overwritten cannot be reconstructed. The initial revisions are a baseline, not proof of earlier targets or department assignments. Existing Done tasks keep `completedAt = null`, because their actual completion times are unknown. Older duplicate assessments remain stored with `supersededAt`, and only the latest known reviewer/competency/month entry counts. Legacy entries without a reviewer are kept distinct.

New SQL check constraints use `NOT VALID` so legacy bad records remain available for review while new writes are protected. Inspect legacy records before validating those constraints. The migration also adds a normalized-email unique index and composite task indexes.

## Performance rules

**Task approvals:** New completed work must be submitted and approved by a manager. The existing task-date attribution and 65/35 formula still apply, but every task-based score now requires both `status = DONE` and `reviewStatus = APPROVED`. The task-review migration preserves existing Done tasks as legacy approvals and does not change finalized reports.

- One goal per owner and period remains the product rule. An individual override wins **before** checking its category. A Behavioural override therefore does not fall back to a departmental Core goal for the composite score.
- `Goal` is the editable definition; `GoalRevision` records targets effective at calendar-period boundaries. Current-period edits replace that period's revision, and future revisions do not change prior periods.
- `POST /api/admin/goals` accepts optional `effectiveFrom: "YYYY-MM-DD"`. It must be the first day of the current or a future weekly/monthly/annual period. Without it, the change applies to the current period. A scheduled goal may appear in the goals management list before it affects progress; calculations read the effective revision.
- Deleting a goal retires it from the current period and cancels scheduled revisions; past revisions remain.
- Department and role assignments are recorded by calendar date. Historical calculations use the assignment at the requested date; monthly finalization uses month-end assignments. Current live dashboards use today's assignment. Task department attribution remains the department where the task was logged.
- Core remains done-task count by **task date** divided by the applicable monthly Core target, capped at 100. `completedAt` records actual new completion transitions separately. Reopening clears the current completion timestamp; the audit log retains transitions.
- Behavioural scores average active assessments. Each reviewer can contribute one entry per member, month and competency (trimmed and case-insensitive). Submitting again updates that entry. Different reviewers remain separate, equally weighted entries. Existing goal weight fields still do not alter the 65/35 formula.
- Overall is 65% Core and 35% Behavioural when both exist; one available component receives the full weight. Both missing yields no score.
- Consistency is bounded to the last 30 calendar days including today, excluding future-dated tasks.

## Finalized monthly reports

Admin-only backend endpoints:

```text
POST /api/admin/reports/monthly   { "month": "2026-09" }
GET  /api/admin/reports/monthly?month=2026-09
```

Only past calendar months can be finalized. The transaction stores member/department labels, calculated scores, applicable goals, counts, assessments and a formula version. Repeating finalization returns the same report. Archived people remain eligible for historical reports. A finalized month cannot be edited through task or assessment endpoints, including moving a task into or out of that month. Changes to later targets, assignments or source data do not recompute the saved report. There is deliberately no reopen/delete endpoint in this release; finalization is an explicit administrative action. No month is finalized automatically.

## Accounts and requests

- Removing a member deactivates the account and retains work history. Admins can restore through `PATCH /api/admin/members/:id` with `{ "archived": false }`. Current member lists omit deactivated accounts; admins can retrieve them through `GET /api/admin/members?archived=true`.
- Archival/restoration increments `authVersion`, so previously revoked sessions do not become valid again on restoration. Existing password fingerprint checks continue to invalidate sessions after password changes.
- The last-active-administrator check runs inside a serializable transaction, with bounded conflict retries. Permission checks for the target are repeated in critical transactions.
- Login attempts are limited to ten per normalized account in a fixed 15-minute window, shared through PostgreSQL. Attempts, including successful sign-ins, consume the window. A blocked sign-in returns the same generic credentials failure. Expired counters are cleaned on later attempts.
- JSON bodies are limited to 1 MiB. Bulk imports are limited to 100 rows and retain per-row success/error results. Create/update validators reject malformed types, impossible months, fractional targets and passwords longer than bcrypt's 72-byte limit.
- Important task, account, goal, objective and department mutations commit together with audit entries. Passwords and password hashes are excluded from those entries. Concurrent task edits can supply `version`; stale values return 409.

## Data access

```text
GET /api/tasks?limit=50&after=<nextCursor>&q=report&status=done&from=2026-10-01&to=2026-10-31
```

The task API enforces the caller's scope, caps pages at 100, and returns `nextCursor` or null. Pages use stable ascending IDs. Exports stream 500 rows at a time and use the same filters and scope checks. They exclude rows created after the export started, but remain a live export rather than a snapshot of concurrent edits. Export ordering is stable ID order. The existing frontend table limits are unchanged; the new pagination API is ready for a later frontend connection.

KPI and objective reporting use grouped queries across members rather than queries for each person. No external cache or background service is required.

## Verification

```sh
npm test
npm run test:db
npx tsc --noEmit --incremental false
npm run build
```

`test:db` runs the actual PostgreSQL migration SQL against an isolated in-memory PGlite database with legacy records. It checks backfills, constraints, retained history, transaction rollback and the real login-counter SQL. It never connects to the deployed database. Service tests cover scoring, history selection, report locks and permission filters. These checks do not replace an end-to-end test against your deployed NextAuth/Neon environment or load testing concurrent Prisma transactions.
