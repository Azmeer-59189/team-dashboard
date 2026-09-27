import { prisma } from "@/lib/prisma";
import { getPeriodRange } from "@/lib/goals";

// Matches the CRD spec: Core (automatic, count-based KPIs) 65% + Behavioural
// (manager-rated) 35% = Overall/100. If one half has no data, the other counts
// for 100% rather than the missing half being scored as zero.
const CORE_WEIGHT = 0.65;
const BEHAVIOURAL_WEIGHT = 0.35;

export type CompositeScore = {
  userId: string;
  corePct: number | null;
  coreGoalCount: number;
  behaviouralPct: number | null;
  behaviouralScoreCount: number;
  overall: number | null;
};

function monthLabel(date: Date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Weighted average completion % across this person's applicable CORE, MONTHLY
// KPIs (individual override wins over the department default, same rule as
// everywhere else in the app).
async function getCoreScore(userId: string, departmentId: string | null) {
  const [memberGoals, departmentGoals] = await Promise.all([
    prisma.goal.findMany({ where: { userId, period: "MONTHLY", category: "CORE" } }),
    departmentId
      ? prisma.goal.findMany({ where: { departmentId, period: "MONTHLY", category: "CORE" } })
      : Promise.resolve([]),
  ]);

  // exactly one CORE/MONTHLY goal can apply per person: their own override, or the department default
  const goal = memberGoals[0] ?? departmentGoals[0];
  if (!goal) return { pct: null, count: 0 };

  const { start, end } = getPeriodRange("MONTHLY");
  const done = await prisma.task.count({
    where: { userId, status: "DONE", taskDate: { gte: start, lte: end } },
  });
  const pct = Math.min(100, (done / goal.targetCount) * 100);
  return { pct, count: 1 };
}

async function getBehaviouralScore(userId: string, periodLabel: string) {
  const scores = await prisma.manualScore.findMany({ where: { userId, periodLabel } });
  if (scores.length === 0) return { pct: null, count: 0 };
  const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  return { pct: avg * 10, count: scores.length }; // scores are 0-10, rescale to 0-100
}

export async function getCompositeScore(
  userId: string,
  departmentId: string | null,
  reference: Date = new Date()
): Promise<CompositeScore> {
  const periodLabel = monthLabel(reference);
  const [core, behavioural] = await Promise.all([
    getCoreScore(userId, departmentId),
    getBehaviouralScore(userId, periodLabel),
  ]);

  let overall: number | null = null;
  if (core.pct !== null && behavioural.pct !== null) {
    overall = core.pct * CORE_WEIGHT + behavioural.pct * BEHAVIOURAL_WEIGHT;
  } else if (core.pct !== null) {
    overall = core.pct;
  } else if (behavioural.pct !== null) {
    overall = behavioural.pct;
  }

  return {
    userId,
    corePct: core.pct !== null ? Math.round(core.pct) : null,
    coreGoalCount: core.count,
    behaviouralPct: behavioural.pct !== null ? Math.round(behavioural.pct) : null,
    behaviouralScoreCount: behavioural.count,
    overall: overall !== null ? Math.round(overall) : null,
  };
}

export function scoreLabel(overall: number | null) {
  if (overall === null) return "No data";
  if (overall >= 80) return "Excellent";
  if (overall >= 60) return "Good";
  return "Needs improvement";
}
