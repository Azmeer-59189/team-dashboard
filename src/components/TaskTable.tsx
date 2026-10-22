"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReviewStatusBadge from "./ReviewStatusBadge";
import TaskWorkflowPanel from "./TaskWorkflowPanel";
import { Icon } from "./icons";

export type TaskRow = {
  id: string;
  version: number;
  user_id: string;
  review_status: string;
  assigned_by?: string | null;
  assigned_by_id?: string | null;
  submission_text?: string | null;
  review_feedback?: string | null;
  reviewed_by?: string | null;
  legacy_approved?: boolean;
  due_date?: string | null;
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
  high: "bg-rose-50 text-rose-700 ring-rose-600/15",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/15",
  low: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-21" -> "Oct 21, 2026" without going through the viewer's timezone
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Long URLs read better as host + path than as the full string
function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 32 ? u.pathname.slice(0, 32) + "…" : u.pathname;
    return u.hostname.replace(/^www\./, "") + (path === "/" ? "" : path);
  } catch {
    return url;
  }
}

function TaskContent({ task }: { task: TaskRow }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          task.type === "link" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-500"
        }`}
      >
        <Icon name={task.type === "link" ? "link" : "file-text"} size={14} />
      </span>
      <div className="min-w-0">
        {task.type === "link" ? (
          <a
            href={task.content}
            target="_blank"
            rel="noopener noreferrer"
            title={task.content}
            className="break-all font-medium text-brand-600 hover:underline"
          >
            {shortUrl(task.content)}
          </a>
        ) : (
          <span className="break-words font-medium text-ink">{task.content}</span>
        )}
        {task.category && <p className="mt-0.5 text-xs text-muted">{task.category}</p>}
        {task.assigned_by && <p className="mt-1 text-xs text-muted">Assigned by {task.assigned_by}</p>}
        {task.due_date && <p className="mt-1 text-xs text-muted">Due {formatDate(task.due_date)}</p>}
        {task.review_status === "CHANGES_REQUESTED" && task.review_feedback && <p className="mt-1 line-clamp-2 text-xs text-amber-800">{task.review_feedback}</p>}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority) return <span className="text-slate-300">—</span>;
  return (
    <span className={`badge capitalize ring-1 ring-inset ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low}`}>
      {priority}
    </span>
  );
}

function Owner({ name }: { name?: string }) {
  if (!name) return <span className="text-slate-300">—</span>;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className="avatar h-7 w-7 text-[11px]">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="font-medium text-ink">{name}</span>
    </span>
  );
}

export default function TaskTable({
  tasks,
  showOwner = false,
  editable = false,
  reviewable = false,
  viewerId,
}: {
  tasks: TaskRow[];
  showOwner?: boolean;
  editable?: boolean;
  reviewable?: boolean;
  viewerId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
        <span aria-hidden="true" className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <Icon name="check-square" size={22} />
        </span>
        <p className="font-display font-semibold text-ink">No tasks to show yet</p>
        <p className="mt-1.5 max-w-xs text-sm leading-6 text-muted">
          Tasks will appear here once logged. If you’re using filters, try widening them.
        </p>
      </div>
    );
  }

  function statusControl(t: TaskRow) {
    const mode = editable ? "owner" : reviewable && t.user_id !== viewerId ? "reviewer" : "read";
    return <div className="flex flex-wrap items-center gap-2">
      <ReviewStatusBadge reviewStatus={t.review_status} status={t.status} />
      <TaskWorkflowPanel task={t} mode={mode} />
    </div>;
  }

  function deleteButton(t: TaskRow) {
    if (t.assigned_by_id || ["SUBMITTED", "APPROVED"].includes(t.review_status)) return null;
    return (
      <button onClick={() => deleteTask(t.id)} className="btn-danger-ghost" aria-label="Delete task" title="Delete task">
        <Icon name="trash" size={14} />
      </button>
    );
  }

  return (
    <div>
      {error && <p className="alert-error mb-3">{error}</p>}

      {/* Phones: one compact card per task */}
      <ul className="divide-y divide-hairline md:hidden">
        {tasks.map((t) => (
          <li key={t.id} className="space-y-2.5 py-3.5 first:pt-0 last:pb-0">
            <TaskContent task={t} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-[38px] text-xs text-muted">
              <span>{formatDate(t.task_date)}</span>
              {showOwner && t.profiles?.full_name && <span className="font-medium text-slate-600">{t.profiles.full_name}</span>}
              {showOwner && t.departments?.name && <span>{t.departments.name}</span>}
              {t.priority && <PriorityBadge priority={t.priority} />}
            </div>
            <div className="flex items-center justify-between gap-2 pl-[38px]">
              {statusControl(t)}
              {editable && deleteButton(t)}
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: full table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Task</th>
              {showOwner && <th>Member</th>}
              {showOwner && <th>Department</th>}
              <th>Date</th>
              <th>Priority</th>
              <th>Status</th>
              {editable && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="min-w-[240px] max-w-md">
                  <TaskContent task={t} />
                </td>
                {showOwner && (
                  <td>
                    <Owner name={t.profiles?.full_name} />
                  </td>
                )}
                {showOwner && <td className="whitespace-nowrap text-slate-600">{t.departments?.name ?? "—"}</td>}
                <td className="whitespace-nowrap tabular-nums text-slate-600">{formatDate(t.task_date)}</td>
                <td>
                  <PriorityBadge priority={t.priority} />
                </td>
                <td>{statusControl(t)}</td>
                {editable && <td className="text-right">{deleteButton(t)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
