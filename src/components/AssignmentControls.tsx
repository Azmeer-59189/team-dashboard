"use client";
import { useState } from "react";
import type { TaskRow } from "./TaskTable";

export default function AssignmentControls({ task, members, onSaved, onBusy }: {
  task: TaskRow; members: { id: string; fullName: string }[]; onSaved: () => void; onBusy: (busy: boolean) => void;
}) {
  const [action, setAction] = useState(task.review_status === "SUBMITTED" ? "cancel" : "edit");
  const [content, setContent] = useState(task.content);
  const [date, setDate] = useState(task.task_date);
  const [due, setDue] = useState(task.due_date ?? "");
  const [priority, setPriority] = useState(task.priority ?? "medium");
  const [owner, setOwner] = useState("");
  const [reason, setReason] = useState("");
  const [clearObjective, setClearObjective] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (action === "cancel" && !confirm("Cancel this assignment? It will remain in history, but work can no longer be submitted.")) return;
    setBusy(true); onBusy(true); setError(null);
    try {
      const body = { action, version: task.version, reason, ...(action !== "cancel" ? {
        content, task_date: date, due_date: due, priority, ...(clearObjective ? { objective_id: null } : {}),
        ...(action === "reassign" ? { user_id: owner } : {}),
      } : {}) };
      const res = await fetch(`/api/tasks/${task.id}/assignment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Could not change this assignment");
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not change assignment"); }
    finally { setBusy(false); onBusy(false); }
  }
  return <details className="rounded-xl border border-hairline p-4"><summary className="cursor-pointer text-sm font-semibold">Manage assignment</summary>
    <form onSubmit={save} className="mt-4 space-y-4">
      <label className="block"><span className="label">Action</span><select value={action} onChange={(e) => setAction(e.target.value)} disabled={busy} className="input">
        {task.review_status !== "SUBMITTED" && <><option value="edit">Edit brief or deadline</option><option value="reassign">Reassign to another person</option></>}
        <option value="cancel">Cancel assignment</option>
      </select></label>
      {action === "reassign" && <><label className="block"><span className="label">New assignee</span><select required value={owner} onChange={(e) => setOwner(e.target.value)} className="input" disabled={busy}><option value="">Choose someone else</option>{members.filter((m) => m.id !== task.user_id).map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label><p className="text-xs text-muted">Reassignment starts a fresh draft. Previous deliverables and feedback remain in the audit history. Links to another department's objective are cleared.</p></>}
      {action !== "cancel" && <>
        <label className="block"><span className="label">Brief</span><textarea required rows={3} maxLength={5000} className="input" value={content} disabled={busy} onChange={(e) => setContent(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label><span className="label">Task date</span><input type="date" required className="input" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} /></label><label><span className="label">Deadline</span><input type="date" required min={date} className="input" value={due} disabled={busy} onChange={(e) => setDue(e.target.value)} /></label></div>
        <label className="block"><span className="label">Priority</span><select value={priority} className="input" disabled={busy} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        {task.objective_id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={clearObjective} disabled={busy} onChange={(e) => setClearObjective(e.target.checked)} />Clear linked objective</label>}
      </>}
      <label className="block"><span className="label">Reason (required)</span><textarea required rows={2} maxLength={5000} className="input" value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder="Explain the change for the task history." /></label>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <button disabled={busy || !reason.trim()} className="btn-secondary">{busy ? "Saving…" : action === "cancel" ? "Cancel assignment" : "Save assignment"}</button>
    </form>
  </details>;
}
