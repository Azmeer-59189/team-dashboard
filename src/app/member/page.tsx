import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatTask } from "@/lib/format";
import { getMemberGoalProgress, getPeriodRange } from "@/lib/goals";
import TaskForm from "@/components/TaskForm";
import TaskTable from "@/components/TaskTable";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";
import StatusPieChart from "@/components/StatusPieChart";
import TrendChart from "@/components/TrendChart";

export default async function MemberDashboard() {
  const session = await getSession();
  const userId = session!.user.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const thisMonth = getPeriodRange("MONTHLY");
  const lastMonthRef = new Date(thisMonth.start);
  lastMonthRef.setUTCMonth(lastMonthRef.getUTCMonth() - 1);
  const lastMonth = getPeriodRange("MONTHLY", lastMonthRef);

  const [tasks, doneCount, pendingCount, inProgressCount, totalCount, goals, recentTasks, doneThisMonth, doneLastMonth] =
    await Promise.all([
      prisma.task.findMany({
        where: { userId },
        orderBy: { taskDate: "desc" },
        take: 10,
      }),
      prisma.task.count({ where: { userId, status: "DONE" } }),
      prisma.task.count({ where: { userId, status: "PENDING" } }),
      prisma.task.count({ where: { userId, status: "IN_PROGRESS" } }),
      prisma.task.count({ where: { userId } }),
      getMemberGoalProgress(userId, session!.user.departmentId),
      prisma.task.findMany({
        where: { userId, taskDate: { gte: thirtyDaysAgo } },
        select: { taskDate: true },
      }),
      prisma.task.count({ where: { userId, status: "DONE", taskDate: { gte: thisMonth.start, lte: thisMonth.end } } }),
      prisma.task.count({ where: { userId, status: "DONE", taskDate: { gte: lastMonth.start, lte: lastMonth.end } } }),
    ]);

  const heroTrend =
    doneLastMonth > 0
      ? {
          direction: (doneThisMonth >= doneLastMonth ? "up" : "down") as "up" | "down",
          label: `${Math.abs(Math.round(((doneThisMonth - doneLastMonth) / doneLastMonth) * 100))}% vs last month`,
        }
      : null;

  const byDate = new Map<string, number>();
  for (const t of recentTasks) {
    const key = t.taskDate.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + 1);
  }
  const trendData = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Welcome, {session!.user.name}</h1>
        <p className="text-sm text-muted">Log today's work below.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Done this month" value={doneThisMonth} trend={heroTrend} />
        <StatCard label="Total tasks logged" value={totalCount} />
        <StatCard label="Tasks done (all time)" value={doneCount} />
      </div>

      {goals.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-display font-semibold text-ink">Your KPI</h2>
          {goals.map((g) => (
            <ProgressBar
              key={g.period}
              label={g.period === "WEEKLY" ? "This week" : "This month"}
              progress={g.progress}
              target={g.target}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-display font-semibold text-ink">Your task status</h2>
          <StatusPieChart pending={pendingCount} inProgress={inProgressCount} done={doneCount} />
        </div>
        <div className="card">
          <h2 className="mb-2 font-display font-semibold text-ink">Last 30 days</h2>
          <TrendChart data={trendData} />
        </div>
      </div>

      <TaskForm />

      <div className="card">
        <h2 className="mb-3 font-display font-semibold text-ink">Recent tasks</h2>
        <TaskTable tasks={tasks.map(formatTask)} editable />
      </div>
    </div>
  );
}
