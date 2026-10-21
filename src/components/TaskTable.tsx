"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";

export type TaskRow = {
  id: string;
  content: string;
  type: "text" | "link";
  task_date: string;
  status: string;
  category?: string | null;
  priority?: string | null;
  profiles?: { full_name: string } | null;
  departments?: { name: string } | null;
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-stone-100 text-stone-600",
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
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setError(null);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update task status");
      return;
    }
    router.refresh();
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    setError(null);
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not delete task");
      return;
    }
    router.refresh();
  }

  if (tasks.length === 0) {
    return <div className="flex flex-col items-center rounded-xl border border-dashed border-hairline bg-slate-50/70 px-6 py-12 text-center">
      <span aria-hidden="true" className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 10 2 2 5-5M8 16h8" /></svg>
      </span>
      <p className="font-display font-semibold text-ink">No tasks to show yet</p>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted">Tasks will appear here once logged. If you’re using filters, try adjusting them to see more results.</p>
    </div>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <table className="task-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-muted">
            <th className="py-2 pr-4">Date</th>
            {showOwner && <th className="py-2 pr-4">Member</th>}
            {showOwner && <th className="py-2 pr-4">Department</th>}
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Task</th>
            <th className="py-2 pr-4">Priority</th>
            <th className="py-2 pr-4">Status</th>
            {editable && <th className="py-2 pr-4"></th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-hairline/60">
              <td className="py-2 pr-4 whitespace-nowrap">{t.task_date}</td>
              {showOwner && <td className="py-2 pr-4">{t.profiles?.full_name ?? "—"}</td>}
              {showOwner && <td className="py-2 pr-4">{t.departments?.name ?? "—"}</td>}
              <td className="py-2 pr-4 capitalize">{t.type}</td>
              <td className="py-2 pr-4 max-w-md">
                {t.type === "link" ? (
                  <a
                    href={t.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline break-all"
                  >
                    {t.content}
                  </a>
                ) : (
                  <span className="break-words">{t.content}</span>
                )}
                {t.category && <span className="ml-2 text-xs text-muted">({t.category})</span>}
              </td>
              <td className="py-2 pr-4">
                {t.priority ? (
                  <span className={`badge ${PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.low}`}>{t.priority}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {editable ? (
                  <select
                    className="input min-w-[130px] py-1"
                    aria-label={`Status for ${t.content.slice(0, 60)}`}
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
