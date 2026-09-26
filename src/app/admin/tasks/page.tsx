import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { formatTask, statusToDb } from "@/lib/format";
import FilterBar from "@/components/FilterBar";
import TaskTable from "@/components/TaskTable";

export default async function AdminTasksPage({
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

  const tasks = await prisma.task.findMany({
    where,
    include: { user: { select: { fullName: true } }, department: { select: { name: true } } },
    orderBy: { taskDate: "desc" },
    take: 200,
  });

  const exportParams = new URLSearchParams();
  if (!scope.isLead && searchParams.department) exportParams.set("department", searchParams.department);
  if (searchParams.member) exportParams.set("member", searchParams.member);
  if (searchParams.status) exportParams.set("status", searchParams.status);
  if (searchParams.from) exportParams.set("from", searchParams.from);
  if (searchParams.to) exportParams.set("to", searchParams.to);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">All Tasks</h1>
        <a href={`/api/admin/export/tasks?${exportParams.toString()}`} className="btn-secondary">
          Export CSV
        </a>
      </div>

      <FilterBar
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        members={members.map((m) => ({ id: m.id, label: m.fullName }))}
        hideDepartment={scope.isLead}
      />

      <div className="card">
        <TaskTable tasks={tasks.map((t) => formatTask({ ...t, user: t.user, department: t.department }))} showOwner />
      </div>
    </div>
  );
}
