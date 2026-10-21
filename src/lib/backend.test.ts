import { test } from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { readJson } from "./request";
import { validateGoalInput, validateObjectiveInput, validateRatingInput, validateMemberInput, isPassword } from "./input";
import { currentRevisions, resolveGoal, combineScores } from "./scoring";
import { getCompositeScores } from "./compositeScore";
import { assertMonthsOpen } from "./reports";
import { taskWhere } from "./taskQuery";
import { passwordVersion } from "./passwordVersion";
import { ratingKey } from "./ratings";
import type { Prisma } from "@prisma/client";

test("malformed, null and array requests produce 400 instead of exceptions", async () => {
  for (const value of ["{", "null", "[]", "42", '"text"']) {
    const result = await readJson(new Request("http://localhost", { method: "POST", body: value }));
    assert.ok(result instanceof NextResponse);
    assert.equal(result.status, 400);
  }
  assert.deepEqual(await readJson(new Request("http://localhost", { method: "POST", body: '{"title":"OK"}' })), { title: "OK" });
});
test("body size limit applies even without Content-Length", async () => {
  const result = await readJson(new Request("http://localhost", { method: "POST", body: JSON.stringify({ content: "x".repeat(1024 * 1024) }) }));
  assert.ok(result instanceof NextResponse);
  assert.equal(result.status, 413);
});
test("counts reject fractional, boolean and out-of-range values", () => {
  for (const targetCount of [0, -1, 1.5, true, [], 2147483648]) {
    assert.ok(validateGoalInput({ targetCount }));
    assert.ok(validateObjectiveInput({ title: "Objective", targetTaskCount: targetCount }));
  }
  assert.equal(validateGoalInput({ targetCount: "12" }), null);
  assert.ok(validateObjectiveInput({ title: "" }, true));
});
test("ratings require a real month and do not coerce booleans into scores", () => {
  const valid = { userId: "member", competency: "Teamwork", score: 8, periodLabel: "2026-10" };
  assert.equal(validateRatingInput(valid), null);
  for (const periodLabel of ["2026-00", "2026-99", "0000-01", "2026-1"]) assert.ok(validateRatingInput({ ...valid, periodLabel }));
  assert.ok(validateRatingInput({ ...valid, score: true }));
});
test("member validation checks types and bcrypt's UTF-8 byte limit", () => {
  const valid = { full_name: "Ali", email: "ali@example.com", password: "securepassword" };
  assert.equal(validateMemberInput(valid), null);
  assert.ok(validateMemberInput({ ...valid, password: 123456 }));
  assert.equal(isPassword("é".repeat(37)), false);
  assert.equal(isPassword("a".repeat(72)), true);
});
test("individual Behavioural override prevents falling back to departmental Core", () => {
  const goals = [
    { userId: null, departmentId: "design", period: "MONTHLY" as const, category: "CORE", targetCount: 20 },
    { userId: "member", departmentId: null, period: "MONTHLY" as const, category: "BEHAVIOURAL", targetCount: 10 },
  ];
  assert.equal(resolveGoal(goals, "member", "design", "MONTHLY")?.category, "BEHAVIOURAL");
  assert.equal(resolveGoal(goals, "other", "design", "MONTHLY")?.category, "CORE");
});
test("a future target or retirement does not alter a previous month's goal", () => {
  const base = { userId: "m", departmentId: null, period: "MONTHLY" as const, category: "CORE", retired: false, createdAt: new Date("2026-10-01") };
  const rows = [
    { ...base, targetCount: 20, effectiveFrom: new Date("2026-10-01") },
    { ...base, targetCount: 30, effectiveFrom: new Date("2026-11-01") },
    { ...base, targetCount: 30, effectiveFrom: new Date("2026-12-01"), retired: true },
  ];
  assert.equal(currentRevisions(rows, new Date("2026-10-21"))[0].targetCount, 20);
  assert.equal(currentRevisions(rows, new Date("2026-11-21"))[0].targetCount, 30);
  assert.deepEqual(currentRevisions(rows, new Date("2026-12-21")), []);
});
test("missing components are not treated as zero", () => {
  assert.equal(combineScores(75, 70), 73.25);
  assert.equal(combineScores(null, 70), 70);
  assert.equal(combineScores(75, null), 75);
  assert.equal(combineScores(null, null), null);
});
test("finalized reports are returned without recalculating changed source data", async () => {
  const score = { userId: "m", corePct: 75, coreGoalCount: 1, behaviouralPct: 70, behaviouralScoreCount: 2, overall: 73 };
  const db = { monthlyReport: { findUnique: async () => ({ rows: [{ member: { id: "m" }, score }] }) } } as unknown as Prisma.TransactionClient;
  const scores = await getCompositeScores([{ id: "m", departmentId: "new-department" }], new Date("2026-10-01"), db);
  assert.deepEqual(scores.get("m"), score);
});
test("editing either the old or new month of a moved task checks report locks", async () => {
  let queried: unknown;
  const db = { monthlyReport: { findFirst: async (args: unknown) => { queried = args; return { periodLabel: "2026-09" }; } } } as unknown as Prisma.TransactionClient;
  await assert.rejects(assertMonthsOpen(db, [new Date("2026-09-20"), new Date("2026-10-01")]), /finalized/);
  assert.deepEqual(queried, { where: { periodLabel: { in: ["2026-09", "2026-10"] } }, select: { periodLabel: true } });
});
test("task query scoping cannot be overridden by member-supplied filters", () => {
  const member = { userId: "m", departmentId: "design", isAdmin: false, isLead: false };
  assert.deepEqual(taskWhere(new URLSearchParams("member=someone-else&department=other"), member), { userId: "m" });
  const lead = { ...member, isLead: true };
  assert.equal(taskWhere(new URLSearchParams("department=other"), lead).departmentId, "design");
  assert.throws(() => taskWhere(new URLSearchParams(), { ...lead, departmentId: null }), /Department/);
  assert.throws(() => taskWhere(new URLSearchParams("from=2026-10-25&to=2026-10-01"), lead), /date range/);
});
test("rating identity is stable across case/space changes but separates reviewers", () => {
  assert.equal(ratingKey("m", "2026-10", " Teamwork ", "r"), ratingKey("m", "2026-10", "teamwork", "r"));
  assert.notEqual(ratingKey("m", "2026-10", "Teamwork", "r1"), ratingKey("m", "2026-10", "Teamwork", "r2"));
});
test("password changes invalidate the existing password fingerprint", () => {
  assert.notEqual(passwordVersion("old-bcrypt-hash"), passwordVersion("new-bcrypt-hash"));
});
