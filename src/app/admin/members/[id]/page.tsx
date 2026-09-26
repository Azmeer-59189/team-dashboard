import { prisma } from "@/lib/prisma";
import { formatTask } from "@/lib/format";
import TaskTable from "@/components/TaskTable";
import StatCard from "@/components/StatCard";

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const [user, tasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      include: { department: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { userId: params.id },
      orderBy: { taskDate: "desc" },
    }),
  ]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">{user?.fullName}</h1>
        <p className="text-sm text-muted">
          {user?.email} · {user?.department?.name ?? "No department"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total tasks" value={total} />
        <StatCard label="Done" value={done} />
        <StatCard label="Completion rate" value={total ? `${Math.round((done / total) * 100)}%` : "—"} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Task history</h2>
        <TaskTable tasks={tasks.map((t) => formatTask(t))} />
      </div>
    </div>
  );
}
