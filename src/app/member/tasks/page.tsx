import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatTask } from "@/lib/format";
import TaskTable from "@/components/TaskTable";

export default async function MyTasksPage() {
  const session = await getSession();

  const tasks = await prisma.task.findMany({
    where: { userId: session!.user.id },
    orderBy: { taskDate: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My Tasks</h1>
      <div className="card">
        <TaskTable tasks={tasks.map(formatTask)} editable />
      </div>
    </div>
  );
}
