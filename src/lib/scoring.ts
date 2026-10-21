import type { Period } from "./periods";

export type GoalValue = { userId: string | null; departmentId: string | null; period: Period; category: string; targetCount: number };
// Resolve the individual override BEFORE selecting a category.
export function resolveGoal<T extends GoalValue>(goals: T[], userId: string, departmentId: string | null, period: Period): T | undefined {
  return goals.find((g) => g.userId === userId && g.period === period)
    ?? (departmentId ? goals.find((g) => !g.userId && g.departmentId === departmentId && g.period === period) : undefined);
}
export function completionPercent(done: number, target: number) {
  if (!Number.isFinite(target) || target <= 0) return null;
  return Math.max(0, Math.min(100, done / target * 100));
}
export function combineScores(core: number | null, behavioural: number | null) {
  if (core === null) return behavioural;
  if (behavioural === null) return core;
  return core * 0.65 + behavioural * 0.35;
}
export function currentRevisions<T extends GoalValue & { effectiveFrom: Date; retired: boolean; createdAt: Date }>(revisions: T[], reference: Date) {
  const latest = new Map<string, T>();
  for (const row of [...revisions].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.createdAt.getTime() - a.createdAt.getTime())) {
    if (row.effectiveFrom > reference) continue;
    const key = JSON.stringify([row.userId, row.departmentId, row.period]);
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].filter((row) => !row.retired);
}
