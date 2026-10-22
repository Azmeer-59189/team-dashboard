import { test, expect, type Browser, type Page, type BrowserContext } from "@playwright/test";

async function login(browser: Browser, role: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3199/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(admin|member)$/);
  return { context, page };
}

function taskRow(page: Page, brief: string) {
  return page.getByRole("row").filter({ hasText: brief }).or(page.getByRole("listitem").filter({ hasText: brief })).filter({ visible: true });
}
async function openTask(page: Page, brief: string) {
  await taskRow(page, brief).getByRole("button", { name: /Manage work|Review work|Details/ }).click();
  return page.getByRole("dialog", { name: "Task details" });
}
async function task(context: BrowserContext, brief: string, cancelled = false) {
  const response = await context.request.get(`/api/tasks${cancelled ? "?cancelled=true" : ""}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).tasks.find((row: { content: string }) => row.content === brief);
}
async function workflow(page: Page, label: string) {
  const response = page.waitForResponse(r => r.url().endsWith("/workflow") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function assign(page: Page, brief: string) {
  await page.goto("/admin/assignments?state=ALL");
  await page.getByText("Assign a task", { exact: true }).click();
  const form = page.locator("details").filter({ has: page.getByText("Assign a task", { exact: true }) });
  await form.getByRole("combobox", { name: "Assign to", exact: true }).selectOption("e2e-member");
  await form.getByLabel("Task brief", { exact: true }).fill(brief);
  const date = await form.getByLabel("Task date", { exact: true }).inputValue();
  await form.getByLabel("Due date", { exact: true }).fill(date);
  await form.getByRole("button", { name: "Assign task", exact: true }).click();
  await expect(form.getByRole("status").filter({ hasText: "Task assigned" })).toBeVisible();
  return task(page.context(), brief);
}
async function notice(page: Page, title: string) {
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: new RegExp(`${title}$`) }).first()).toBeVisible();
}

test("assignment, feedback, resubmission, approval and reopening preserve permissions and credit", async ({ browser, request }, testInfo) => {
  const contexts: BrowserContext[] = [];
  try {
    expect((await request.get("/api/tasks")).status()).toBe(401);
    expect((await request.get("/api/notifications")).status()).toBe(401);
    const lead = await login(browser, "e2e-lead", testInfo.project.use.viewport!); contexts.push(lead.context);
    const member = await login(browser, "e2e-member", testInfo.project.use.viewport!); contexts.push(member.context);
    const outsider = await login(browser, "e2e-outsider", testInfo.project.use.viewport!); contexts.push(outsider.context);
    const brief = `E2E review lifecycle ${testInfo.project.name}`;
    const assigned = await assign(lead.page, brief);
    expect(assigned.review_status).toBe("DRAFT");
    await notice(member.page, "New assignment");
    const entry = member.page.locator("article").filter({ has: member.page.getByRole("heading", { name: /New assignment$/ }) }).first();
    await entry.getByRole("button", { name: "Mark as read", exact: true }).click();
    await expect(entry.getByRole("button", { name: "Mark as read", exact: true })).toHaveCount(0);
    await member.page.reload();
    await expect(member.page.getByRole("heading", { name: /New assignment$/ }).first()).toBeVisible();
    await expect(member.page.locator("article").filter({ has: member.page.getByRole("heading", { name: /New assignment$/ }) }).first().getByRole("button", { name: "Mark as read", exact: true })).toHaveCount(0);
    await member.page.goto("/member/tasks");
    let panel = await openTask(member.page, brief);
    await panel.getByLabel("Completed work or deliverable link").fill("Initial deliverable https://example.test/report");
    await workflow(member.page, "Submit for review");
    let current = await task(member.context, brief);
    expect(current.review_status).toBe("SUBMITTED"); expect(current.status).toBe("in-progress");
    await member.page.goto("/member");
    await expect(member.page.locator(".stat-hero-value")).toHaveText("0");
    for (const actor of [member, outsider]) {
      const result = await actor.context.request.post(`/api/tasks/${assigned.id}/workflow`, { data: { action: "approve", version: current.version, note: "Forbidden approval" } });
      expect(result.status()).toBe(403);
    }
    await notice(lead.page, "Work submitted for review");
    const outsiderInbox = await outsider.context.request.get("/api/notifications");
    expect((await outsiderInbox.json()).notifications).toHaveLength(0);
    await lead.page.goto("/admin/assignments");
    panel = await openTask(lead.page, brief);
    await panel.getByLabel("Review feedback").fill("Please add references");
    await workflow(lead.page, "Request changes");
    await notice(member.page, "Changes requested");
    await member.page.goto("/member/tasks");
    panel = await openTask(member.page, brief);
    await expect(panel.getByText("Please add references", { exact: true }).first()).toBeVisible();
    await panel.getByLabel("Completed work or deliverable link").fill("Revised deliverable with references");
    await workflow(member.page, "Resubmit for review");
    current = await task(member.context, brief);
    const stale = await lead.context.request.post(`/api/tasks/${assigned.id}/workflow`, { data: { action: "approve", version: assigned.version, note: "Stale browser" } });
    expect(stale.status()).toBe(409);
    await lead.page.goto("/admin/assignments");
    panel = await openTask(lead.page, brief);
    await panel.getByLabel("Review feedback").fill("References checked");
    await workflow(lead.page, "Approve work");
    current = await task(member.context, brief);
    expect(current.review_status).toBe("APPROVED"); expect(current.status).toBe("done");
    await notice(member.page, "Work approved");
    await member.page.goto("/member");
    await expect(member.page.locator(".stat-hero-value")).toHaveText("1");
    await member.page.goto("/member/tasks");
    panel = await openTask(member.page, brief);
    await panel.getByLabel("Reason for reopening").fill("Correct an outdated reference");
    await workflow(member.page, "Reopen task");
    await member.page.goto("/member");
    await expect(member.page.locator(".stat-hero-value")).toHaveText("0");
    const history = await lead.context.request.get(`/api/tasks/${assigned.id}/history`);
    expect(history.ok()).toBeTruthy();
    expect((await history.json()).events.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["task.assign", "task.submit", "task.request_changes", "task.approve", "task.reopen"]));
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});

test("reassignment removes former-owner access and cancellation preserves history", async ({ browser }, testInfo) => {
  const contexts: BrowserContext[] = [];
  try {
    const lead = await login(browser, "e2e-lead", testInfo.project.use.viewport!); contexts.push(lead.context);
    const member = await login(browser, "e2e-member", testInfo.project.use.viewport!); contexts.push(member.context);
    const next = await login(browser, "e2e-member2", testInfo.project.use.viewport!); contexts.push(next.context);
    const brief = `E2E reassignment ${testInfo.project.name}`;
    const assigned = await assign(lead.page, brief);
    await lead.page.goto("/admin/assignments?state=ALL");
    let panel = await openTask(lead.page, brief);
    await panel.getByText("Manage assignment", { exact: true }).click();
    await panel.getByRole("combobox", { name: "Action", exact: true }).selectOption("reassign");
    await panel.getByRole("combobox", { name: "New assignee", exact: true }).selectOption("e2e-member2");
    await panel.getByLabel("Reason (required)", { exact: true }).fill("Balance workload");
    const saved = lead.page.waitForResponse(r => r.url().endsWith("/assignment") && r.request().method() === "PATCH");
    await panel.getByRole("button", { name: "Save assignment", exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(panel).not.toBeVisible();
    await member.page.goto("/member/tasks");
    await expect(taskRow(member.page, brief)).toHaveCount(0);
    const denied = await member.context.request.get(`/api/tasks/${assigned.id}/history`);
    expect([403, 404]).toContain(denied.status());
    const deniedSubmit = await member.context.request.post(`/api/tasks/${assigned.id}/workflow`, { data: { action: "submit", version: 1, note: "Former owner" } });
    expect(deniedSubmit.status()).toBe(403);
    await notice(next.page, "Assignment reassigned");
    await next.page.goto("/member/tasks");
    await expect(taskRow(next.page, brief)).toBeVisible();
    await lead.page.goto("/admin/assignments?state=ALL");
    panel = await openTask(lead.page, brief);
    await panel.getByText("Manage assignment", { exact: true }).click();
    await panel.getByRole("combobox", { name: "Action", exact: true }).selectOption("cancel");
    await panel.getByLabel("Reason (required)", { exact: true }).fill("Project discontinued");
    lead.page.once("dialog", dialog => dialog.accept());
    const cancelled = lead.page.waitForResponse(r => r.url().endsWith("/assignment") && r.request().method() === "PATCH");
    await panel.getByRole("button", { name: "Cancel assignment", exact: true }).click();
    expect((await cancelled).ok()).toBeTruthy();
    await expect(panel).not.toBeVisible();
    await notice(next.page, "Assignment cancelled");
    await next.page.goto("/member/tasks");
    panel = await openTask(next.page, brief);
    await expect(panel.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(panel.getByText("Cancelled by E2E Lead: Project discontinued", { exact: true })).toBeVisible();
    await expect(panel.getByText("Project discontinued", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Submit for review", exact: true })).toHaveCount(0);
    const row = await task(next.context, brief, true);
    expect(row.cancellation_reason).toBe("Project discontinued");
    const blocked = await next.context.request.post(`/api/tasks/${assigned.id}/workflow`, { data: { action: "submit", version: row.version, note: "Cancelled work" } });
    expect(blocked.status()).toBe(409);
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});
