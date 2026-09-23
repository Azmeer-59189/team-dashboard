import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { formatTask, statusToDb } from "@/lib/format";
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

  const [departments, members] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["MEMBER", "LEAD"] }, ...(scope.isLead ? { departmentId: scope.departmentId } : {}) },
      select: { id: true, fullName: true },
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

  // full matching set for chart accuracy (uncapped-ish), separate from the paginated table below
  const chartTasks = await prisma.task.findMany({
    where,
    select: {
      status: true,
      taskDate: true,
      departmentId: true,
      userId: true,
      department: { select: { name: true } },
      user: { select: { fullName: true } },
    },
    take: 5000,
  });

  const tasks = await prisma.task.findMany({
    where,
    include: { user: { select: { fullName: true } }, department: { select: { name: true } } },
    orderBy: { taskDate: "desc" },
    take: 50,
  });

  const total = chartTasks.length;
  const done = chartTasks.filter((t) => t.status === "DONE").length;
  const inProgress = chartTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const pending = chartTasks.filter((t) => t.status === "PENDING").length;

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
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }
    trendData = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  } else if (chartMode === "byMember") {
    const byMember = new Map<string, number>();
    for (const t of chartTasks) {
      const key = t.user.fullName;
      byMember.set(key, (byMember.get(key) ?? 0) + 1);
    }
    barData = Array.from(byMember.entries()).map(([name, value]) => ({ name, value }));
  } else {
    const byDept = new Map<string, number>();
    for (const t of chartTasks) {
      const key = t.department?.name ?? "No department";
      byDept.set(key, (byDept.get(key) ?? 0) + 1);
    }
    barData = Array.from(byDept.entries()).map(([name, value]) => ({ name, value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-gray-500">
          {scope.isLead ? "Your department's performance at a glance." : "Team-wide performance at a glance."}
        </p>
      </div>

      <FilterBar
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        members={members.map((m) => ({ id: m.id, label: m.fullName }))}
        hideDepartment={scope.isLead}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Members" value={memberCount} />
        {!scope.isLead && <StatCard label="Departments" value={deptCount} />}
        <StatCard label="Tasks (filtered)" value={total} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="In progress" value={inProgress} />
        <StatCard label="Done" value={done} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">Status breakdown</h2>
          <StatusPieChart pending={pending} inProgress={inProgress} done={done} />
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">
            {chartMode === "trend" ? "Daily tasks (this selection)" : chartMode === "byMember" ? "Tasks by member" : "Tasks by department"}
          </h2>
          {chartMode === "trend" ? <TrendChart data={trendData} /> : <ComparisonBarChart data={barData} />}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Tasks</h2>
        <TaskTable tasks={tasks.map((t) => formatTask({ ...t, user: t.user, department: t.department }))} showOwner />
      </div>
    </div>
  );
}
