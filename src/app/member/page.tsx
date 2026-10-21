import PageHeader from "@/components/PageHeader";
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
import { Icon } from "@/components/icons";
import Link from "next/link";

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

  const periodLabel = (p: string) => (p === "WEEKLY" ? "This week" : p === "ANNUAL" ? "This year" : "This month");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My dashboard"
        title={<>Welcome back, {session!.user.name?.split(" ")[0]}</>}
        description="Log today's work and keep an eye on your goals."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard hero label="Tasks done this month" value={doneThisMonth} trend={heroTrend} hint={`${doneLastMonth} last month`} />
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard tone="violet" icon="list" label="Total tasks logged" value={totalCount} />
          <StatCard tone="mint" label="Done (all time)" value={doneCount} />
          <StatCard tone="sand" label="Pending" value={pendingCount} />
          <StatCard tone="sky" label="In progress" value={inProgressCount} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TaskForm />
        </div>
        <div className="card space-y-5 lg:col-span-2">
          <div>
            <h2 className="card-title">Your KPI goals</h2>
            <p className="card-subtitle">Done tasks against your targets</p>
          </div>
          {goals.length > 0 ? (
            goals.map((g) => (
              <ProgressBar key={g.period} label={periodLabel(g.period)} progress={g.progress} target={g.target} />
            ))
          ) : (
            <p className="text-sm text-muted">No goals have been set for you yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <h2 className="card-title mb-5">Your task status</h2>
          <StatusPieChart pending={pendingCount} inProgress={inProgressCount} done={doneCount} />
        </div>
        <div className="card lg:col-span-3">
          <h2 className="card-title">Last 30 days</h2>
          <p className="card-subtitle mb-5">Tasks logged per day</p>
          <TrendChart data={trendData} />
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="card-title">Recent tasks</h2>
          <Link href="/member/tasks" className="btn-ghost">
            View all <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <TaskTable tasks={tasks.map(formatTask)} editable />
      </div>
    </div>
  );
}
