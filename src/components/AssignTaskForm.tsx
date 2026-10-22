"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvailabilityHint from "./AvailabilityHint";

type Member = { id: string; fullName: string; departmentId: string | null; department: { name: string } | null };
export default function AssignTaskForm({ members, objectives, today }: {
  members: Member[]; objectives: { id: string; title: string; departmentId: string }[]; today: string;
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [content, setContent] = useState("");
  const [taskDate, setTaskDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [objectiveId, setObjectiveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selected = members.find((m) => m.id === memberId);
  const availableObjectives = objectives.filter((o) => o.departmentId === selected?.departmentId);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/tasks/assign", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: memberId, content, task_date: taskDate, due_date: dueDate, priority, objective_id: objectiveId || null }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not assign this task");
      setContent(""); setDueDate(""); setObjectiveId("");
      setSuccess(`Task assigned to ${selected?.fullName ?? "team member"}. It will appear in their My Tasks list.`);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not assign this task"); }
    finally { setBusy(false); }
  }
  return <details className="card">
    <summary className="cursor-pointer font-display font-semibold text-ink">Assign a task</summary>
    {members.length === 0 ? <p className="mt-4 text-sm text-muted">There are no eligible active team members to assign work to.</p> : <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="text-sm text-muted">Set the brief and deadline. The assignee submits their work here for manager approval.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Assign to</span><select required className="input" value={memberId} disabled={busy} onChange={(e) => { setMemberId(e.target.value); setObjectiveId(""); }}>
          <option value="">Choose a team member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.fullName}{m.department ? ` · ${m.department.name}` : ""}</option>)}
        </select></label>
        <label className="block"><span className="label">Priority</span><select className="input" value={priority} disabled={busy} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
      <label className="block"><span className="label">Task brief</span><textarea required maxLength={5000} rows={3} className="input" value={content} disabled={busy} onChange={(e) => setContent(e.target.value)} placeholder="Describe what needs to be delivered and how it will be reviewed." /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Task date</span><input required type="date" className="input" value={taskDate} disabled={busy} onChange={(e) => setTaskDate(e.target.value)} /></label>
        <label className="block"><span className="label">Due date</span><input required type="date" min={taskDate} className="input" value={dueDate} disabled={busy} onChange={(e) => setDueDate(e.target.value)} /></label>
      </div>
      {availableObjectives.length > 0 && <label className="block"><span className="label">Objective (optional)</span><select className="input" value={objectiveId} disabled={busy} onChange={(e) => setObjectiveId(e.target.value)}><option value="">No objective</option>{availableObjectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>}
      <AvailabilityHint userId={memberId} from={taskDate} to={dueDate} />
      {error && <p role="alert" className="alert-error">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
      <div className="flex justify-end"><button disabled={busy} className="btn-primary">{busy ? "Assigning…" : "Assign task"}</button></div>
    </form>}
  </details>;
}
