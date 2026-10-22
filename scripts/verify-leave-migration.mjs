import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

// Compare catalogs against the actual migration SQL in a disposable database.
// Never mark a migration applied based only on a table name or column count.
const queries = {
  columns: `SELECT column_name, data_type, udt_name, is_nullable, column_default, datetime_precision FROM information_schema.columns WHERE table_schema='public' AND table_name='LeaveRequest' ORDER BY ordinal_position`,
  types: `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='LeaveStatus' ORDER BY e.enumsortorder`,
  constraints: `SELECT c.conname, c.convalidated, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='LeaveRequest' AND c.contype IN ('p','u','f','c') ORDER BY c.conname`,
  indexes: `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='LeaveRequest' ORDER BY indexname`,
};
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DIRECT_URL) throw new Error('DIRECT_URL is missing');
const live = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const expected = await PGlite.create();
try {
  for (const name of (await readdir('prisma/migrations')).filter(name => /^\d/.test(name)).sort()) {
    await expected.exec(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
  }
  const reference = {};
  for (const [key, query] of Object.entries(queries)) reference[key] = (await expected.query(query)).rows;
  const actual = await live.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const snapshot = {};
    for (const [key, query] of Object.entries(queries)) snapshot[key] = await tx.$queryRawUnsafe(query);
    return snapshot;
  }, { timeout: 15000 });
  let matches = true;
  for (const key of Object.keys(queries)) {
    const equal = isDeepStrictEqual(actual[key], reference[key]);
    console.log(`${key}: ${equal ? 'matches migration SQL' : 'MISMATCH'}`);
    if (!equal) { matches = false; console.log(JSON.stringify({ expected: reference[key], actual: actual[key] }, null, 2)); }
  }
  if (!matches) process.exitCode = 1;
  else console.log('All leave migration objects match. No schema or user data was changed.');
} catch (error) {
  console.error('Verification failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await live.$disconnect(); await expected.close(); }
