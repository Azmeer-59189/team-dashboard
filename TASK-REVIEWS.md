# Task assignments and manager reviews

## Using the feature

1. An Admin or Lead opens **Assignments & reviews** in the Workspace menu and expands **Assign a task**. Choose an active assignee, task brief, task date, deadline, priority, and optionally an objective from that person's department.
2. The assignee sees the task in **My Tasks**. Open **Manage work** to start work or submit a description of the deliverable and its link. The manager's original assignment brief stays intact.
3. The manager opens **Assignments & reviews → Awaiting review → Review work**. Approve it or request changes with required feedback.
4. The assignee sees feedback in task details and can resubmit. Every submission and decision stays in the activity timeline.

Self-logged tasks use the same review rule. Selecting **Submit for review** when logging work submits it immediately. Other tasks can be submitted later from task details. An approved task may be reopened by its owner with a reason; its KPI credit is removed until a new approval. After a month is finalized, its tasks cannot be changed.

The new management page supports workflow filtering, person/task search, and 50-task pages. Task details are available in the existing mobile cards and desktop tables. CSV exports include the review state, assignment manager, deliverable, feedback and reviewer timestamps.

## Permissions and counting

- Admins may assign/review other accounts. An administrator's own work requires a different administrator's approval.
- Leads may assign/review ordinary members in their own department. Both the task's department and the assignee's current department must match. Lead/admin work requires an Admin's review.
- Nobody assigns work to themselves or reviews their own work. Archived users cannot receive new assignments.
- Only the owner starts, submits or reopens their task. An assignee cannot rewrite the assigned brief or deadline. Manager-authored changes to draft task details remain available to Admins through the existing task update API. Lead assignment editing/reassignment is not part of this release.
- Submitted/approved tasks cannot be silently edited or deleted through the old update endpoint. A manager returns submitted work with feedback; an owner explicitly reopens approved work before editing it.
- Only approval sets **Done**. Awaiting-review and changes-requested tasks remain **In progress**, with a more specific workflow badge. Goals, composites, objective progress, and completion totals count only approved Done tasks.
- Assignment date remains the KPI attribution date. Submission records actual completion separately; approval records the decision time. There is no partial credit, and the existing 65/35 scoring formula is unchanged.
- Finalizing a month is rejected while it contains submitted tasks awaiting review. Complete reviews and resolve/re-date unfinished assignments before finalizing; all task mutations remain blocked for finalized months.
- Workflow requests require the current task version. Competing submissions/reviews return a conflict rather than overwriting each other.

## Upgrade the live database

This feature adds **one new migration**: `20261022000000_task_assignments_reviews`.

For a deployment that already applied the backend migrations:

1. Test on a database branch/copy first and pause writes during the live upgrade.
2. With your normal database environment configured, run `npm run db:deploy`.
3. Deploy the new application immediately after the migration succeeds.

Do not repeat baseline resolution on an already migrated database. Do not use `db push`: the SQL backfill and custom checks are required. The old application cannot create Done tasks against the new database checks, so avoid a window where old code is still accepting writes.

Existing Done tasks are marked as **legacy approvals**, retaining their KPI credit without inventing a reviewer or completion timestamp. Existing Pending/In-progress tasks become drafts. Already-finalized monthly reports stay unchanged.

## Backend endpoints

```text
POST /api/tasks/assign
{ "user_id": "...", "content": "Prepare the report", "task_date": "2026-10-22",
  "due_date": "2026-10-25", "priority": "medium", "objective_id": null }

POST /api/tasks/:id/workflow
{ "action": "start|submit|approve|request_changes|reopen", "version": 0, "note": "..." }

GET /api/tasks/:id/history?before=<nextCursor>
GET /api/tasks?review=SUBMITTED&limit=50
```

Submission requires a deliverable note; requesting changes and reopening require a reason. Approval feedback is optional. History is visible only to the task owner or an authorized reviewer, is paginated, and returns only activity summaries and notes. All workflow and assignment writes are audited in the same database transaction. The database also checks approval evidence, prevents self-review and self-assignment, and rejects Done without approval.

## Tests

`npm test` covers role scoping, self-review rejection, transition rules and request validation. `npm run test:db` applies the actual migrations to isolated PostgreSQL test engines and runs the real workflow service through submission, feedback, resubmission, approval, reopening and finalized-month rejection. It checks history, stale versions and direct database bypass attempts. The adapter supplies only the database calls, not the permission/state logic. These tests do not replace live NextAuth/Neon and browser checks after deployment.
