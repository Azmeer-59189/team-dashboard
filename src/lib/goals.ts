import { prisma } from "@/lib/prisma";

export type Period = "WEEKLY" | "MONTHLY";

// Returns the [start, end] date range for the period containing `reference`.
// Weekly = Monday to Sunday. Monthly = 1st to last day of month.
export function getPeriodRange(period: Period, reference: Date = new Date()) {
  const ref = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));

  if (period === "MONTHLY") {
    const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    return { start, end };
  }

  // WEEKLY: Monday-start week
  const day = ref.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

export type ResolvedGoal = {
  period: Period;
  target: number;
  progress: number;
  source: "member" | "department";
  rangeStart: string;
  rangeEnd: string;
};

// For a single member: figure out their effective weekly/monthly targets
// (individual override wins over their department's default) and count
// their "done" tasks in the current window for each.
export async function getMemberGoalProgress(userId: string, departmentId: string | null): Promise<ResolvedGoal[]> {
  const [memberGoals, departmentGoals] = await Promise.all([
    prisma.goal.findMany({ where: { userId } }),
    departmentId ? prisma.goal.findMany({ where: { departmentId } }) : Promise.resolve([]),
  ]);

  const results: ResolvedGoal[] = [];

  for (const period of ["WEEKLY", "MONTHLY"] as Period[]) {
    const override = memberGoals.find((g) => g.period === period);
    const fallback = departmentGoals.find((g) => g.period === period);
    const goal = override ?? fallback;
    if (!goal) continue;

    const { start, end } = getPeriodRange(period);
    const progress = await prisma.task.count({
      where: {
        userId,
        status: "DONE",
        taskDate: { gte: start, lte: end },
      },
    });

    results.push({
      period,
      target: goal.targetCount,
      progress,
      source: override ? "member" : "department",
      rangeStart: start.toISOString().slice(0, 10),
      rangeEnd: end.toISOString().slice(0, 10),
    });
  }

  return results;
}
