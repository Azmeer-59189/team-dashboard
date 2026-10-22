import { prisma } from "./prisma";
import { getPeriodRange } from "./periods";
import { applicableGoals } from "./goalHistory";
import { resolveGoal, completionPercent } from "./scoring";
import type { Prisma } from "@prisma/client";

export type ObjectiveProgress = {
  id: string; title: string; description: string | null; departmentId: string;
  kpiAveragePct: number | null; linkedGoalCount: number;
  taskProgress: { done: number; target: number } | null; overallPct: number | null;
};

// A bounded set of grouped queries for every objective in this selection.
export async function getObjectivesProgress(where: Prisma.ObjectiveWhereInput): Promise<ObjectiveProgress[]> {
  const objectives = await prisma.objective.findMany({ where, orderBy: { createdAt: "asc" } });
  if (!objectives.length) return [];
  const members = await prisma.user.findMany({ where: {
    archivedAt: null, role: { in: ["MEMBER", "LEAD"] }, departmentId: { in: objectives.map((o) => o.departmentId) },
  }, select: { id: true, departmentId: true } });
  const { start, end } = getPeriodRange("MONTHLY");
  const [goals, doneGroups, taggedGroups] = await Promise.all([
    applicableGoals(members),
    prisma.task.groupBy({ by: ["userId"], where: { userId: { in: members.map((m) => m.id) }, cancelledAt: null, status: "DONE", reviewStatus: "APPROVED", taskDate: { gte: start, lte: end } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["objectiveId"], where: { objectiveId: { in: objectives.map((o) => o.id) }, cancelledAt: null, status: "DONE", reviewStatus: "APPROVED", taskDate: { gte: start, lte: end } }, _count: { _all: true } }),
  ]);
  const done = new Map(doneGroups.map((g) => [g.userId, g._count._all]));
  const tagged = new Map(taggedGroups.map((g) => [g.objectiveId, g._count._all]));
  const byGoal = new Map<string, number[]>();
  for (const member of members) {
    const goal = resolveGoal(goals, member.id, member.departmentId, "MONTHLY");
    if (!goal?.objectiveId) continue;
    const pct = completionPercent(done.get(member.id) ?? 0, goal.targetCount);
    if (pct === null) continue;
    byGoal.set(goal.goalId, [...(byGoal.get(goal.goalId) ?? []), pct]);
  }
  const average = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return objectives.map((objective) => {
    const linked = goals.filter((g) => g.period === "MONTHLY" && g.objectiveId === objective.id);
    const pcts = linked.map((g) => average(byGoal.get(g.goalId) ?? [])).filter((p): p is number => p !== null);
    const kpiAveragePct = average(pcts);
    const taskProgress = objective.targetTaskCount ? { done: tagged.get(objective.id) ?? 0, target: objective.targetTaskCount } : null;
    const taskPct = taskProgress ? completionPercent(taskProgress.done, taskProgress.target) : null;
    const overallPct = average([kpiAveragePct, taskPct].filter((p): p is number => p !== null));
    return { id: objective.id, title: objective.title, description: objective.description, departmentId: objective.departmentId,
      kpiAveragePct, linkedGoalCount: linked.length, taskProgress, overallPct };
  });
}
export async function getObjectiveProgress(objectiveId: string): Promise<ObjectiveProgress | null> {
  return (await getObjectivesProgress({ id: objectiveId }))[0] ?? null;
}
export async function getDepartmentObjectivesProgress(departmentId: string): Promise<ObjectiveProgress[]> {
  return getObjectivesProgress({ departmentId });
}
