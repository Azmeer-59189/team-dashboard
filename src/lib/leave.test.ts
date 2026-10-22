import { test } from "node:test";
import assert from "node:assert/strict";
import { leaveScope, validateLeave } from "./leave";

test("leave dates are real, future inclusive dates bounded to one year", () => {
  const body = { start_date: "2026-10-22", end_date: "2026-10-22", reason: "Personal leave" };
  assert.equal(validateLeave(body, "2026-10-22"), null);
  for (const patch of [{ start_date: "2026-10-21" }, { end_date: "2026-10-20" }, { end_date: "2027-12-01" }, { start_date: "2026-02-30" }, { reason: " " }, { reason: true }, { user_id: "someone-else" }, { status: "APPROVED" }]) {
    assert.ok(validateLeave({ ...body, ...patch }, "2026-10-22"));
  }
});
test("leave visibility includes only self and eligible direct reports", () => {
  const base = { userId: "lead", isAdmin: false, isLead: true, departmentId: "design" };
  assert.deepEqual(leaveScope(base), { OR: [{ userId: "lead" }, { user: { role: "MEMBER", departmentId: "design", archivedAt: null } }] });
  assert.deepEqual(leaveScope({ ...base, departmentId: null }), { OR: [{ userId: "lead" }] });
  assert.deepEqual(leaveScope({ ...base, isLead: false }), { OR: [{ userId: "lead" }] });
  assert.deepEqual(leaveScope({ ...base, isAdmin: true }), {});
});
