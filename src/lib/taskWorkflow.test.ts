import { test } from "node:test";
import assert from "node:assert/strict";
import { taskTransition, canReviewTask, validateAction, type ReviewTask } from "./taskWorkflow";
import type { Scope } from "./scope";

const owner = { id: "member", role: "MEMBER", departmentId: "design" };
const member: Scope = { userId: "member", isAdmin: false, isLead: false, departmentId: "design" };
const lead: Scope = { userId: "lead", isAdmin: false, isLead: true, departmentId: "design" };
const admin: Scope = { userId: "admin", isAdmin: true, isLead: false, departmentId: null };
const task: ReviewTask = { userId: owner.id, departmentId: "design", status: "PENDING", reviewStatus: "DRAFT", submissionText: null, assignedById: "lead" };
const submitted: ReviewTask = { ...task, status: "IN_PROGRESS", reviewStatus: "SUBMITTED", submissionText: "Work is ready" };

test("only scoped managers can review, and nobody can approve their own work", () => {
  assert.equal(canReviewTask(lead, submitted, owner), true);
  assert.equal(canReviewTask(admin, submitted, owner), true);
  assert.equal(canReviewTask(member, submitted, owner), false);
  assert.equal(canReviewTask({ ...lead, departmentId: "other" }, submitted, owner), false);
  assert.equal(canReviewTask({ ...lead, departmentId: null }, submitted, owner), false);
  const adminOwner = { id: "admin", role: "ADMIN", departmentId: "design" };
  assert.equal(canReviewTask(admin, { ...task, userId: "admin" }, adminOwner), false);
  assert.equal(canReviewTask(lead, { ...task, userId: "peer" }, { ...owner, id: "peer", role: "LEAD" }), false);
  assert.equal(canReviewTask(lead, { ...task, departmentId: "other" }, owner), false);
});
test("submission is not a completion credit; only manager approval produces DONE", () => {
  const patch = taskTransition(task, member, owner, "submit", "Deliverable: https://example.com");
  assert.equal(patch.status, "IN_PROGRESS");
  assert.equal("reviewStatus" in patch && patch.reviewStatus, "SUBMITTED");
  const approved = taskTransition(submitted, lead, owner, "approve", "Looks good");
  assert.equal(approved.status, "DONE");
  assert.equal("reviewStatus" in approved && approved.reviewStatus, "APPROVED");
});
test("review actions require a submitted task and reject members", () => {
  assert.throws(() => taskTransition(task, lead, owner, "approve", ""), /Only submitted/);
  assert.throws(() => taskTransition(submitted, member, owner, "approve", ""), /cannot review/);
  assert.throws(() => taskTransition(submitted, { ...lead, departmentId: "other" }, owner, "request_changes", "Change this"), /cannot review/);
});
test("changes require feedback and resubmission requires a deliverable", () => {
  assert.throws(() => taskTransition(submitted, lead, owner, "request_changes", "  "), /Feedback/);
  const patch = taskTransition(submitted, lead, owner, "request_changes", "Fix the missing section");
  assert.equal("reviewStatus" in patch && patch.reviewStatus, "CHANGES_REQUESTED");
  assert.throws(() => taskTransition(task, member, owner, "submit", ""), /Describe/);
  const corrected = { ...task, reviewStatus: "CHANGES_REQUESTED" as const };
  assert.equal(taskTransition(corrected, member, owner, "submit", "Updated deliverable").status, "IN_PROGRESS");
});
test("owners can reopen approval with a reason, but managers cannot impersonate owners", () => {
  const approved = { ...submitted, status: "DONE" as const, reviewStatus: "APPROVED" as const };
  assert.throws(() => taskTransition(approved, member, owner, "reopen", ""), /reason/);
  assert.equal(taskTransition(approved, member, owner, "reopen", "Correct a mistake").status, "IN_PROGRESS");
  assert.throws(() => taskTransition(task, lead, owner, "submit", "Ready"), /Only the task owner/);
  assert.throws(() => taskTransition(submitted, member, owner, "submit", "Again"), /current state/);
});
test("workflow input requires valid versions, actions and bounded feedback", () => {
  assert.equal(validateAction({ action: "approve", version: 2 }), null);
  for (const version of [undefined, "2", -1, 1.5]) assert.ok(validateAction({ action: "approve", version }));
  assert.ok(validateAction({ action: "assign-admin", version: 1 }));
  assert.ok(validateAction({ action: "submit", version: 1, note: " " }));
  assert.ok(validateAction({ action: "request_changes", version: 1, note: "x".repeat(5001) }));
});
