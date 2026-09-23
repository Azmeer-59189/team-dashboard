import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatTask } from "@/lib/format";

import TaskForm from "@/components/TaskForm";
import TaskTable from "@/components/TaskTable";

export default async function MyTasksPage() {
  const session = await getSession();
  const userId = session!.user.id;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
    },
    orderBy: {
      taskDate: "desc",
    },
  });

  const formattedTasks = tasks.map(formatTask);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">My Tasks</h1>

        <p className="text-sm text-gray-500">
          Log your own daily work here.
        </p>
      </header>

      <TaskForm />

      <section className="card">
        <TaskTable tasks={formattedTasks} editable />
      </section>
    </div>
  );
}