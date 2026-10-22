import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is missing");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
try {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const migrations = await tx.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations"
      WHERE migration_name = '20261022000000_task_assignments_reviews' ORDER BY started_at DESC LIMIT 3`;
    const columns = await tx.$queryRaw`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Task'
      ORDER BY column_name`;
    const types = await tx.$queryRaw`SELECT typname FROM pg_type WHERE typname = 'TaskReviewStatus'`;
    const constraints = await tx.$queryRaw`
      SELECT conname, convalidated FROM pg_constraint WHERE conrelid = '"Task"'::regclass ORDER BY conname`;
    const legacy = await tx.$queryRaw`
      SELECT count(*)::int AS invalid_revision_count,
      count(*) FILTER (WHERE status = 'DONE')::int AS invalid_completed_revision_count
      FROM "Task" WHERE "revisionRounds" < 0`;
    const assigned = columns.some((c) => c.column_name === "assignedById") ? await tx.$queryRaw`
      SELECT count(*)::int AS existing_assignments, count(*) FILTER (WHERE "assignedById" = "userId")::int AS self_assignments
      FROM "Task" WHERE "assignedById" IS NOT NULL` : [];
    return { migrations: migrations.map(({ logs, ...row }) => ({ ...row,
      errors: logs?.split("\n").filter((line) => /ERROR:|Database error code:|Database error:/.test(line)) ?? [] })), columns, types, constraints, legacy, assigned };
  });
  console.log(JSON.stringify(result, null, 2));
  // Verify the pooled application connection as well as the migration connection.
  if (process.env.DATABASE_URL) {
    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    try {
      await runtime.task.count({ where: { status: "DONE", reviewStatus: "APPROVED" } });
      console.log("Application connection: task review count query passed.");
    } finally { await runtime.$disconnect(); }
  }
} catch (error) {
  console.error("Diagnostic failed:", error.code ?? error.name);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
