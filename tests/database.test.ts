import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { allowLogin } from "../src/lib/loginThrottle";

test("PostgreSQL migration and data-integrity regression checks", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("prisma/migrations/20261021000000_baseline/migration.sql", "utf8"));
    // Start with populated pre-upgrade tables, not just an empty database.
    await db.exec(`
      INSERT INTO "Department" ("id", "name") VALUES ('design','Design');
      INSERT INTO "User" ("id","fullName","email","passwordHash","departmentId") VALUES
        ('member','Member','Member@Example.com','hash','design'), ('reviewer','Reviewer','reviewer@example.com','hash','design');
      INSERT INTO "Goal" ("id","departmentId","period","targetCount","updatedAt") VALUES ('goal','design','MONTHLY',20,now());
      INSERT INTO "ManualScore" ("id","userId","scorerId","scorerName","competency","score","periodLabel","createdAt") VALUES
        ('old','member','reviewer','Reviewer','Teamwork',4,'2026-10','2026-10-01'),
        ('latest','member','reviewer','Reviewer',' teamwork ',8,'2026-10','2026-10-02');
      INSERT INTO "Task" ("id","userId","departmentId","type","content","taskDate","status","updatedAt") VALUES
        ('task','member','design','TEXT','Existing work','2026-10-10','DONE',now());
    `);
    await db.exec(await readFile("prisma/migrations/20261021010000_backend_integrity/migration.sql", "utf8"));

    await t.test("populated migration retains assessments and creates a goal-history baseline", async () => {
      const ratings = await db.query<{ id: string; supersededAt: Date | null }>('SELECT "id", "supersededAt" FROM "ManualScore" ORDER BY "id"');
      assert.equal(ratings.rows.length, 2);
      assert.equal(ratings.rows.find((r) => r.id === "latest")?.supersededAt, null);
      assert.ok(ratings.rows.find((r) => r.id === "old")?.supersededAt);
      assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "GoalRevision"')).rows[0].count, 1);
      const task = (await db.query<{ completedAt: Date | null; version: number }>('SELECT "completedAt", "version" FROM "Task"')).rows[0];
      assert.equal(task.completedAt, null, "unknown legacy completion times must stay unknown");
      assert.equal(task.version, 0);
    });

    await t.test("database rejects equivalent emails regardless of casing", async () => {
      await assert.rejects(db.exec(`INSERT INTO "User" ("id","fullName","email","passwordHash") VALUES ('duplicate','Duplicate',' MEMBER@example.com ','hash')`), /unique/i);
    });
    await t.test("database rejects goals with no owner, two owners, or nonpositive targets", async () => {
      await assert.rejects(db.exec(`INSERT INTO "Goal" ("id","period","targetCount","updatedAt") VALUES ('none','WEEKLY',10,now())`), /check constraint/i);
      await assert.rejects(db.exec(`INSERT INTO "Goal" ("id","userId","departmentId","period","targetCount","updatedAt") VALUES ('both','member','design','WEEKLY',10,now())`), /check constraint/i);
      await assert.rejects(db.exec(`UPDATE "Goal" SET "targetCount" = 0 WHERE "id" = 'goal'`), /check constraint/i);
    });
    await t.test("invalid rating values and months fail at the database boundary", async () => {
      await assert.rejects(db.exec(`UPDATE "ManualScore" SET "score" = 11 WHERE "id" = 'latest'`), /check constraint/i);
      await assert.rejects(db.exec(`UPDATE "ManualScore" SET "periodLabel" = '2026-99' WHERE "id" = 'latest'`), /check constraint/i);
    });
    await t.test("rating identity cannot be duplicated", async () => {
      await db.exec(`UPDATE "ManualScore" SET "ratingKey" = 'unique-review' WHERE "id" = 'latest'`);
      await assert.rejects(db.exec(`UPDATE "ManualScore" SET "ratingKey" = 'unique-review' WHERE "id" = 'old'`), /unique/i);
    });
    await t.test("archiving retains task and score history and increments session version", async () => {
      await db.exec(`UPDATE "User" SET "archivedAt" = now(), "authVersion" = "authVersion" + 1 WHERE "id" = 'member'`);
      assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "Task"')).rows[0].count, 1);
      assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "ManualScore"')).rows[0].count, 2);
      assert.equal((await db.query<{ authVersion: number }>(`SELECT "authVersion" FROM "User" WHERE "id" = 'member'`)).rows[0].authVersion, 1);
    });
    await t.test("a failed audit write rolls back the business change in the same transaction", async () => {
      await assert.rejects(db.transaction(async (tx) => {
        await tx.exec(`UPDATE "Task" SET "content" = 'Should roll back' WHERE "id" = 'task'`);
        await tx.exec(`INSERT INTO "AuditLog" ("id", "actorName", "action") VALUES ('bad-audit','Reviewer','task.update')`);
      }));
      assert.equal((await db.query<{ content: string }>('SELECT "content" FROM "Task"')).rows[0].content, "Existing work");
    });
    await t.test("login throttle shares an atomic account counter and expires", async () => {
      const adapter = {
        loginAttempt: { deleteMany: async () => ({ count: 0 }) },
        $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
          const sql = parts.reduce((s, part, index) => s + (index ? `$${index}` : "") + part, "");
          return (await db.query(sql, values)).rows;
        },
      } as unknown as Parameters<typeof allowLogin>[1];
      const allowed = await Promise.all(Array.from({ length: 12 }, (_, index) => allowLogin(index % 2 ? " Ali@Example.com " : "ali@example.com", adapter)));
      assert.equal(allowed.filter(Boolean).length, 10);
      assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "LoginAttempt"')).rows[0].count, 1);
      await db.exec(`UPDATE "LoginAttempt" SET "expiresAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - interval '1 minute'`);
      assert.equal(await allowLogin("ali@example.com", adapter), true);
    });
  } finally { await db.close(); }
});
