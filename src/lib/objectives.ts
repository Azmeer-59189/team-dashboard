import { prisma } from "@/lib/prisma";
import { getPeriodRange } from "@/lib/goals";

export type ObjectiveProgress = {
  id: string;
  title: string;
  description: string | null;
  departmentId: string;
  kpiAveragePct: number | null; // average completion % across linked KPIs this month
  linkedGoalCount: number;
  taskProgress: { done: number; target: number } | null; // directly-tagged tasks, if a target was set
  overallPct: number | null; // combined headline number
};

// Progress of a single monthly Goal (department-default or individual override),
// expressed as a percentage. Department-default goals are averaged across every
// member of that department who doesn't have their own override for this period.
async function goalCompletionPct(goal: { id: string; departmentId: string | null; userId: string | null; targetCount: number }) {
  const { start, end } = getPeriodRange("MONTHLY");

  if (goal.userId) {
    const done = await prisma.task.count({
      where: { userId: goal.userId, status: "DONE", taskDate: { gte: start, lte: end } },
    });
    return Math.min(100, Math.round((done / goal.targetCount) * 100));
  }

  if (goal.departmentId) {
    const members = await prisma.user.findMany({
      where: { departmentId: goal.departmentId, role: { in: ["MEMBER", "LEAD"] } },
      select: { id: true },
    });
    if (members.length === 0) return null;

    // members with their own individual override for this period are excluded,
    // since the department default doesn't apply to them
    const overrides = await prisma.goal.findMany({
      where: { userId: { in: members.map((m) => m.id) }, period: "MONTHLY" },
      select: { userId: true },
    });
    const overriddenIds = new Set(overrides.map((o) => o.userId));
    const applicable = members.filter((m) => !overriddenIds.has(m.id));
    if (applicable.length === 0) return null;

    const pcts = await Promise.all(
      applicable.map(async (m) => {
        const done = await prisma.task.count({
          where: { userId: m.id, status: "DONE", taskDate: { gte: start, lte: end } },
        });
        return Math.min(100, (done / goal.targetCount) * 100);
      })
    );
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  return null;
}

export async function getObjectiveProgress(objectiveId: string): Promise<ObjectiveProgress | null> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: { goals: true },
  });
  if (!objective) return null;

  const monthlyGoals = objective.goals.filter((g) => g.period === "MONTHLY");
  const pcts = (
    await Promise.all(monthlyGoals.map((g) => goalCompletionPct(g)))
  ).filter((p): p is number => p !== null);
  const kpiAveragePct = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;

  let taskProgress: { done: number; target: number } | null = null;
  if (objective.targetTaskCount) {
    const { start, end } = getPeriodRange("MONTHLY");
    const done = await prisma.task.count({
      where: { objectiveId: objective.id, status: "DONE", taskDate: { gte: start, lte: end } },
    });
    taskProgress = { done, target: objective.targetTaskCount };
  }

  const taskPct = taskProgress ? Math.min(100, Math.round((taskProgress.done / taskProgress.target) * 100)) : null;
  const parts = [kpiAveragePct, taskPct].filter((p): p is number => p !== null);
  const overallPct = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  return {
    id: objective.id,
    title: objective.title,
    description: objective.description,
    departmentId: objective.departmentId,
    kpiAveragePct,
    linkedGoalCount: monthlyGoals.length,
    taskProgress,
    overallPct,
  };
}

export async function getDepartmentObjectivesProgress(departmentId: string): Promise<ObjectiveProgress[]> {
  const objectives = await prisma.objective.findMany({
    where: { departmentId },
    orderBy: { createdAt: "asc" },
  });
  const results = await Promise.all(objectives.map((o) => getObjectiveProgress(o.id)));
  return results.filter((r): r is ObjectiveProgress => r !== null);
}
