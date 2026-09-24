"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TaskForm() {
  const router = useRouter();
  const [type, setType] = useState<"text" | "link">("text");
  const [content, setContent] = useState("");
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("pending");
  const [objectiveId, setObjectiveId] = useState("");
  const [objectives, setObjectives] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/objectives")
      .then((r) => r.json())
      .then((d) => setObjectives(d.objectives ?? []))
      .catch(() => setObjectives([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, task_date: taskDate, status, objective_id: objectiveId || null }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }

    setContent("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold">Submit a task</h2>

      <div className="flex gap-2">
        {(["text", "link"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
              type === t
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-gray-300 text-gray-600"
            }`}
          >
            {t === "text" ? "Text" : "Link"}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          {type === "text" ? "What did you work on?" : "Link"}
        </label>
        {type === "text" ? (
          <textarea
            required
            rows={3}
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe the task..."
          />
        ) : (
          <input
            type="url"
            required
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="https://..."
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            required
            className="input"
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {objectives.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Objective (optional)</label>
          <select className="input" value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)}>
            <option value="">None</option>
            {objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Add task"}
      </button>
    </form>
  );
}
