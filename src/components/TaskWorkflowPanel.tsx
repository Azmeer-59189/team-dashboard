"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "./TaskTable";
import ReviewStatusBadge from "./ReviewStatusBadge";

type Event = { id: string; action: string; actorName: string; createdAt: string; note: string | null };
const eventLabels: Record<string, string> = { "task.assign": "Assigned task", "task.create": "Logged task", "task.start": "Started work",
  "task.submit": "Submitted work", "task.approve": "Approved work", "task.request_changes": "Requested changes", "task.reopen": "Reopened task", "task.update": "Updated task" };

export default function TaskWorkflowPanel({ task, mode }: { task: TaskRow; mode: "owner" | "reviewer" | "read" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const state = task.review_status ?? "DRAFT";

  async function loadHistory(before?: string) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/history${before ? `?before=${encodeURIComponent(before)}` : ""}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load task history");
      setEvents((previous) => before ? [...previous, ...body.events] : body.events);
      setCursor(body.nextCursor);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load history"); }
    finally { setLoadingHistory(false); }
  }
  function open() {
    setError(null); setNote(mode === "owner" && ["DRAFT", "CHANGES_REQUESTED"].includes(state) ? task.submission_text ?? "" : "");
    dialog.current?.showModal();
    if (mode !== "read") void loadHistory();
  }
  async function act(action: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: task.version, note }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update this task");
      dialog.current?.close(); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update this task"); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={open} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
      {mode === "reviewer" && state === "SUBMITTED" ? "Review work" : mode === "owner" && ["DRAFT", "CHANGES_REQUESTED"].includes(state) ? "Manage work" : "Details"}
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (busy) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-hairline bg-white p-0 text-ink shadow-xl backdrop:bg-slate-950/50">
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id={titleId} className="font-display text-lg font-bold">Task details</h2><div className="mt-2"><ReviewStatusBadge reviewStatus={state} status={task.status} /></div></div>
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Close task details" className="btn-secondary">Close</button>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{task.content}</p>
        <dl className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
          <div><dt className="text-muted">Task date</dt><dd className="mt-1 font-medium">{task.task_date}</dd></div>
          {task.due_date && <div><dt className="text-muted">Due date</dt><dd className="mt-1 font-medium">{task.due_date}</dd></div>}
          {task.assigned_by && <div><dt className="text-muted">Assigned by</dt><dd className="mt-1 font-medium">{task.assigned_by}</dd></div>}
          {task.reviewed_by && <div><dt className="text-muted">Reviewed by</dt><dd className="mt-1 font-medium">{task.reviewed_by}</dd></div>}
        </dl>
        {task.legacy_approved && <p className="text-xs text-muted">Completed before manager reviews were introduced. Existing KPI credit is retained.</p>}
        {task.submission_text && <section><h3 className="mb-2 text-sm font-semibold">Submitted work</h3><p className="whitespace-pre-wrap break-words rounded-xl bg-brand-50 p-4 text-sm leading-6">{task.submission_text}</p></section>}
        {task.review_feedback && <section><h3 className="mb-2 text-sm font-semibold">Manager feedback</h3><p className="whitespace-pre-wrap break-words rounded-xl bg-amber-50 p-4 text-sm leading-6">{task.review_feedback}</p></section>}
        {mode === "owner" && state === "SUBMITTED" && <p className="text-sm text-muted">Your work is awaiting manager review. You’ll see feedback here if changes are requested.</p>}
        {((mode === "owner" && state !== "SUBMITTED") || (mode === "reviewer" && state === "SUBMITTED")) && <div className="space-y-3 border-t border-hairline pt-5">
          <label htmlFor={noteId} className="label">{mode === "reviewer" ? "Review feedback" : state === "APPROVED" ? "Reason for reopening" : "Completed work or deliverable link"}</label>
          <textarea id={noteId} rows={3} maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} className="input"
            placeholder={mode === "reviewer" ? "Explain any changes needed. Optional when approving." : "Describe the work and include a link if relevant."} />
          <div className="flex flex-wrap gap-2">
            {mode === "owner" && state === "DRAFT" && task.status === "pending" && <button disabled={busy} onClick={() => act("start")} className="btn-secondary">Start work</button>}
            {mode === "owner" && ["DRAFT", "CHANGES_REQUESTED"].includes(state) && <button disabled={busy || !note.trim()} onClick={() => act("submit")} className="btn-primary">{busy ? "Saving…" : state === "CHANGES_REQUESTED" ? "Resubmit for review" : "Submit for review"}</button>}
            {mode === "owner" && state === "APPROVED" && <button disabled={busy || !note.trim()} onClick={() => act("reopen")} className="btn-secondary">Reopen task</button>}
            {mode === "reviewer" && <><button disabled={busy} onClick={() => act("approve")} className="btn-primary">Approve work</button><button disabled={busy || !note.trim()} onClick={() => act("request_changes")} className="btn-secondary">Request changes</button></>}
          </div>
          <p className="text-xs text-muted">Approved work counts toward KPIs. Reopening removes that credit until the work is approved again.</p>
        </div>}
        {error && <p role="alert" className="alert-error">{error}</p>}
        {mode !== "read" && <section className="border-t border-hairline pt-5"><h3 className="mb-3 text-sm font-semibold">Activity</h3>
          <ol className="space-y-4">{events.map((event) => <li key={event.id} className="border-l-2 border-brand-100 pl-3"><p className="text-xs font-semibold">{eventLabels[event.action] ?? "Task updated"} · {event.actorName}</p><p className="mt-1 text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</p>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.note}</p>}</li>)}</ol>
          {loadingHistory && <p role="status" className="mt-3 text-xs text-muted">Loading history…</p>}
          {cursor && <button disabled={loadingHistory} onClick={() => loadHistory(cursor)} className="btn-secondary mt-3">Older activity</button>}
        </section>}
      </div>
    </dialog>
  </>;
}
