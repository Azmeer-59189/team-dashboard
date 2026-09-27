"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function currentMonthLabel() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ManualScoreForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [competency, setCompetency] = useState("");
  const [score, setScore] = useState("");
  const [periodLabel, setPeriodLabel] = useState(currentMonthLabel());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/manual-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, competency, score, periodLabel, notes: notes || null }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save score");
      return;
    }

    setCompetency("");
    setScore("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Competency</label>
        <input
          className="input"
          required
          value={competency}
          onChange={(e) => setCompetency(e.target.value)}
          placeholder="e.g. Teamwork"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Score (0-10)</label>
        <input
          type="number"
          min={0}
          max={10}
          step={0.5}
          required
          className="input"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Period (YYYY-MM)</label>
        <input
          className="input"
          required
          pattern="\d{4}-\d{2}"
          value={periodLabel}
          onChange={(e) => setPeriodLabel(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-1">
        <label className="mb-1 block text-xs font-medium text-muted">Notes (optional)</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Saving..." : "Add score"}
        </button>
      </div>
      {error && <p className="sm:col-span-2 lg:col-span-5 text-sm text-red-600">{error}</p>}
    </form>
  );
}
