# End-to-end workflow checks

Install dependencies with `npm ci`, then install Chromium once with `npx playwright install chromium`. Linux CI uses `npx playwright install --with-deps chromium` to install browser system dependencies as well.

Run `npm run test:e2e`. The runner:

1. Creates a fresh in-memory PGlite PostgreSQL database and binds it to `127.0.0.1:54329`.
2. Applies every checked-in SQL migration in order and creates synthetic test accounts.
3. Overrides database URLs, NextAuth URL/secret and demo mode in child processes. Existing `.env` values cannot select the database or application under test.
4. Builds a production app into `.next-e2e`, then starts it on `http://127.0.0.1:3199`.
5. Runs Playwright against desktop and phone-sized Chromium viewports with real credentials sign-in, Prisma queries and HTTP requests.
6. Stops the app and database, discarding all test records.

No production accounts, database credentials, Docker installation, or external services are needed. Both local ports must be free: the runner refuses to reuse an existing application or database. Do not run two copies simultaneously. It does not call `prisma migrate deploy` or reset any configured database; migration SQL is applied only to the newly created in-memory database. PGlite's single-connection behavior makes this a functional workflow suite, not a production concurrency/load test.

## Coverage

- Lead creates an assignment through the form; member receives a notification and marks it read persistently.
- Member submits work; only an eligible manager receives a review alert.
- Self approval and cross-department approval fail through the real API.
- Manager requests changes; member sees feedback and resubmits.
- A stale approval request returns 409.
- Approval changes the visible completed-task count; reopening removes the credit.
- The activity endpoint retains assignment, submission, feedback, approval and reopening events.
- Reassignment removes the former owner's task visibility, history access and submission permission.
- The new assignee receives a notification and can see the task.
- Cancellation retains its reason and history, notifies the assignee, and blocks further submission.

Each scenario runs at desktop and phone widths. UI actions use accessible labels/roles; permission assertions use the same browser session's authenticated HTTP client. No auth or application endpoints are mocked, and no test-only authentication bypass exists.

## Results and CI

GitHub Actions runs the separate `e2e` job on main pushes and pull requests without repository secrets. Failed runs upload a seven-day artifact with the HTML report, screenshots, browser traces and local app log. Add this job to required branch checks if you want it to block merges; the workflow itself cannot configure branch protection.

Locally inspect `playwright-report/index.html`, `test-results/`, or `.e2e-server.log` after a failure. Run `npm run test:e2e -- --project=desktop` to run only desktop cases, or `npm run test:e2e -- --headed` to watch Chromium. The runner always creates a new database, including filtered reruns. `npx playwright test` directly is intentionally blocked so it cannot accidentally target your live app.

These checks validate an isolated production build. They do not confirm that a hosted deployment has finished or that its environment variables match; perform a live smoke check with dedicated test accounts after deployment.
