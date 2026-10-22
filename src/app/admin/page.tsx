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
import PageHeader from "@/components/PageHeader";
import { Icon } from "@/components/icons";
import Link from "next/link";

const RECENT_LIMIT = 10;

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
  const heroWhere: any = { cancelledAt: null, status: "DONE", reviewStatus: "APPROVED" };
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
      where: { archivedAt: null, role: { in: ["MEMBER", "LEAD"] }, ...(scope.isLead ? { departmentId: scope.departmentId } : {}) },
      select: { id: true, fullName: true, departmentId: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  // build the filter, forcing a lead's own department regardless of URL params
  const where: any = { cancelledAt: null };
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
    take: RECENT_LIMIT,
  });

  const total = chartTasks.reduce((sum, t) => sum + t.count, 0);
  const done = chartTasks.filter((t) => t.status === "DONE").reduce((sum, t) => sum + t.count, 0);
  const inProgress = chartTasks.filter((t) => t.status === "IN_PROGRESS").reduce((sum, t) => sum + t.count, 0);
  const pending = chartTasks.filter((t) => t.status === "PENDING").reduce((sum, t) => sum + t.count, 0);

  const [memberCount, deptCount] = await Promise.all([
    prisma.user.count({ where: { archivedAt: null, role: "MEMBER", ...(scope.isLead ? { departmentId: scope.departmentId } : {}) } }),
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
      <PageHeader
        eyebrow={scope.isLead ? "Department workspace" : "Organization workspace"}
        title="Team overview"
        description={scope.isLead ? "Your department's performance at a glance." : "Team-wide performance at a glance."}
        actions={
          <>
            <Link href="/admin/tasks" className="btn-secondary">
              <Icon name="list" size={16} /> All tasks
            </Link>
            <Link href="/admin/my-tasks" className="btn-primary">
              <Icon name="plus" size={16} /> Log a task
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <StatCard
            hero
            label={scope.isLead ? "Your department's tasks done this month" : "Tasks done this month, org-wide"}
            value={doneThisMonth}
            trend={heroTrend}
            hint={`${doneLastMonth} last month`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 xl:col-span-3">
          <StatCard tone="blush" icon="users" label="Members" value={memberCount} />
          {scope.isLead ? (
            <StatCard tone="neutral" icon="list" label="Tasks (filtered)" value={total} />
          ) : (
            <StatCard tone="violet" icon="layers" label="Departments" value={deptCount} />
          )}
          <StatCard
            tone="mint"
            label="Completion rate"
            value={total ? `${Math.round((done / total) * 100)}%` : "—"}
            hint={`${done} of ${total} filtered tasks done`}
          />
          <StatCard tone="sand" label="Open tasks" value={pending + inProgress} hint={`${pending} pending · ${inProgress} in progress`} />
        </div>
      </div>

      <FilterBar
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        members={members.map((m) => ({ id: m.id, label: m.fullName, departmentId: m.departmentId }))}
        hideDepartment={scope.isLead}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <h2 className="card-title">Status breakdown</h2>
          <p className="card-subtitle mb-5">How work is moving across your selection</p>
          <StatusPieChart pending={pending} inProgress={inProgress} done={done} />
        </div>
        <div className="card lg:col-span-3">
          <h2 className="card-title">
            {chartMode === "trend" ? "Daily tasks" : chartMode === "byMember" ? "Tasks by member" : "Tasks by department"}
          </h2>
          <p className="card-subtitle mb-5">Task activity for the current filters</p>
          {chartMode === "trend" ? <TrendChart data={trendData} /> : <ComparisonBarChart data={barData} />}
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="card-title">Recent tasks</h2>
            <p className="card-subtitle">Latest {RECENT_LIMIT} tasks matching your filters</p>
          </div>
          <Link href={`/admin/tasks?${new URLSearchParams(searchParams).toString()}`} className="btn-ghost">
            View all <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <TaskTable tasks={tasks.map((t) => formatTask({ ...t, user: t.user, department: t.department }))} showOwner />
      </div>
    </div>
  );
}
