import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatTask } from "@/lib/format";
import TaskForm from "@/components/TaskForm";
import TaskTable from "@/components/TaskTable";

// Lets an Admin or Lead log their own daily work, same as a Member does on /member.
// Separate from Overview/All Tasks, which are about monitoring the team, not personal logging.
export default async function MyTasksPage() {
  const session = await getSession();
  const userId = session!.user.id;

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { taskDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Tasks</h1>
        <p className="text-sm text-gray-500">Log your own daily work here.</p>
      </div>

      <TaskForm />

      <div className="card">
        <TaskTable tasks={tasks.map(formatTask)} editable />
      </div>
    </div>
  );
}
