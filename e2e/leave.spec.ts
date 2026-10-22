import { test, expect, type Browser, type BrowserContext } from "@playwright/test";

async function login(browser: Browser, role: string, viewport: { width: number; height: number }, contexts: BrowserContext[]) {
  const context = await browser.newContext({ viewport }); contexts.push(context);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(admin|member)$/);
  return { context, page };
}

test("approved leave blocks overlapping work, keeps reasons private and cancellation restores availability", async ({ browser }, testInfo) => {
  const contexts: BrowserContext[] = [];
  try {
    const member = await login(browser, "e2e-member", testInfo.project.use.viewport!, contexts);
    const lead = await login(browser, "e2e-lead", testInfo.project.use.viewport!, contexts);
    const outsider = await login(browser, "e2e-outsider", testInfo.project.use.viewport!, contexts);
    await member.page.goto("/leave");
    const today = await member.page.getByLabel("First day", { exact: true }).inputValue();
    const future = new Date(`${today}T00:00:00Z`); future.setUTCDate(future.getUTCDate() + 40);
    const date = future.toISOString().slice(0, 10), reason = `Private personal leave ${testInfo.project.name}`;
    await member.page.getByLabel("First day", { exact: true }).fill(date);
    await member.page.getByLabel("Last day", { exact: true }).fill(date);
    await member.page.getByLabel("Reason for leave", { exact: true }).fill(reason);
    await member.page.getByRole("button", { name: "Request leave", exact: true }).click();
    const ownCard = member.page.locator("article").filter({ hasText: reason });
    await expect(ownCard.getByText("PENDING", { exact: true })).toBeVisible();
    const mine = await member.context.request.get("/api/leave");
    const leave = (await mine.json()).leaves.find((row: { reason: string }) => row.reason === reason);
    const action = { action: "approve", version: leave.version };
    for (const actor of [member, outsider]) expect((await actor.context.request.patch(`/api/leave/${leave.id}`, { data: action })).status()).toBe(403);
    expect((await member.context.request.get("/api/leave?view=team")).status()).toBe(403);
    const outsideList = await outsider.context.request.get("/api/leave?view=team");
    expect((await outsideList.json()).leaves.some((row: { id: string }) => row.id === leave.id)).toBe(false);
    expect((await outsider.context.request.get(`/api/availability?user_id=e2e-member&from=${date}&to=${date}`)).status()).toBe(403);
    expect((await member.context.request.post("/api/leave", { data: { start_date: date, end_date: date, reason: "Overlap" } })).status()).toBe(409);

    // Pending requests are advisory: existing work is retained when approved.
    const assignment = { user_id: "e2e-member", task_date: date, due_date: date, content: `Leave overlap ${testInfo.project.name}` };
    const existing = await lead.context.request.post("/api/tasks/assign", { data: assignment });
    expect(existing.status()).toBe(201);
    const existingTask = (await existing.json()).task;
    await lead.page.goto("/leave");
    await lead.page.getByRole("combobox", { name: "Leave view" }).selectOption("team");
    const teamCard = lead.page.locator("article").filter({ hasText: reason });
    await expect(teamCard.getByText(/existing assignment/)).toBeVisible();
    await teamCard.getByRole("button", { name: "Approve leave", exact: true }).click();
    await expect(teamCard.getByText("APPROVED", { exact: true })).toBeVisible();
    expect((await lead.context.request.patch(`/api/leave/${leave.id}`, { data: action })).status()).toBe(409);
    const availability = await lead.context.request.get(`/api/availability?user_id=e2e-member&from=${date}&to=${date}`);
    const available = await availability.json();
    expect(available.available).toBe(false);
    expect(JSON.stringify(available)).not.toContain(reason);
    expect((await lead.context.request.post("/api/tasks/assign", { data: assignment })).status()).toBe(409);
    const later = new Date(future); later.setUTCDate(later.getUTCDate() + 1);
    expect((await lead.context.request.patch(`/api/tasks/${existingTask.id}/assignment`, { data: { action: "edit", version: existingTask.version, reason: "Change deadline", due_date: later.toISOString().slice(0, 10) } })).status()).toBe(409);
    // Existing assignments survive approval and their briefs remain editable.
    expect((await lead.context.request.patch(`/api/tasks/${existingTask.id}/assignment`, { data: { action: "edit", version: existingTask.version, reason: "Clarify existing work", content: "Clarified pre-leave assignment" } })).status()).toBe(200);
    // Server-side reassignment and rescheduling checks cannot be bypassed by API clients.
    const second = await lead.context.request.post("/api/tasks/assign", { data: { ...assignment, user_id: "e2e-member2" } });
    expect(second.status()).toBe(201);
    const secondTask = (await second.json()).task;
    expect((await lead.context.request.patch(`/api/tasks/${secondTask.id}/assignment`, { data: { action: "reassign", version: secondTask.version, reason: "Move work", user_id: "e2e-member" } })).status()).toBe(409);

    await member.page.goto("/notifications");
    await expect(member.page.getByRole("heading", { name: /Leave approved$/ }).first()).toBeVisible();
    await member.page.goto("/leave");
    await expect(ownCard.getByText("APPROVED", { exact: true })).toBeVisible();
    member.page.once("dialog", dialog => dialog.accept());
    await ownCard.getByRole("button", { name: "Cancel leave", exact: true }).click();
    await expect(ownCard.getByText("CANCELLED", { exact: true })).toBeVisible();
    expect((await (await lead.context.request.get(`/api/availability?user_id=e2e-member&from=${date}&to=${date}`)).json()).available).toBe(true);
    expect((await lead.context.request.post("/api/tasks/assign", { data: assignment })).status()).toBe(201);

    // Rejected leave needs feedback and must never block availability.
    const another = await member.context.request.post("/api/leave", { data: { start_date: date, end_date: date, reason: "Alternate request" } });
    expect(another.status()).toBe(201);
    const anotherId = (await another.json()).id;
    expect((await lead.context.request.patch(`/api/leave/${anotherId}`, { data: { action: "reject", version: 0 } })).status()).toBe(400);
    expect((await lead.context.request.patch(`/api/leave/${anotherId}`, { data: { action: "reject", version: 0, note: "Please choose different dates" } })).status()).toBe(200);
    expect((await (await lead.context.request.get(`/api/availability?user_id=e2e-member&from=${date}&to=${date}`)).json()).available).toBe(true);
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});
