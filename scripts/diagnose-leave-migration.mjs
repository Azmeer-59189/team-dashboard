import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DIRECT_URL) throw new Error('DIRECT_URL is missing');
const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
try {
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const migrations = await tx.$queryRaw`SELECT migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations" WHERE migration_name='20261022030000_leave_availability' ORDER BY started_at DESC LIMIT 3`;
    const columns = await tx.$queryRaw`SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='LeaveRequest' ORDER BY ordinal_position`;
    const types = await tx.$queryRaw`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=current_schema() AND t.typname='LeaveStatus' ORDER BY e.enumsortorder`;
    const constraints = await tx.$queryRaw`SELECT conname, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND t.relname='LeaveRequest'`;
    return { migrations: migrations.map(({ logs, ...row }) => ({ ...row, errors: logs?.split('\n').filter(line => /ERROR:|Database error code:|Database error:/.test(line)) ?? [] })), columns, types, constraints };
  }, { timeout: 15000 });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Diagnostic failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
