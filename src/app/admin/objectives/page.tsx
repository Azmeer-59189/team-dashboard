"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ProgressBar from "@/components/ProgressBar";

type Department = { id: string; name: string };
type Objective = {
  id: string;
  title: string;
  description: string | null;
  departmentId: string;
  departmentName: string;
  kpiAveragePct: number | null;
  linkedGoalCount: number;
  taskProgress: { done: number; target: number } | null;
  overallPct: number | null;
};

export default function ObjectivesPage() {
  const { data: session } = useSession();
  const isLead = session?.user?.role === "LEAD";
  const leadDepartmentId = session?.user?.departmentId ?? "";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [form, setForm] = useState({ departmentId: "", title: "", description: "", targetTaskCount: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [dRes, oRes] = await Promise.all([fetch("/api/admin/departments"), fetch("/api/admin/objectives")]);
    const dData = await dRes.json();
    const oData = await oRes.json();
    setDepartments(dData.departments ?? []);
    setObjectives(oData.objectives ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (isLead && leadDepartmentId) setForm((f) => ({ ...f, departmentId: leadDepartmentId }));
  }, [isLead, leadDepartmentId]);

  const visibleDepartments = isLead ? departments.filter((d) => d.id === leadDepartmentId) : departments;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId: form.departmentId,
        title: form.title,
        description: form.description || null,
        targetTaskCount: form.targetTaskCount || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Could not create objective");
      return;
    }

    setForm({ departmentId: isLead ? leadDepartmentId : "", title: "", description: "", targetTaskCount: "" });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this objective? KPIs and tasks linked to it will stay, just unlinked.")) return;
    await fetch(`/api/admin/objectives/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Objectives</h1>
        <p className="text-sm text-gray-500">
          The "why" behind your KPIs. Link existing KPIs to an objective on the KPI Goals page, and members
          can optionally tag their tasks to one when they log work. Progress resets each month.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Department</label>
          <select
            className="input"
            required
            disabled={isLead}
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">Select...</option>
            {visibleDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            className="input"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Grow brand awareness this quarter"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Direct task target (optional)</label>
          <input
            type="number"
            min={1}
            className="input"
            value={form.targetTaskCount}
            onChange={(e) => setForm({ ...form, targetTaskCount: e.target.value })}
            placeholder="e.g. 20"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="mb-1 block text-sm font-medium">Description (optional)</label>
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Creating..." : "Create objective"}
          </button>
        </div>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {objectives.map((o) => (
          <div key={o.id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{o.title}</p>
                <p className="text-xs text-gray-500">{o.departmentName}</p>
              </div>
              <button onClick={() => handleDelete(o.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
            {o.description && <p className="text-sm text-gray-600">{o.description}</p>}

            {o.overallPct !== null ? (
              <ProgressBar label="Overall this month" progress={o.overallPct} target={100} />
            ) : (
              <p className="text-sm text-gray-400">No progress data yet — link a KPI or set a task target.</p>
            )}

            {o.kpiAveragePct !== null && (
              <p className="text-xs text-gray-500">
                {o.linkedGoalCount} linked KPI{o.linkedGoalCount === 1 ? "" : "s"}, averaging {o.kpiAveragePct}%
                completion this month
              </p>
            )}
            {o.taskProgress && (
              <p className="text-xs text-gray-500">
                {o.taskProgress.done} / {o.taskProgress.target} tagged tasks done this month
              </p>
            )}
          </div>
        ))}
        {objectives.length === 0 && (
          <p className="text-sm text-gray-500">No objectives yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
