import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { closeTestDatabase } from "../../scripts/e2e-cleanup.mjs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createConnection } from "node:net";
import { once } from "node:events";

test("E2E shutdown drains deferred socket callbacks before closing the database", async () => {
  const events: string[] = [];
  let closed = false;
  const server = { stop: async () => {
    events.push("listener stopped");
    void setImmediate().then(() => {
      events.push(closed ? "callback after database close" : "disconnect callback");
    });
  } };
  const db = { close: async () => { closed = true; events.push("database closed"); } };
  await closeTestDatabase(server, db);
  assert.deepEqual(events, ["listener stopped", "disconnect callback", "database closed"]);
});

test("E2E cleanup errors remain failures instead of being swallowed", async () => {
  await assert.rejects(closeTestDatabase({ stop: async () => {} }, { close: async () => { throw new Error("close failed"); } }), /close failed/);
});

test("real socket disconnects finish before the PGlite database is disposed", async () => {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 54330 });
  let client: ReturnType<typeof createConnection> | undefined;
  try {
    await server.start();
    client = createConnection({ host: "127.0.0.1", port: 54330 });
    await once(client, "connect");
    // The server itself defers attaching its handler with setImmediate.
    await setImmediate();
    assert.equal(server.getStats().activeConnections, 1);
    client.destroy();
  } finally {
    client?.destroy();
    await closeTestDatabase(server, db);
  }
  // Surface errors from any callback that incorrectly outlives cleanup.
  await setImmediate();
  await setImmediate();
  assert.equal(db.closed, true);
});
