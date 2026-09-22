"use client";

import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";

export type TaskRow = {
  id: string;
  content: string;
  type: "text" | "link";
  task_date: string;
  status: string;
  profiles?: { full_name: string } | null;
  departments?: { name: string } | null;
};

export default function TaskTable({
  tasks,
  showOwner = false,
  editable = false,
}: {
  tasks: TaskRow[];
  showOwner?: boolean;
  editable?: boolean;
}) {
  const router = useRouter();

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No tasks found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-4">Date</th>
            {showOwner && <th className="py-2 pr-4">Member</th>}
            {showOwner && <th className="py-2 pr-4">Department</th>}
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Task</th>
            <th className="py-2 pr-4">Status</th>
            {editable && <th className="py-2 pr-4"></th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-gray-100">
              <td className="py-2 pr-4 whitespace-nowrap">{t.task_date}</td>
              {showOwner && <td className="py-2 pr-4">{t.profiles?.full_name ?? "—"}</td>}
              {showOwner && <td className="py-2 pr-4">{t.departments?.name ?? "—"}</td>}
              <td className="py-2 pr-4 capitalize">{t.type}</td>
              <td className="py-2 pr-4 max-w-md">
                {t.type === "link" ? (
                  <a
                    href={t.content}
                    target="_blank"
                    className="text-brand-600 hover:underline break-all"
                  >
                    {t.content}
                  </a>
                ) : (
                  <span className="break-words">{t.content}</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {editable ? (
                  <select
                    className="input py-1"
                    value={t.status}
                    onChange={(e) => updateStatus(t.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <StatusBadge status={t.status} />
                )}
              </td>
              {editable && (
                <td className="py-2 pr-4">
                  <button
                    onClick={() => deleteTask(t.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
