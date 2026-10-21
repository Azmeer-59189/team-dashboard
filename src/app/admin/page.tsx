import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { formatTask, statusToDb } from "@/lib/format";
import { getPeriodRange } from "@/lib/goals";
import StatCard from "@/components/StatCard";
import FilterBar from "@/components/FilterBar";
import TaskTable from "@/components/TaskTable";
import StatusPieChart from "@/components/StatusPieChart";
import ComparisonBarChart from "@/components/ComparisonBarChart";
import TrendChart from "@/components/TrendChart";

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: { department?: string; member?: string; status?: string; from?: string; to?: string };
}) {
  const session = await getSession();
  const scope = getScope(session!);

  // Hero stat: tasks done this month vs last month, org-wide (or dept-wide for a lead).
  // Deliberately independent of the filter bar below - this is the one headline number,
  // the filtered stats/charts further down are the detail view.
  const heroWhere: any = { status: "DONE" };
  if (scope.isLead) heroWhere.departmentId = scope.departmentId;
  const thisMonth = getPeriodRange("MONTHLY");
  const lastMonthRef = new Date(thisMonth.start);
  lastMonthRef.setUTCMonth(lastMonthRef.getUTCMonth() - 1);
  const lastMonth = getPeriodRange("MONTHLY", lastMonthRef);
  const [doneThisMonth, doneLastMonth] = await Promise.all([
    prisma.task.count({ where: { ...heroWhere, taskDate: { gte: thisMonth.start, lte: thisMonth.end } } }),
    prisma.task.count({ where: { ...heroWhere, taskDate: { gte: lastMonth.start, lte: lastMonth.end } } }),
  ]);
  const heroTrend =
    doneLastMonth > 0
      ? {
          direction: (doneThisMonth >= doneLastMonth ? "up" : "down") as "up" | "down",
          label: `${Math.abs(Math.round(((doneThisMonth - doneLastMonth) / doneLastMonth) * 100))}% vs last month`,
        }
      : null;

  const [departments, members] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["MEMBER", "LEAD"] }, ...(scope.isLead ? { departmentId: scope.departmentId } : {}) },
      select: { id: true, fullName: true, departmentId: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  // build the filter, forcing a lead's own department regardless of URL params
  const where: any = {};
  if (scope.isLead) where.departmentId = scope.departmentId;
  else if (searchParams.department) where.departmentId = searchParams.department;

  if (searchParams.member) where.userId = searchParams.member;
  if (searchParams.status) where.status = statusToDb(searchParams.status);
  if (searchParams.from || searchParams.to) {
    where.taskDate = {};
    if (searchParams.from) where.taskDate.gte = new Date(searchParams.from);
    if (searchParams.to) where.taskDate.lte = new Date(searchParams.to);
  }

  // Aggregate in PostgreSQL so charts include every matching task.
  const groups = await prisma.task.groupBy({
    by: ["status", "taskDate", "departmentId", "userId"],
    where,
    _count: { _all: true },
  });
  const chartUsers = await prisma.user.findMany({
    where: { id: { in: [...new Set(groups.map((g) => g.userId))] } },
    select: { id: true, fullName: true },
  });
  const userNames = new Map(chartUsers.map((u) => [u.id, u.fullName]));
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));
  const chartTasks = groups.map((g) => ({
    ...g,
    count: g._count._all,
    user: { fullName: userNames.get(g.userId) ?? "Unknown member" },
    department: g.departmentId ? { name: departmentNames.get(g.departmentId) ?? "Unknown department" } : null,
  }));

  const tasks = await prisma.task.findMany({
    where,
    include: { user: { select: { fullName: true } }, department: { select: { name: true } } },
    orderBy: { taskDate: "desc" },
    take: 50,
  });

  const total = chartTasks.reduce((sum, t) => sum + t.count, 0);
  const done = chartTasks.filter((t) => t.status === "DONE").reduce((sum, t) => sum + t.count, 0);
  const inProgress = chartTasks.filter((t) => t.status === "IN_PROGRESS").reduce((sum, t) => sum + t.count, 0);
  const pending = chartTasks.filter((t) => t.status === "PENDING").reduce((sum, t) => sum + t.count, 0);

  const [memberCount, deptCount] = await Promise.all([
    prisma.user.count({ where: { role: "MEMBER", ...(scope.isLead ? { departmentId: scope.departmentId } : {}) } }),
    scope.isLead ? Promise.resolve(1) : prisma.department.count(),
  ]);

  // Adaptive second chart: single member selected -> daily trend for them;
  // a department is the active scope (selected, or lead's own) with no member -> compare members within it;
  // otherwise (default, all departments) -> compare across departments.
  let chartMode: "trend" | "byMember" | "byDepartment" = "byDepartment";
  if (searchParams.member) chartMode = "trend";
  else if (where.departmentId) chartMode = "byMember";

  let trendData: { date: string; value: number }[] = [];
  let barData: { name: string; value: number }[] = [];

  if (chartMode === "trend") {
    const byDate = new Map<string, number>();
    for (const t of chartTasks) {
      const key = t.taskDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + t.count);
    }
    trendData = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  } else if (chartMode === "byMember") {
    const byMember = new Map<string, number>();
    for (const t of chartTasks) {
      const key = t.user.fullName;
      byMember.set(key, (byMember.get(key) ?? 0) + t.count);
    }
    barData = Array.from(byMember.entries()).map(([name, value]) => ({ name, value }));
  } else {
    const byDept = new Map<string, number>();
    for (const t of chartTasks) {
      const key = t.department?.name ?? "No department";
      byDept.set(key, (byDept.get(key) ?? 0) + t.count);
    }
    barData = Array.from(byDept.entries()).map(([name, value]) => ({ name, value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-1">
        <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-500">Your workspace</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Team overview</h1>
        <p className="mt-2 text-sm text-muted">
          {scope.isLead ? "Your department's performance at a glance." : "Team-wide performance at a glance."}
        </p>
        </div>
        <a href="/admin/my-tasks" className="btn-primary gap-2"><span aria-hidden="true">+</span> Log a task</a>
      </div>

      <StatCard
        hero
        label={scope.isLead ? "Your department's tasks done this month" : "Tasks done this month, org-wide"}
        value={doneThisMonth}
        trend={heroTrend}
      />

      <FilterBar
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        members={members.map((m) => ({ id: m.id, label: m.fullName, departmentId: m.departmentId }))}
        hideDepartment={scope.isLead}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard tone="blush" label="Members" value={memberCount} />
        {!scope.isLead && <StatCard tone="sky" label="Departments" value={deptCount} />}
        <StatCard label="Tasks (filtered)" value={total} />
        <StatCard tone="sand" label="Pending" value={pending} />
        <StatCard tone="sky" label="In progress" value={inProgress} />
        <StatCard tone="mint" label="Done" value={done} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-display font-semibold text-ink">Status breakdown</h2>
          <p className="mb-4 mt-1 text-xs text-muted">How work is moving across your selection</p>
          <StatusPieChart pending={pending} inProgress={inProgress} done={done} />
        </div>
        <div className="card">
          <h2 className="font-display font-semibold text-ink">
            {chartMode === "trend" ? "Daily tasks (this selection)" : chartMode === "byMember" ? "Tasks by member" : "Tasks by department"}
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted">Task activity for the current filters</p>
          {chartMode === "trend" ? <TrendChart data={trendData} /> : <ComparisonBarChart data={barData} />}
        </div>
      </div>

      <div className="card">
        <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-display font-semibold text-ink">Recent tasks</h2><p className="mt-1 text-xs text-muted">Latest 50 tasks matching your filters</p></div><a href={`/admin/tasks?${new URLSearchParams(searchParams).toString()}`} className="text-sm font-medium text-brand-600 hover:underline">View all tasks <span aria-hidden="true">&rarr;</span></a></div>
        <TaskTable tasks={tasks.map((t) => formatTask({ ...t, user: t.user, department: t.department }))} showOwner />
      </div>
    </div>
  );
}
