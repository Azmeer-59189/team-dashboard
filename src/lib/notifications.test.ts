import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationReadIds } from "./notifications";

test("notification read requests are bounded and cannot select another recipient", () => {
  assert.deepEqual(notificationReadIds({ ids: ["one", "one", "two"] }), ["one", "two"]);
  for (const body of [{ ids: [] }, { ids: [null] }, { ids: "one" }, { ids: ["one"], userId: "victim" }, { ids: Array(51).fill("one") }]) {
    assert.equal(notificationReadIds(body), null);
  }
});
