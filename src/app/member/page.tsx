import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatTask } from "@/lib/format";
import { getMemberGoalProgress } from "@/lib/goals";
import TaskForm from "@/components/TaskForm";
import TaskTable from "@/components/TaskTable";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";

export default async function MemberDashboard() {
  const session = await getSession();
  const userId = session!.user.id;

  const [tasks, doneCount, totalCount, goals] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: { taskDate: "desc" },
      take: 10,
    }),
    prisma.task.count({ where: { userId, status: "DONE" } }),
    prisma.task.count({ where: { userId } }),
    getMemberGoalProgress(userId, session!.user.departmentId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {session!.user.name}</h1>
        <p className="text-sm text-gray-500">Log today's work below.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard label="Total tasks logged" value={totalCount} />
        <StatCard label="Tasks done" value={doneCount} />
      </div>

      {goals.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Your KPI</h2>
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

      <TaskForm />

      <div className="card">
        <h2 className="mb-3 font-semibold">Recent tasks</h2>
        <TaskTable tasks={tasks.map(formatTask)} editable />
      </div>
    </div>
  );
}
