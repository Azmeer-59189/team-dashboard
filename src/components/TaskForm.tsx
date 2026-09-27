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

  const [category, setCategory] = useState("");
  const [chapter, setChapter] = useState("");
  const [campaign, setCampaign] = useState("");
  const [priority, setPriority] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isDesignTask, setIsDesignTask] = useState(false);
  const [deliveredDate, setDeliveredDate] = useState("");
  const [revisionRounds, setRevisionRounds] = useState("");
  const [suggestions, setSuggestions] = useState<{ categories: string[]; chapters: string[]; campaigns: string[] }>({
    categories: [],
    chapters: [],
    campaigns: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/objectives")
      .then((r) => r.json())
      .then((d) => setObjectives(d.objectives ?? []))
      .catch(() => setObjectives([]));
    fetch("/api/tasks/suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions({ categories: d.categories ?? [], chapters: d.chapters ?? [], campaigns: d.campaigns ?? [] }))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        content,
        task_date: taskDate,
        status,
        objective_id: objectiveId || null,
        category: category || null,
        chapter: chapter || null,
        campaign: campaign || null,
        priority: priority || null,
        due_date: dueDate || null,
        delivered_date: isDesignTask ? deliveredDate || null : null,
        revision_rounds: isDesignTask && revisionRounds !== "" ? revisionRounds : null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }

    setContent("");
    setDueDate("");
    setDeliveredDate("");
    setRevisionRounds("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-display font-semibold text-ink">Submit a task</h2>

      <div className="flex gap-2">
        {(["text", "link"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
              type === t
                ? "border-brand-500 bg-brand-50 text-brand-600"
                : "border-hairline text-muted"
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

      <details className="rounded-lg border border-hairline p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted">More details (optional)</summary>
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Category / task type</label>
              <input
                className="input"
                list="category-suggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Blog post"
              />
              <datalist id="category-suggestions">
                {suggestions.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Chapter / region</label>
              <input
                className="input"
                list="chapter-suggestions"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. Europe"
              />
              <datalist id="chapter-suggestions">
                {suggestions.chapters.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Campaign</label>
              <input
                className="input"
                list="campaign-suggestions"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g. Winter Appeal"
              />
              <datalist id="campaign-suggestions">
                {suggestions.campaigns.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Due date</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isDesignTask} onChange={(e) => setIsDesignTask(e.target.checked)} />
            This is a design task (track delivery & revisions)
          </label>

          {isDesignTask && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Delivered date</label>
                <input
                  type="date"
                  className="input"
                  value={deliveredDate}
                  onChange={(e) => setDeliveredDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Revision rounds</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={revisionRounds}
                  onChange={(e) => setRevisionRounds(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </details>

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
