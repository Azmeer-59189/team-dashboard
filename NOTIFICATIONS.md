# In-app notifications

Every account has a Notifications inbox in the sidebar. Unread counts refresh when the tab becomes visible, after marking notifications read, and once per minute while the tab is visible. Refresh the inbox to retrieve newer items; load older items with stable date/ID pagination. Marking displayed items read affects at most 50 items per request. Newer unseen notifications are never marked read by that action.

Assignments, edits, approval, requested changes, cancellation, and reassignment notify the active assignee. Reassignment also notifies the former assignee. Submission and reopening notify active Admins and department Leads who can review that task under the same permission rules as the review endpoint. Actors never notify themselves. Existing historical audit events are not backfilled.

Notifications are generic activity signals. Open My Tasks or Assignments & reviews to see the current work under your current permissions. Task briefs, names, deliverables, feedback and audit details are deliberately not copied into inboxes, so an old notification cannot expose confidential work after reassignment or department changes.

Audit creation, notification creation and the task change use the same serializable transaction. Delivery failure rolls the entire change back. A unique recipient/event key prevents duplicate delivery. No email, push provider, scheduled worker or external service is required.

## API

- `GET /api/notifications` returns up to 30 notifications belonging to the current user, `unread`, and a `next` cursor. Pass `before=<next>` for older items. Cursors must belong to the signed-in user.
- `GET /api/notifications?count=true` returns only the current user's unread count.
- `PATCH /api/notifications` accepts `{ "ids": ["notification-id"] }`. It marks only the current user's matching unread notifications read and returns `updated`. Repeated requests are safe. Caller-supplied recipient fields are rejected. Authenticated responses are private and not cached.

Deploy migration `20261022020000_notifications` with `npm run db:deploy`, then run `npm run db:check` before deploying the application. The migration adds an empty table and indexes and does not change existing tasks. The production build guard blocks deployment if the table is missing. Live sign-in and UI smoke checks should cover a member assignment, submission to the correct Lead, and approval feedback with test accounts.

Release verification on 2026-10-22: this migration was applied to the configured live database and the readiness check passed. All 36 unit tests, 26 PostgreSQL checks, TypeScript validation and the production build passed. Authenticated live UI checks remain to be performed after deployment.
