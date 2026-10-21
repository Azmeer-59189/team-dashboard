import { prisma } from "./prisma";
import { getPeriodRange, type Period } from "./periods";
import { todayInTimeZone } from "./dates";
import { applicableGoals } from "./goalHistory";
import { resolveGoal } from "./scoring";
import { assignmentsAt } from "./assignments";
export { getPeriodRange, type Period } from "./periods";

export type ResolvedGoal = {
  period: Period; target: number; progress: number; source: "member" | "department";
  rangeStart: string; rangeEnd: string;
};
export async function getMembersGoalProgress(members: { id: string; departmentId: string | null }[], reference = todayInTimeZone()) {
  const result = new Map<string, ResolvedGoal[]>(members.map((m) => [m.id, []]));
  if (!members.length) return result;
  members = await assignmentsAt(members, reference);
  const goals = await applicableGoals(members, reference);
  await Promise.all((["WEEKLY", "MONTHLY", "ANNUAL"] as Period[]).map(async (period) => {
    const { start, end } = getPeriodRange(period, reference);
    const counts = await prisma.task.groupBy({ by: ["userId"], where: {
      userId: { in: members.map((m) => m.id) }, status: "DONE", taskDate: { gte: start, lte: end },
    }, _count: { _all: true } });
    const byUser = new Map(counts.map((c) => [c.userId, c._count._all]));
    for (const member of members) {
      const goal = resolveGoal(goals, member.id, member.departmentId, period);
      if (!goal) continue;
      result.get(member.id)!.push({ period, target: goal.targetCount, progress: byUser.get(member.id) ?? 0,
        source: goal.userId ? "member" : "department", rangeStart: start.toISOString().slice(0, 10), rangeEnd: end.toISOString().slice(0, 10) });
    }
  }));
  const order = ["WEEKLY", "MONTHLY", "ANNUAL"];
  for (const rows of result.values()) rows.sort((a, b) => order.indexOf(a.period) - order.indexOf(b.period));
  return result;
}
export async function getMemberGoalProgress(userId: string, departmentId: string | null): Promise<ResolvedGoal[]> {
  return (await getMembersGoalProgress([{ id: userId, departmentId }])).get(userId) ?? [];
}
