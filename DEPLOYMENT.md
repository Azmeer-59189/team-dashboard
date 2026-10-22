# Release checks and assignment management

The subsequent notifications release adds migration `20261022020000_notifications`. Apply migrations and run the same readiness check before that release as well. See [NOTIFICATIONS.md](NOTIFICATIONS.md) for delivery, privacy, and API behavior.

## Production deployment protection

Keep Vercel's Build Command set to **`npm run build`**. Before Next.js builds a Production deployment (`VERCEL_ENV=production`), the build runs a read-only check against **DATABASE_URL**, the application's actual connection. It rejects pending/failed migrations, applied migration files that differ from their recorded checksum, and missing application columns. Windows/Linux line-ending differences are accepted. No database URLs, credentials or user records are logged.

Local and Preview builds skip the production database check by default so they don't need production credentials. Run `npm run db:check` explicitly to check your configured database, or set `REQUIRE_DATABASE_CHECK=true` for another deployment platform or an isolated Preview database. A production check failure exits the build unsuccessfully; it does not run migrations or repair data automatically. An overridden Build Command that runs `next build` directly would bypass this safeguard.

GitHub Actions runs unit checks, isolated PostgreSQL migration/service tests and a build on pushes to main and pull requests. It needs no production credentials. To make CI a merge requirement, enable branch protection requiring **Verify application / verify** in the repository settings; adding a workflow alone does not configure branch protection or force Vercel to wait for CI.

## Deploy this release

The new migration is **`20261022010000_assignment_management`**. Do not edit or reapply the already successful task-review migration.

1. Test the migration on your database branch/copy and back up the live database.
2. Configure the production DATABASE_URL and matching DIRECT_URL in your migration environment, then run `npm run db:deploy`.
3. Run `npm run db:check`. It must report that migrations and application columns match.
4. Push/deploy the release using `npm run build`, then check the live workflows with test accounts.

These changes add nullable cancellation fields and a constraint. Existing assignments, approvals and reports are retained. The readiness check was tested read-only against the configured live database while this migration was pending; it correctly refused the release. The migration was applied successfully to the configured live database on 2026-10-22, and the database readiness check passed before release. Live workflow checks with test accounts remain a deployment follow-up.

## Editing, reassignment and cancellation

On **Assignments & reviews**, open task details and expand **Manage assignment**. Each change requires a reason and the current task version. Edit the brief, priority, deadline, or task date; task dates cannot move into or out of a finalized month.

Reassign to another active eligible person. Leads are restricted to ordinary members of their department; Admins can manage other accounts across departments. The actor must be allowed to manage both the existing assignment and its new owner. Reassignment resets work to a fresh draft and clears the current submission/review fields; previous values and the reason remain in the audit history. Cross-department reassignment clears the objective link unless an explicit valid objective is supplied through the API. The former owner no longer has access to the task or its later history.

Submitted work must be returned with feedback before editing or reassignment. Approved work must be reopened by its owner first. A submitted assignment can be cancelled directly with a reason. Cancelled assignments remain available under the **Cancelled** workflow filter and in the owner's task history, display the actor and reason, and cannot be resumed, edited, reviewed or deleted. They contribute no completion credit and are excluded from active dashboard counts and default task exports. Use `GET /api/tasks?cancelled=true` or the same parameter on the export endpoint to retrieve cancelled records explicitly. Consistency still measures logging activity, independently of completion.

The cancellation record and audit entry commit in one transaction. Stale changes return 409. Finalized-month protection applies to all three actions. Managers cannot change self-logged tasks through this assignment endpoint, and nobody can reassign work to themselves.

```text
PATCH /api/tasks/:id/assignment
{ "action": "edit", "version": 2, "reason": "Extend review timeline", "due_date": "2026-11-02" }
{ "action": "reassign", "version": 3, "reason": "Balance workload", "user_id": "..." }
{ "action": "cancel", "version": 4, "reason": "Project discontinued" }
```

The existing migration recovery diagnostic remains available at `node scripts/diagnose-task-migration.mjs`. The new release-wide check is `npm run db:check`.
