import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDate, validateTaskFields } from "./validation";

test("dates must be real calendar dates in YYYY-MM-DD format", () => {
  assert.equal(isValidDate("2024-02-29"), true);
  for (const value of ["2025-02-29", "2026-02-30", "2026-13-01", "10/21/2026", "2026-10-21T12:00:00Z"]) {
    assert.equal(isValidDate(value), false, value);
  }
});

test("malformed task fields return validation errors without throwing", () => {
  for (const fields of [{ content: 42 }, { content: null }, { category: {} }, { task_date: [] }, { revision_rounds: true }]) {
    assert.equal(typeof validateTaskFields(fields as any), "string");
  }
});

test("link tasks require an HTTP or HTTPS URL", () => {
  assert.equal(validateTaskFields({ type: "link", content: "https://example.com" }), null);
  assert.ok(validateTaskFields({ type: "link", content: "javascript:alert(1)" }));
  assert.ok(validateTaskFields({ type: "link", content: "plain text" }));
});

test("revision counts must be nonnegative integers", () => {
  assert.equal(validateTaskFields({ revision_rounds: 0 }), null);
  assert.equal(validateTaskFields({ revision_rounds: "2" }), null);
  assert.ok(validateTaskFields({ revision_rounds: -1 }));
  assert.ok(validateTaskFields({ revision_rounds: 1.5 }));
});
