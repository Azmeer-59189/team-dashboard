import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { assertAssignmentAvailable } from "../src/lib/leave";
import type { Prisma } from "@prisma/client";

test("leave migration enforces evidence and availability uses inclusive approved dates only", async () => {
  const db = await PGlite.create();
  try {
    for (const name of (await readdir("prisma/migrations")).sort()) {
      if (/^\d/.test(name)) await db.exec(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    }
    await db.exec(`INSERT INTO "User" ("id","fullName","email","passwordHash") VALUES ('m','Member','leave@example.test','hash');
      INSERT INTO "LeaveRequest" ("id","userId","startDate","endDate","reason","updatedAt") VALUES ('l','m','2026-12-01','2026-12-03','Personal',now());`);
    const tx = { leaveRequest: { findFirst: async ({ where }: any) => (await db.query('SELECT "id" FROM "LeaveRequest" WHERE "userId"=$1 AND "status"=$2 AND "startDate"<=$3 AND "endDate">=$4', [where.userId, where.status, where.startDate.lte, where.endDate.gte])).rows[0] ?? null } } as unknown as Prisma.TransactionClient;
    await assertAssignmentAvailable(tx, "m", new Date("2026-12-01"), new Date("2026-12-03"));
    await assert.rejects(db.exec(`UPDATE "LeaveRequest" SET "status"='APPROVED' WHERE "id"='l'`), /constraint/);
    await assert.rejects(db.exec(`UPDATE "LeaveRequest" SET "status"='APPROVED',"reviewedById"='m',"reviewedAt"=now() WHERE "id"='l'`), /constraint/);
    await assert.rejects(db.exec(`UPDATE "LeaveRequest" SET "endDate"='2026-11-30' WHERE "id"='l'`), /constraint/);
    await assert.rejects(db.exec(`UPDATE "LeaveRequest" SET "status"='REJECTED',"reviewedById"='lead',"reviewedAt"=now() WHERE "id"='l'`), /constraint/);
    await db.exec(`UPDATE "LeaveRequest" SET "status"='APPROVED',"reviewedById"='lead',"reviewedAt"=now() WHERE "id"='l'`);
    for (const [start, end] of [["2026-11-20", "2026-12-01"], ["2026-12-03", "2026-12-08"], ["2026-12-02", "2026-12-02"]]) {
      await assert.rejects(assertAssignmentAvailable(tx, "m", new Date(start), new Date(end)), /approved leave/);
    }
    await assertAssignmentAvailable(tx, "m", new Date("2026-12-04"), new Date("2026-12-05"));
    await assertAssignmentAvailable(tx, "different", new Date("2026-12-01"), new Date("2026-12-03"));
    await assert.rejects(db.exec(`UPDATE "LeaveRequest" SET "status"='CANCELLED' WHERE "id"='l'`), /constraint/);
    await db.exec(`UPDATE "LeaveRequest" SET "status"='CANCELLED',"cancelledAt"=now() WHERE "id"='l'`);
    await assertAssignmentAvailable(tx, "m", new Date("2026-12-01"), new Date("2026-12-03"));
  } finally { await db.close(); }
});
