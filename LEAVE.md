# Leave and availability

Open **Leave & availability** in the sidebar. Any active account can request full-day leave for today or a future date. Dates are inclusive calendar dates using the application's configured day boundary. Each request requires a reason, lasts at most 366 days, and starts as Pending. A pending or approved request prevents a second overlapping request by that person; rejected/cancelled dates can be requested again. To change dates, cancel the request and create a new one.

Admins can review other active accounts. Department Leads can review ordinary members in their own current department. Leads' requests need an Admin; an Admin's request needs another Admin. Nobody approves or rejects their own request. Rejection needs feedback. Pending requests can be approved/rejected once. Owners can cancel their pending or approved leave through its last day, including ongoing leave; completed leave remains immutable. Managers cannot cancel on the owner's behalf in this release. Role and department changes take effect on the next request.

## Assignment availability

Only **approved** leave blocks assignment. New assignments, reassignment, and changes to task/deadline dates are rejected with 409 when any part of the inclusive task-date-to-deadline interval overlaps approved leave. The form previews availability, but the authoritative check runs again in the same serializable transaction as the assignment write. A warning is never an override. Brief/priority-only edits to an existing assignment remain possible.

Approving leave does not delete, cancel, or reassign existing work. The leave page flags overlapping, assigned, unapproved work so managers can reschedule or reassign it. Existing work can still be submitted and reviewed; this also allows people to record work they completed earlier. A task already approved is not an open-work conflict. Cancelling leave restores availability for new assignments. Pending and rejected leave never block assignments.

Requests and decisions are version-checked and audited atomically with in-app notifications. New requests/cancellation notify current eligible reviewers; decisions notify the owner. Reasons and review notes stay in the scoped leave record, outside general audit details and notifications. Availability responses expose approved dates only. Team visibility uses the same current role/department restrictions as reviewing; ordinary members see only their own requests.

**KPI targets, completion credit, consistency, and finalized reports remain unchanged**, as selected for this release. This is absence planning, not a leave entitlement/balance or payroll system. Half-days, recurring schedules, public holidays, accrual, and automatic target proration are not configured.

## API

- `GET /api/leave` lists the current user's requests. Managers can use `view=team` for their authorized scope. Responses contain at most 30 requests and a `next` cursor; use `after=<next>` for older requests.
- `POST /api/leave`: `{ "start_date": "2026-11-02", "end_date": "2026-11-04", "reason": "Personal leave" }`. The owner is always the authenticated user; owner/status injection is rejected.
- `PATCH /api/leave/:id`: `{ "action": "approve|reject|cancel", "version": 0, "note": "..." }`.
- `GET /api/availability?user_id=...&from=2026-11-02&to=2026-11-04` returns `{ available, periods }` only for a person the caller can manage. Periods contain approved leave dates, without personal reasons.

## Release and checks

Migration **`20261022030000_leave_availability`** adds the leave enum, table, constraints, and indexes. It changes no existing task, goal, report, or account data. Before production deployment run `npm run db:deploy`, then `npm run db:check`; the production build guard rejects a database missing this table. Implementation/testing does not automatically apply this migration to the live database.

On 2026-10-22 the configured database already contained every leave migration object, but Prisma recorded an unfinished migration attempt. `node scripts/verify-leave-migration.mjs` compared columns/defaults, enum labels, constraints, and indexes with the actual migration SQL in a disposable database; every comparison matched. The migration history was reconciled with `prisma migrate resolve --applied 20261022030000_leave_availability`, without rerunning schema SQL or changing user data. Deployment then reported no pending migrations. Do not use `resolve --applied` for a failure unless the full migration is independently verified as present. `node scripts/diagnose-leave-migration.mjs` performs a read-only catalog/history diagnostic.

Unit checks cover dates, scope and injected fields. PostgreSQL checks cover approval evidence, self-review, invalid ranges, inclusive date overlaps and cancellation. Desktop and mobile browser scenarios cover request/approval/cancellation, rejection feedback, private reasons, outsider/self approval denial, duplicate requests, stale review actions, notification delivery, and blocked assignment/reassignment through the real APIs. Run `npm test`, `npm run test:db`, and `npm run test:e2e`.
