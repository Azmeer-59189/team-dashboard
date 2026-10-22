import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

export function migrationChecksums(sql) {
  const lf = sql.replace(/\r\n/g, "\n");
  return new Set([sql, lf, lf.replace(/\n/g, "\r\n")].map((text) => createHash("sha256").update(text).digest("hex")));
}
export function migrationProblems(files, records) {
  const problems = [];
  for (const row of records) {
    if (!row.finished_at && !row.rolled_back_at) problems.push(`Failed/incomplete migration: ${row.migration_name}`);
  }
  for (const file of files) {
    const applied = records.find((row) => row.migration_name === file.name && row.finished_at && !row.rolled_back_at);
    if (!applied) problems.push(`Pending migration: ${file.name}`);
    else if (!migrationChecksums(file.sql).has(applied.checksum)) problems.push(`Applied migration differs from source: ${file.name}`);
  }
  return problems;
}
export function missingColumns(models, columns) {
  const actual = new Set(columns.map((column) => `${column.table_name}.${column.column_name}`));
  return models.flatMap((model) => model.fields.filter((field) => field.kind !== "object")
    .filter((field) => !actual.has(`${model.dbName ?? model.name}.${field.dbName ?? field.name}`))
    .map((field) => `${model.dbName ?? model.name}.${field.dbName ?? field.name}`));
}
export async function checkDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the deployment database check.");
  // Verify the application's pooled connection, not just the migration URL.
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const names = (await readdir("prisma/migrations", { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    const files = await Promise.all(names.map(async (name) => ({ name, sql: await readFile(`prisma/migrations/${name}/migration.sql`, "utf8") })));
    const problems = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const columns = await tx.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()`;
      const absent = missingColumns(Prisma.dmmf.datamodel.models, columns);
      const records = await tx.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
      return [...migrationProblems(files, records), ...absent.map((column) => `Missing database column: ${column}`)];
    });
    if (problems.length) throw new Error(`Database is not ready for this release:\n${problems.map((p) => `- ${p}`).join("\n")}\nRun npm run db:deploy against the matching production database, then retry deployment.`);
    console.log("Database readiness check passed: migrations and application columns match.");
  } finally { await db.$disconnect(); }
}
async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (process.argv.includes("--force") || process.env.VERCEL_ENV === "production" || process.env.REQUIRE_DATABASE_CHECK === "true") {
    try { await checkDatabase(); }
    catch (error) {
      console.error(error.message?.startsWith("Database is not ready") || error.message?.startsWith("DATABASE_URL is required")
        ? error.message : "Database readiness check failed. Check database connectivity, permissions, and migration history; connection credentials are not logged.");
      process.exitCode = 1;
    }
  } else console.log("Production database check skipped for local/preview build. Run npm run db:check to check this database explicitly.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();
