import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdir, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

// Never load .env or accept a caller-supplied database/base URL. Both endpoints
// belong to fresh local processes; a port conflict fails instead of reusing one.
const databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1';
const baseURL = 'http://127.0.0.1:3199';
const env = { ...process.env, E2E_RUN: '1', E2E_BASE_URL: baseURL,
  DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl,
  NEXTAUTH_URL: baseURL, NEXTAUTH_URL_INTERNAL: baseURL, NEXTAUTH_SECRET: 'isolated-e2e-only-not-a-production-secret',
  NEXT_PUBLIC_DEMO_MODE: 'false', REQUIRE_DATABASE_CHECK: 'false', VERCEL_ENV: 'preview',
  NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };
let running;
let app;
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 54329, maxConnections: 1 });
const log = createWriteStream('.e2e-server.log', { flags: 'w' });
function run(file, args) {
  return new Promise((resolve, reject) => {
    running = spawn(process.execPath, [file, ...args], { env, stdio: 'inherit', windowsHide: true });
    running.once('error', reject);
    running.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${file} exited ${signal ?? code}`)));
  });
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  await exited;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { running?.kill(signal); app?.kill(signal); });
try {
  await server.start();
  const migrations = (await readdir('prisma/migrations', { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const name of migrations) await db.exec(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
  const hash = await bcrypt.hash('e2e-password-only', 4);
  await db.exec(`INSERT INTO "Department" ("id","name") VALUES ('e2e-design','E2E Design'),('e2e-other','E2E Other');`);
  for (const [id, name, role, department] of [
    ['e2e-lead', 'E2E Lead', 'LEAD', 'e2e-design'], ['e2e-member', 'E2E Member', 'MEMBER', 'e2e-design'],
    ['e2e-member2', 'E2E Second Member', 'MEMBER', 'e2e-design'], ['e2e-outsider', 'E2E Other Lead', 'LEAD', 'e2e-other'],
  ]) await db.query('INSERT INTO "User" ("id","fullName","email","passwordHash","role","departmentId") VALUES ($1,$2,$3,$4,$5,$6)', [id, name, `${id}@example.test`, hash, role, department]);
  console.log('E2E: fresh local database migrated and seeded. Production credentials are overridden.');
  await run('node_modules/prisma/build/index.js', ['generate']);
  await run('node_modules/next/dist/bin/next', ['build']);
  // A separate listener check prevents accidentally testing an existing app.
  const { createServer } = await import('node:net');
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(3199, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3199'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let startError;
  app.once('error', error => { startError = error; });
  app.stdout.pipe(log); app.stderr.pipe(log);
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if (startError || app.exitCode !== null) throw startError ?? new Error('Test app failed to start; see .e2e-server.log');
    try { ready = (await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Starting. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Test app startup timed out; see .e2e-server.log');
  await run('node_modules/@playwright/test/cli.js', ['test', ...process.argv.slice(2)]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop(running);
  await stop(app);
  await server.stop();
  await db.close();
  log.end();
}
