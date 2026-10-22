import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getPeriodRange } from "./periods";
import { monthLabel, todayInTimeZone } from "./dates";
import { applicableGoals } from "./goalHistory";
import { resolveGoal, completionPercent, combineScores } from "./scoring";
import { assignmentsAt } from "./assignments";

export type CompositeScore = {
  userId: string; corePct: number | null; coreGoalCount: number;
  behaviouralPct: number | null; behaviouralScoreCount: number; overall: number | null;
};
const rounded = (value: number | null) => value === null ? null : Math.round(value);
export async function getCompositeScores(members: { id: string; departmentId: string | null }[], reference = todayInTimeZone(), db: Prisma.TransactionClient = prisma) {
  const result = new Map<string, CompositeScore>();
  if (!members.length) return result;
  const periodLabel = monthLabel(reference);
  const closed = await db.monthlyReport.findUnique({ where: { periodLabel } });
  if (closed) {
    const rows = closed.rows as unknown as { member: { id: string }; score: CompositeScore }[];
    for (const member of members) result.set(member.id, rows.find((r) => r.member.id === member.id)?.score ?? {
      userId: member.id, corePct: null, coreGoalCount: 0, behaviouralPct: null, behaviouralScoreCount: 0, overall: null,
    });
    return result;
  }
  const userId = { in: members.map((m) => m.id) };
  members = await assignmentsAt(members, reference, db);
  const { start, end } = getPeriodRange("MONTHLY", reference);
  const [goals, counts, ratings] = await Promise.all([
    applicableGoals(members, reference, db),
    db.task.groupBy({ by: ["userId"], where: { userId, cancelledAt: null, status: "DONE", reviewStatus: "APPROVED", taskDate: { gte: start, lte: end } }, _count: { _all: true } }),
    db.manualScore.groupBy({ by: ["userId"], where: { userId, periodLabel, supersededAt: null }, _avg: { score: true }, _count: { _all: true } }),
  ]);
  const done = new Map(counts.map((c) => [c.userId, c._count._all]));
  const assessments = new Map(ratings.map((r) => [r.userId, r]));
  for (const member of members) {
    const goal = resolveGoal(goals, member.id, member.departmentId, "MONTHLY");
    const core = goal?.category === "CORE" ? completionPercent(done.get(member.id) ?? 0, goal.targetCount) : null;
    const rating = assessments.get(member.id);
    const behavioural = rating?._avg.score != null ? rating._avg.score * 10 : null;
    result.set(member.id, { userId: member.id, corePct: rounded(core), coreGoalCount: core === null ? 0 : 1,
      behaviouralPct: rounded(behavioural), behaviouralScoreCount: rating?._count._all ?? 0,
      overall: rounded(combineScores(core, behavioural)) });
  }
  return result;
}
export async function getCompositeScore(userId: string, departmentId: string | null, reference = todayInTimeZone()): Promise<CompositeScore> {
  return (await getCompositeScores([{ id: userId, departmentId }], reference)).get(userId)!;
}
export function scoreLabel(overall: number | null) {
  return overall === null ? "No data" : overall >= 80 ? "Excellent" : overall >= 60 ? "Good" : "Needs improvement";
}
