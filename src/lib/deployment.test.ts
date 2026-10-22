import { test } from "node:test";
import assert from "node:assert/strict";
import { migrationChecksums, migrationProblems, missingColumns } from "../../scripts/check-database.mjs";
import { validateAssignmentChange } from "./assignmentManagement";

test("deployment check rejects pending, failed and changed migrations", () => {
  const file = { name: "migration", sql: "SELECT 1;\n" };
  const good = { migration_name: file.name, checksum: [...migrationChecksums(file.sql)][0], finished_at: new Date(), rolled_back_at: null };
  assert.deepEqual(migrationProblems([file], [good]), []);
  assert.match(migrationProblems([file], [])[0], /Pending/);
  assert.ok(migrationProblems([file], [{ ...good, finished_at: null }]).some((p) => p.includes("Failed")));
  assert.match(migrationProblems([file], [{ ...good, checksum: "changed" }])[0], /differs/);
  assert.deepEqual(migrationProblems([file], [{ ...good, finished_at: null, rolled_back_at: new Date() }, good]), []);
});
test("Windows/Linux migration line endings do not cause false deployment failures", () => {
  const checksum = [...migrationChecksums("BEGIN;\r\nCOMMIT;\r\n")][0];
  assert.ok(migrationChecksums("BEGIN;\nCOMMIT;\n").has(checksum));
});
test("deployment checks scalar columns while ignoring ORM relationship fields", () => {
  const model = { name: "Task", fields: [{ name: "reviewStatus", kind: "enum" }, { name: "user", kind: "object" }] };
  assert.deepEqual(missingColumns([model], []), ["Task.reviewStatus"]);
  assert.deepEqual(missingColumns([model], [{ table_name: "Task", column_name: "reviewStatus" }]), []);
});
test("assignment changes require reasons and prevent hidden field updates", () => {
  assert.equal(validateAssignmentChange({ action: "edit", version: 1, reason: "Extend timeline", due_date: "2026-11-01" }), null);
  for (const body of [
    { action: "cancel", version: 1, reason: "" },
    { action: "reassign", version: 1, reason: "Capacity change" },
    { action: "edit", version: 1, reason: "Update", reviewStatus: "APPROVED" },
    { action: "edit", version: 1, reason: "Update", due_date: "2026-02-30" },
    { action: "cancel", version: "1", reason: "No longer needed" },
  ]) assert.ok(validateAssignmentChange(body));
});
