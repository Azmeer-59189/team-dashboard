import type { Goal, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getPeriodRange } from "./periods";
import { todayInTimeZone } from "./dates";
import { currentRevisions } from "./scoring";

export async function recordGoal(tx: Prisma.TransactionClient, goal: Goal, effectiveFrom = getPeriodRange(goal.period).start, retired = false) {
  const { id: goalId, departmentId, userId, objectiveId, period, targetCount, category, weight } = goal;
  const data = { goalId, departmentId, userId, objectiveId, period, targetCount, category, weight, effectiveFrom, retired };
  return tx.goalRevision.upsert({ where: { goalId_effectiveFrom: { goalId, effectiveFrom } }, create: data, update: data });
}
export async function applicableGoals(members: { id: string; departmentId: string | null }[], reference = todayInTimeZone(), db: Prisma.TransactionClient = prisma) {
  if (!members.length) return [];
  const revisions = await db.goalRevision.findMany({ where: {
    effectiveFrom: { lte: reference },
    OR: [{ userId: { in: members.map((m) => m.id) } },
      { departmentId: { in: members.flatMap((m) => m.departmentId ? [m.departmentId] : []) } }],
  } });
  return currentRevisions(revisions, reference);
}
