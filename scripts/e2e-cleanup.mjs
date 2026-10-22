import { setImmediate } from 'node:timers/promises';

export async function closeTestDatabase(server, db) {
  await server.stop();
  // pglite-socket 0.2.14 defers socket close handlers with setImmediate.
  // stop() closes the listener without awaiting those handlers. Let them run
  // while the WASM database is still alive; db.close() then drains DB work.
  await setImmediate();
  await db.close();
}
