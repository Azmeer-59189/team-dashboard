import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite, type PGliteInterface } from "@electric-sql/pglite";
import type { Prisma } from "@prisma/client";
import { applyTaskAction } from "../src/lib/taskWorkflowService";

// Bridge the small transaction surface used by the real workflow service to the
// PostgreSQL test engine. Permission and state-transition logic is not mocked.
function adapter(sql: Pick<PGliteInterface, "query">) {
  const findUser = async (id: string) => (await sql.query<any>('SELECT * FROM "User" WHERE "id"=$1', [id])).rows[0] ?? null;
  const findTask = async (id: string) => {
    const task = (await sql.query<any>('SELECT * FROM "Task" WHERE "id"=$1', [id])).rows[0];
    return task ? { ...task, taskDate: task.taskDate instanceof Date ? task.taskDate : new Date(`${String(task.taskDate).slice(0, 10)}T00:00:00Z`), user: await findUser(task.userId) } : null;
  };
  return {
    user: { findUnique: ({ where }: any) => findUser(where.id) },
    task: {
      findUnique: ({ where }: any) => findTask(where.id),
      update: async ({ where, data }: any) => {
        const columns = Object.keys(data);
        const values: unknown[] = [];
        const setters = columns.map((column) => {
          if (column === "version") return '"version"="version"+1';
          values.push(data[column]);
          return `"${column}"=$${values.length}`;
        });
        values.push(where.id);
        await sql.query(`UPDATE "Task" SET ${setters.join(",")} WHERE "id"=$${values.length}`, values);
        const task = await findTask(where.id);
        delete task.user;
        return task;
      },
    },
    monthlyReport: { findFirst: async ({ where }: any) => (await sql.query('SELECT "periodLabel" FROM "MonthlyReport" WHERE "periodLabel"=ANY($1::text[]) LIMIT 1', [where.periodLabel.in])).rows[0] ?? null },
    auditLog: { create: async ({ data }: any) => {
      await sql.query('INSERT INTO "AuditLog" ("id","actorId","actorName","action","targetId","targetLabel","details") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',
        [randomUUID(), data.actorId, data.actorName, data.action, data.targetId, data.targetLabel, JSON.stringify(data.details)]);
      return data;
    } },
  } as unknown as Prisma.TransactionClient;
}

test("assignment review lifecycle against PostgreSQL", async (t) => {
  const db = new PGlite();
  try {
    for (const name of ["20261021000000_baseline", "20261021010000_backend_integrity"]) await db.exec(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    await db.exec(`INSERT INTO "Department" ("id","name") VALUES ('design','Design'),('other','Other');
      INSERT INTO "User" ("id","fullName","email","passwordHash","role","departmentId") VALUES
      ('member','Member','m@example.com','hash','MEMBER','design'),
      ('lead','Lead','l@example.com','hash','LEAD','design'),
      ('outsider','Outsider','o@example.com','hash','LEAD','other'),
      ('admin','Admin','a@example.com','hash','ADMIN',NULL);
      INSERT INTO "Task" ("id","userId","departmentId","type","content","taskDate","status","updatedAt") VALUES
      ('legacy','member','design','TEXT','Legacy completed work','2026-10-01','DONE',now());`);
    // Reproduce the live schema drift: identity columns and assignments existed
    // before the review workflow, without its timestamp/deadline requirements.
    await db.exec(`ALTER TABLE "Task" ADD COLUMN "assignedById" TEXT, ADD COLUMN "assignedByName" TEXT;
      UPDATE "Task" SET "assignedById"='lead', "assignedByName"='Original lead' WHERE "id"='legacy';`);
    await db.exec(await readFile("prisma/migrations/20261022000000_task_assignments_reviews/migration.sql", "utf8"));
    await db.exec(`INSERT INTO "Task" ("id","userId","departmentId","type","content","taskDate","dueDate","assignedById","assignedByName","assignedAt","updatedAt") VALUES
      ('assigned','member','design','TEXT','Deliver a report','2026-10-22','2026-10-25','lead','Lead',now(),now());`);
    const act = (actor: string, action: Parameters<typeof applyTaskAction>[3], version: number, note = "") => db.transaction((tx) => applyTaskAction(adapter(tx), actor, "assigned", action, version, note));
    const countCredits = async () => (await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM "Task" WHERE "id"='assigned' AND "status"='DONE' AND "reviewStatus"='APPROVED'`)).rows[0].count;

    await t.test("migration preserves old completion credits without inventing a reviewer", async () => {
      const row = (await db.query<any>(`SELECT * FROM "Task" WHERE "id"='legacy'`)).rows[0];
      assert.equal(row.reviewStatus, "APPROVED"); assert.equal(row.legacyApproved, true); assert.equal(row.reviewedById, null);
      assert.equal(row.assignedById, "lead"); assert.equal(row.assignedByName, "Original lead");
      assert.equal(row.legacyAssigned, true); assert.equal(row.assignedAt, null); assert.equal(row.dueDate, null);
    });
    await t.test("an owner starts and submits; awaiting review has no KPI credit", async () => {
      await act("member", "start", 0);
      const saved = await act("member", "submit", 1, "Completed report: https://example.com/report");
      assert.equal(saved.reviewStatus, "SUBMITTED"); assert.equal(saved.status, "IN_PROGRESS");
      assert.equal(await countCredits(), 0);
    });
    await t.test("self approval and cross-department review are rejected without audit writes", async () => {
      const before = (await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "AuditLog"')).rows[0].count;
      await assert.rejects(act("member", "approve", 2), /cannot review/);
      await assert.rejects(act("outsider", "approve", 2), /cannot review/);
      const after = (await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "AuditLog"')).rows[0].count;
      assert.equal(after, before);
    });
    await t.test("feedback, resubmission and approval retain the full activity trail", async () => {
      await act("lead", "request_changes", 2, "Add the missing references");
      const saved = await act("member", "submit", 3, "Updated report with references");
      assert.equal(saved.reviewStatus, "SUBMITTED");
      const approved = await act("lead", "approve", 4, "Approved with references");
      assert.equal(approved.reviewedById, "lead"); assert.equal(approved.status, "DONE");
      assert.equal(await countCredits(), 1);
      const events = (await db.query<{ action: string }>('SELECT "action" FROM "AuditLog" WHERE "targetId"=$1', ["assigned"])).rows;
      assert.equal(events.length, 5);
      assert.ok(events.some((e) => e.action === "task.request_changes"));
    });
    await t.test("stale actions and duplicate approval do not change the task", async () => {
      await assert.rejects(act("member", "reopen", 4, "Correct a mistake"), /changed/);
      await assert.rejects(act("lead", "approve", 5), /Only submitted/);
      assert.equal(await countCredits(), 1);
    });
    await t.test("reopening removes credit until another approval", async () => {
      await act("member", "reopen", 5, "Correct an outdated link");
      assert.equal(await countCredits(), 0);
      await act("member", "submit", 6, "Report with corrected link");
    });
    await t.test("finalized months block reviews and preserve the submission", async () => {
      await db.exec(`INSERT INTO "MonthlyReport" ("periodLabel","finalizedBy","rows") VALUES ('2026-10','admin','[]')`);
      await assert.rejects(act("lead", "approve", 7), /finalized/);
      assert.equal((await db.query<any>(`SELECT "reviewStatus" FROM "Task" WHERE "id"='assigned'`)).rows[0].reviewStatus, "SUBMITTED");
      await db.exec(`DELETE FROM "MonthlyReport" WHERE "periodLabel"='2026-10'`);
    });
    await t.test("database constraints reject direct DONE, self review and missing submission evidence", async () => {
      await assert.rejects(db.exec(`UPDATE "Task" SET "status"='DONE' WHERE "id"='assigned'`), /check constraint/i);
      await assert.rejects(db.exec(`UPDATE "Task" SET "status"='DONE',"reviewStatus"='APPROVED',"reviewedById"='member',"reviewedAt"=now() WHERE "id"='assigned'`), /check constraint/i);
      await assert.rejects(db.exec(`UPDATE "Task" SET "submissionText"=NULL WHERE "id"='assigned'`), /check constraint/i);
    });
  } finally { await db.close(); }
});
